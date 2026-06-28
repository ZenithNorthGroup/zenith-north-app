/**
 * POST /api/channels/slack
 * Slack Events API — archives messages from monitored channels.
 *
 * Setup:
 *   api.slack.com → App → Event Subscriptions → Request URL
 *   URL: https://app.zenith-north.com/api/channels/slack
 *   Events: message.channels, message.groups, message.im
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import crypto from 'crypto'

function verifySlack(rawBody: string, timestamp: string | null, sig: string | null): boolean {
  if (!timestamp || !sig || !process.env.SLACK_SIGNING_SECRET) return false
  const base = 'v0:' + timestamp + ':' + rawBody
  const expected = 'v0=' + crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET)
    .update(base).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  if (!verifySlack(
    rawBody,
    request.headers.get('x-slack-request-timestamp'),
    request.headers.get('x-slack-signature')
  )) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)

  // URL verification challenge
  if (event.type === 'url_verification') {
    return NextResponse.json({ challenge: event.challenge })
  }

  const innerEvent = event.event
  if (!innerEvent || innerEvent.type !== 'message' || innerEvent.bot_id) {
    return NextResponse.json({ status: 'ignored' })
  }

  // Find tenant by Slack team ID
  const tenantResult = await db.execute(sql`
    SELECT id FROM tenants
    WHERE config->>'slackTeamId' = ${event.team_id ?? ''}
      AND archived_at IS NULL LIMIT 1
  `)

  if (tenantResult.rows.length > 0) {
    const tenantId = (tenantResult.rows[0] as any).id

    await db.execute(sql`
      INSERT INTO communications (tenant_id, thread_id, client_id, channel, direction, body, ai_scanned, metadata)
      VALUES (
        ${tenantId}, ${'slack_' + innerEvent.channel + '_' + (innerEvent.thread_ts ?? innerEvent.ts)},
        null, 'slack', 'outbound', ${innerEvent.text ?? ''},
        false,
        ${JSON.stringify({ channel: innerEvent.channel, user: innerEvent.user, ts: innerEvent.ts })}::jsonb
      )
    `)

    await db.execute(sql`
      INSERT INTO channel_events (tenant_id, platform, event_type, payload, processed_at)
      VALUES (${tenantId}, 'slack', ${innerEvent.type}, ${JSON.stringify(innerEvent)}::jsonb, NOW())
    `)
  }

  return NextResponse.json({ ok: true })
}
