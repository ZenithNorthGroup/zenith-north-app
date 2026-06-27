/**
 * POST /api/webhooks/clerk
 *
 * Clerk fires this when a user is created or signs in for the first time.
 * We use it to ensure the user has a row in our DB.
 *
 * Events handled:
 *   user.created  — new Clerk account, create DB user row
 *   session.created — first time signing in, ensure row exists
 *
 * For the demo/seed scenario, the seed script creates the user row directly.
 * This webhook handles production new-user signups.
 *
 * SETUP:
 *   1. dashboard.clerk.com → Webhooks → Add Endpoint
 *   2. URL: https://app.zenith-north.com/api/webhooks/clerk
 *   3. Events: user.created, session.created
 *   4. Copy Signing Secret → CLERK_WEBHOOK_SECRET env var
 */

import { NextRequest, NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { db, users, tenants } from '@/lib/db'
import { eq, sql } from 'drizzle-orm'

// ── Verify Svix signature ─────────────────────────────────

async function verifyWebhook(request: NextRequest): Promise<any> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new Error('CLERK_WEBHOOK_SECRET not set')
  }

  const svixId        = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing Svix headers')
  }

  const body = await request.text()
  const wh   = new Webhook(webhookSecret)

  return wh.verify(body, {
    'svix-id':        svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  })
}

// ── Ensure user row exists ────────────────────────────────

async function ensureUserExists(clerkUserId: string, email: string, fullName: string) {
  // Check if user already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  })

  if (existing) return existing

  // For new users: we need a tenant.
  // In the self-serve flow, the user creates their firm during onboarding.
  // For now: create a placeholder tenant so the user can sign in.
  // The onboarding flow completes the firm setup.

  // Check if there's an existing tenant with this email domain
  const domain = email.split('@')[1]
  const existingTenant = await db.query.tenants.findFirst({
    where: sql`config->>'domain' = ${domain}`,
  })

  let tenantId: string

  if (existingTenant) {
    tenantId = existingTenant.id
  } else {
    // Create a new tenant for this user
    const slug = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .slice(0, 40)
      + '-' + Math.random().toString(36).slice(2, 6)

    const [newTenant] = await db.insert(tenants).values({
      name:   fullName ? `${fullName}'s Firm` : 'New Advisory Firm',
      slug,
      config: {
        plan:    'trial',
        status:  'onboarding',
        domain,
        ccoEmail: email,
      },
    }).returning()

    tenantId = newTenant.id
  }

  // Create the user row
  const [newUser] = await db.insert(users).values({
    tenantId,
    clerkUserId,
    email,
    fullName: fullName || email.split('@')[0],
    role:     'admin',  // first user is always admin/owner
  }).returning()

  console.log(`[CLERK WEBHOOK] Created user ${newUser.id} for ${email}`)
  return newUser
}

// ── Handler ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let event: any

  try {
    event = await verifyWebhook(request)
  } catch (err) {
    console.error('[CLERK WEBHOOK] Verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const { type, data } = event

  if (type === 'user.created' || type === 'session.created') {
    const clerkUserId = type === 'user.created' ? data.id : data.user_id
    const email = type === 'user.created'
      ? data.email_addresses?.[0]?.email_address
      : data.public_user_data?.identifier

    if (!clerkUserId || !email) {
      return NextResponse.json({ status: 'skipped — no email' })
    }

    const fullName = type === 'user.created'
      ? [data.first_name, data.last_name].filter(Boolean).join(' ')
      : data.public_user_data?.first_name
        ? `${data.public_user_data.first_name} ${data.public_user_data.last_name ?? ''}`.trim()
        : ''

    try {
      await ensureUserExists(clerkUserId, email, fullName)
    } catch (err) {
      console.error('[CLERK WEBHOOK] Failed to create user:', err)
      // Return 200 anyway — Clerk will retry on 4xx/5xx
      return NextResponse.json({ status: 'error', error: String(err) })
    }
  }

  return NextResponse.json({ status: 'ok', type })
}
