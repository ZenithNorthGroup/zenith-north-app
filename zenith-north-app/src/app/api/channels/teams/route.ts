/**
 * POST /api/channels/teams
 * Microsoft Teams Graph API webhook — archives messages and meeting transcripts.
 *
 * Setup:
 *   Azure Portal → App Registrations → your app → API Permissions
 *   Add: ChannelMessage.Read.All, Chat.Read.All
 *   Set webhook subscription in Graph API for each tenant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  // Validation token challenge (subscription creation)
  const validationToken = request.nextUrl.searchParams.get('validationToken')
  if (validationToken) {
    return new NextResponse(validationToken, {
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  const body = await request.json()

  for (const notification of body.value ?? []) {
    const resource      = notification.resource as string
    const changeType    = notification.changeType as string
    const tenantId      = notification.tenantId as string

    // Verify tenant is registered with us
    const tenantResult = await db.execute(sql`
      SELECT id FROM tenants
      WHERE config->>'msTenantsId' = ${tenantId ?? ''}
        AND archived_at IS NULL LIMIT 1
    `)

    if (!tenantResult.rows.length) continue
    const ourTenantId = (tenantResult.rows[0] as any).id

    // Fetch the actual message from Graph API
    if (changeType === 'created' && resource.includes('messages')) {
      const accessToken = process.env.TEAMS_ACCESS_TOKEN
      if (accessToken) {
        try {
          const msgResp = await fetch(
            `https://graph.microsoft.com/v1.0/${resource}`,
            { headers: { Authorization: 'Bearer ' + accessToken } }
          )
          const msg = await msgResp.json()

          if (msg.body?.content && msg.messageType === 'message') {
            const body_text = msg.body.content.replace(/<[^>]+>/g, '') // strip HTML

            await db.execute(sql`
              INSERT INTO communications (tenant_id, thread_id, client_id, channel, direction, body, ai_scanned, metadata)
              VALUES (${ourTenantId}, ${'teams_' + msg.id}, null, 'teams', 'outbound', ${body_text}, false, ${JSON.stringify({ from: msg.from?.user?.displayName, channelIdentity: msg.channelIdentity })}::jsonb)
            `)
          }
        } catch (err) {
          await db.execute(sql`
            INSERT INTO channel_events (tenant_id, platform, event_type, payload, processed_at, error)
            VALUES (${ourTenantId}, 'teams', 'message.created', ${JSON.stringify(notification)}::jsonb, NOW(), ${String(err)})
          `)
          continue
        }
      }
    }

    await db.execute(sql`
      INSERT INTO channel_events (tenant_id, platform, event_type, payload, processed_at)
      VALUES (${ourTenantId}, 'teams', ${changeType}, ${JSON.stringify(notification)}::jsonb, NOW())
    `)
  }

  return NextResponse.json({ status: 'ok' })
}
