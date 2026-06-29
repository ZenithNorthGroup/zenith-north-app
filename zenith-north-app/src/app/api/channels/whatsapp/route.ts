import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { getCredential } from '@/lib/credentials'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const challenge = p.get('hub.challenge')

  // Find tenant by phone number ID
  const phoneNumberId = p.get('hub.phone_number_id') ?? ''
  const tenantResult = await db.execute(sql`
    SELECT id, config FROM tenants
    WHERE config->>'whatsappPhoneNumberId' = ${phoneNumberId}
      AND archived_at IS NULL LIMIT 1
  `)

  if (!tenantResult.rows.length) {
    // Fallback to global env var for setup verification
    if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 })
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const config = (tenantResult.rows[0] as any).config
  const verifyToken = getCredential(config, 'whatsappVerifyToken')

  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value
      const phoneNumberId = value.metadata?.phone_number_id ?? ''

      const tenantResult = await db.execute(sql`
        SELECT id, config FROM tenants
        WHERE config->>'whatsappPhoneNumberId' = ${phoneNumberId}
          AND archived_at IS NULL LIMIT 1
      `)
      if (!tenantResult.rows.length) continue
      const tenantId = (tenantResult.rows[0] as any).id
      const config   = (tenantResult.rows[0] as any).config

      for (const message of value.messages ?? []) {
        const from     = message.from
        const msgBody  = message.type === 'text' ? message.text?.body : `[${message.type} message]`
        const threadId = `wa_${from}_${tenantId}`

        const clientResult = await db.execute(sql`
          SELECT DISTINCT ON (id) id FROM clients
          WHERE tenant_id = ${tenantId} AND data->>'phone' = ${'+' + from}
            AND archived_at IS NULL ORDER BY id, version DESC LIMIT 1
        `)
        const clientId = clientResult.rows.length > 0 ? (clientResult.rows[0] as any).id : null

        let aiFlagged = false, aiSeverity = null, aiReason = null
        try {
          const scan = await anthropic.messages.create({
            model: 'claude-sonnet-4-6', max_tokens: 150,
            messages: [{ role: 'user', content: `Compliance scan. JSON only: {"flagged":boolean,"severity":"high"|"medium"|"low"|null,"reason":string|null}\nMessage: ${msgBody}` }]
          })
          const r = JSON.parse((scan.content[0] as any).text.replace(/```json|```/g, '').trim())
          aiFlagged = r.flagged ?? false; aiSeverity = r.severity; aiReason = r.reason
        } catch {}

        await db.execute(sql`
          INSERT INTO communications (tenant_id, thread_id, client_id, channel, direction, body, ai_scanned, ai_flagged, ai_severity, ai_reason, metadata)
          VALUES (${tenantId}, ${threadId}, ${clientId}, 'whatsapp', 'inbound', ${msgBody ?? ''}, true, ${aiFlagged}, ${aiSeverity}, ${aiReason}, ${JSON.stringify({ from, messageId: message.id })}::jsonb)
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
