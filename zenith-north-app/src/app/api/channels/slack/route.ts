import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { getCredential } from '@/lib/credentials'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const rawBody  = await request.text()
  const timestamp = request.headers.get('x-slack-request-timestamp') ?? ''
  const signature = request.headers.get('x-slack-signature') ?? ''

  const event = JSON.parse(rawBody)

  // URL verification — no signature needed
  if (event.type === 'url_verification') {
    return NextResponse.json({ challenge: event.challenge })
  }

  // Find tenant by Slack team ID
  const teamId = event.team_id as string
  const tenantResult = await db.execute(sql`
    SELECT id, config FROM tenants
    WHERE config->>'slackTeamId' = ${teamId ?? ''}
      AND archived_at IS NULL LIMIT 1
  `)

  if (!tenantResult.rows.length) {
    return NextResponse.json({ error: 'Unknown team' }, { status: 401 })
  }

  const tenantId = (tenantResult.rows[0] as any).id
  const config   = (tenantResult.rows[0] as any).config

  // Verify signature using per-tenant secret
  const signingSecret = getCredential(config, 'slackSigningSecret') ?? process.env.SLACK_SIGNING_SECRET ?? ''
  const base     = `v0:${timestamp}:${rawBody}`
  const expected = 'v0=' + crypto.createHmac('sha256', signingSecret).update(base).digest('hex')

  if (signature && signingSecret && !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const innerEvent = event.event
  if (!innerEvent || innerEvent.type !== 'message' || innerEvent.bot_id) {
    return NextResponse.json({ status: 'ignored' })
  }

  await db.execute(sql`
    INSERT INTO communications (tenant_id, thread_id, client_id, channel, direction, body, ai_scanned, metadata)
    VALUES (
      ${tenantId},
      ${'slack_' + innerEvent.channel + '_' + (innerEvent.thread_ts ?? innerEvent.ts)},
      null, 'slack', 'outbound', ${innerEvent.text ?? ''}, false,
      ${JSON.stringify({ channel: innerEvent.channel, user: innerEvent.user, ts: innerEvent.ts })}::jsonb
    )
  `)
  await db.execute(sql`
    INSERT INTO channel_events (tenant_id, platform, event_type, payload, processed_at)
    VALUES (${tenantId}, 'slack', ${innerEvent.type}, ${JSON.stringify(innerEvent)}::jsonb, NOW())
  `)

  return NextResponse.json({ ok: true })
}
