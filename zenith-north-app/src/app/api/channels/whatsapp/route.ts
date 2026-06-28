/**
 * POST /api/channels/whatsapp
 * WhatsApp Business Cloud API webhook — receive, scan, archive.
 *
 * Setup in Meta Developer Console:
 *   Callback URL: https://app.zenith-north.com/api/channels/whatsapp
 *   Verify token: WHATSAPP_VERIFY_TOKEN env var
 *   Subscribe to: messages
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get('hub.challenge'), { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value

      const tenantResult = await db.execute(sql`
        SELECT id FROM tenants
        WHERE config->>'whatsappPhoneNumberId' = ${value.metadata?.phone_number_id ?? ''}
          AND archived_at IS NULL LIMIT 1
      `)
      if (!tenantResult.rows.length) continue
      const tenantId = (tenantResult.rows[0] as any).id

      for (const message of value.messages ?? []) {
        const from     = message.from
        const msgBody  = message.type === 'text' ? message.text?.body : '[' + message.type + ' message]'
        const threadId = 'wa_' + from + '_' + tenantId

        const clientResult = await db.execute(sql`
          SELECT DISTINCT ON (id) id FROM clients
          WHERE tenant_id = ${tenantId} AND data->>'phone' = ${'+' + from}
            AND archived_at IS NULL ORDER BY id, version DESC LIMIT 1
        `)
        const clientId = clientResult.rows.length > 0 ? (clientResult.rows[0] as any).id : null

        let aiFlagged = false, aiSeverity = null, aiReason = null, aiExcerpt = null
        try {
          const scan = await anthropic.messages.create({
            model: 'claude-sonnet-4-6', max_tokens: 200,
            messages: [{ role: 'user', content: `Compliance scan. Respond JSON only: {"flagged":boolean,"severity":"high"|"medium"|"low"|null,"reason":string|null,"excerpt":string|null}\n\nMessage: ${msgBody}` }]
          })
          const r = JSON.parse((scan.content[0] as any).text.replace(/```json|```/g,'').trim())
          aiFlagged = r.flagged ?? false; aiSeverity = r.severity; aiReason = r.reason; aiExcerpt = r.excerpt
        } catch {}

        await db.execute(sql`
          INSERT INTO communications (tenant_id, thread_id, client_id, channel, direction, body, ai_scanned, ai_flagged, ai_severity, ai_reason, ai_excerpt, metadata)
          VALUES (${tenantId}, ${threadId}, ${clientId}, 'whatsapp', 'inbound', ${msgBody ?? ''}, true, ${aiFlagged}, ${aiSeverity}, ${aiReason}, ${aiExcerpt}, ${JSON.stringify({ from, messageId: message.id })}::jsonb)
        `)
        await db.execute(sql`
          INSERT INTO channel_events (tenant_id, platform, event_type, payload, processed_at)
          VALUES (${tenantId}, 'whatsapp', 'message.received', ${JSON.stringify(message)}::jsonb, NOW())
        `)
      }
    }
  }
  return NextResponse.json({ status: 'ok' })
}
