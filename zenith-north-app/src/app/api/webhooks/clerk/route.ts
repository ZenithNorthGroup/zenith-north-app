/**
 * POST /api/webhooks/clerk
 * Handles Clerk webhook events for user lifecycle management.
 *
 * Events handled:
 *   user.created    — new user signed up
 *   user.updated    — user changed name/email
 *   session.created — user signed in (update last_seen_at, resolve pending invite)
 *
 * Setup in Clerk Dashboard:
 *   Webhooks → Add endpoint → https://app.zenith-north.com/api/webhooks/clerk
 *   Events: user.created, user.updated, session.created
 */

import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function verifyWebhook(request: NextRequest): Promise<any> {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) throw new Error('CLERK_WEBHOOK_SECRET not set')

  const svixId        = request.headers.get('svix-id')        ?? ''
  const svixTimestamp = request.headers.get('svix-timestamp') ?? ''
  const svixSignature = request.headers.get('svix-signature') ?? ''

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing svix headers')
  }

  const body = await request.text()
  const wh   = new Webhook(secret)

  return wh.verify(body, {
    'svix-id':        svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  })
}

export async function POST(request: NextRequest) {
  let event: any
  try {
    event = await verifyWebhook(request)
  } catch (err) {
    console.error('[Clerk webhook] Verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { type, data } = event

  try {
    switch (type) {

      case 'user.created': {
        const clerkUserId = data.id as string
        const email       = data.email_addresses?.[0]?.email_address ?? ''
        const firstName   = data.first_name ?? ''
        const lastName    = data.last_name  ?? ''
        const fullName    = `${firstName} ${lastName}`.trim() || email
        const avatarUrl   = data.image_url ?? null

        // Check if this email matches a pending invite
        const pendingResult = await db.execute(sql`
          SELECT id, tenant_id, role FROM users
          WHERE email = ${email}
            AND clerk_user_id LIKE 'pending_%'
            AND archived_at IS NULL
          LIMIT 1
        `)

        if (pendingResult.rows.length > 0) {
          // Update existing pending row with real Clerk ID
          const pending = pendingResult.rows[0] as any
          await db.execute(sql`
            UPDATE users
            SET clerk_user_id = ${clerkUserId},
                full_name     = ${fullName},
                avatar_url    = ${avatarUrl},
                last_seen_at  = NOW()
            WHERE id = ${pending.id}
          `)

          // Audit log
          await db.execute(sql`
            INSERT INTO audit_log (tenant_id, user_id, skill_slug, action, entity_type, entity_id, next_state)
            VALUES (${pending.tenant_id}, ${pending.id}, 'system', 'user.activated',
                    'user', ${pending.id},
                    ${JSON.stringify({ email, fullName, clerkUserId })}::jsonb)
          `)
        }
        // If no pending invite, user is signing up directly — 
        // they'll be handled by the firm onboarding flow
        break
      }

      case 'user.updated': {
        const clerkUserId = data.id as string
        const email       = data.email_addresses?.[0]?.email_address ?? ''
        const firstName   = data.first_name ?? ''
        const lastName    = data.last_name  ?? ''
        const fullName    = `${firstName} ${lastName}`.trim() || email
        const avatarUrl   = data.image_url ?? null

        await db.execute(sql`
          UPDATE users
          SET full_name  = ${fullName},
              email      = ${email},
              avatar_url = ${avatarUrl}
          WHERE clerk_user_id = ${clerkUserId}
            AND archived_at IS NULL
        `)
        break
      }

      case 'session.created': {
        const clerkUserId = data.user_id as string

        await db.execute(sql`
          UPDATE users
          SET last_seen_at = NOW()
          WHERE clerk_user_id = ${clerkUserId}
            AND archived_at IS NULL
        `)
        break
      }

      default:
        // Unhandled event type — ignore silently
        break
    }
  } catch (err) {
    console.error(`[Clerk webhook] Error processing ${type}:`, err)
    // Return 200 to prevent Clerk from retrying — log the error internally
    return NextResponse.json({ error: 'Processing error', type }, { status: 200 })
  }

  return NextResponse.json({ received: true, type })
}
