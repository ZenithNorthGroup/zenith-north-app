/**
 * POST /api/sms/inbound
 *
 * Twilio calls this webhook whenever a client sends a text
 * to the firm's Twilio number.
 *
 * SECURITY: Validates Twilio's signature on every request.
 * A forged request cannot inject messages into the audit log.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyTwilioSignature,
  handleInboundSMS,
  type InboundSMSPayload,
} from '@/lib/messaging/twilio'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  // Parse form body — Twilio sends application/x-www-form-urlencoded
  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => {
    params[key] = value.toString()
  })

  // Verify this is actually from Twilio
  const signature = request.headers.get('X-Twilio-Signature') ?? ''
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/sms/inbound`

  if (!verifyTwilioSignature(signature, url, params)) {
    console.error('[SMS] Invalid Twilio signature — possible spoofing attempt')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const payload = params as unknown as InboundSMSPayload

  // Resolve which tenant this number belongs to
  // Each tenant has their Twilio number stored in config
  const result = await db.execute(sql`
    SELECT id
    FROM tenants
    WHERE config->>'twilioPhoneNumber' = ${payload.To}
      AND archived_at IS NULL
    LIMIT 1
  `)

  const tenantId = (result.rows[0] as { id: string } | undefined)?.id

  if (!tenantId) {
    console.warn('[SMS] Inbound to unknown Twilio number:', payload.To)
    // Still return 200 — Twilio needs 200 or it will retry
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }

  // Process the message
  await handleInboundSMS(payload, tenantId)

  // Twilio expects TwiML response — empty response = no auto-reply
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  )
}
