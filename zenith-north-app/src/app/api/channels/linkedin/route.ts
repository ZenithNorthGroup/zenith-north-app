/**
 * POST /api/channels/linkedin
 * LinkedIn Organization API webhook — captures posts and DMs.
 *
 * Setup:
 *   LinkedIn Developer Portal → App → Products → Marketing Developer Platform
 *   Webhook URL: https://app.zenith-north.com/api/channels/linkedin
 *   Events: OrganizationSocialActionEvent, MessageEvent
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import crypto from 'crypto'

function verifySignature(payload: string, signature: string | null): boolean {
  if (!signature || !process.env.LINKEDIN_WEBHOOK_SECRET) return false
  const expected = crypto
    .createHmac('sha256', process.env.LINKEDIN_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sig = request.headers.get('x-li-signature')

  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)
  const eventType = event.eventType as string

  // Find tenant by LinkedIn org URN
  const orgUrn = event.organizationUrn ?? event.actor
  const tenantResult = await db.execute(sql`
    SELECT id FROM tenants
    WHERE config->>'linkedinOrgUrn' = ${orgUrn ?? ''}
      AND archived_at IS NULL LIMIT 1
  `)

  if (tenantResult.rows.length > 0) {
    const tenantId = (tenantResult.rows[0] as any).id

    let body = '', direction: string = 'outbound', channel = 'linkedin'

    if (eventType === 'OrganizationSocialActionEvent') {
      // Advisor posted on LinkedIn
      body = event.message?.values?.[0]?.value ?? event.specificContent?.shareCommentary?.text ?? ''
      direction = 'outbound'
    } else if (eventType === 'MessageEvent') {
      // LinkedIn DM
      body = event.body ?? ''
      direction = event.actor?.includes('member') ? 'inbound' : 'outbound'
    }

    if (body) {
      await db.execute(sql`
        INSERT INTO communications (tenant_id, thread_id, client_id, channel, direction, body, ai_scanned, metadata)
        VALUES (${tenantId}, ${'li_' + (event.id ?? Date.now())}, null, ${channel}, ${direction}, ${body}, false, ${JSON.stringify(event)}::jsonb)
      `)
    }

    await db.execute(sql`
      INSERT INTO channel_events (tenant_id, platform, event_type, payload, processed_at)
      VALUES (${tenantId}, 'linkedin', ${eventType}, ${JSON.stringify(event)}::jsonb, NOW())
    `)
  }

  return NextResponse.json({ status: 'ok' })
}
