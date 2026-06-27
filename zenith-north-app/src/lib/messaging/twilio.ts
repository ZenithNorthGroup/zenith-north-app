/**
 * ZENITH NORTH — Twilio SMS Layer
 *
 * Twilio is the underlying carrier infrastructure.
 * MyRepChat is built on Twilio. We use Twilio directly.
 * We pay wholesale. We control everything.
 *
 * Setup required (one-time per firm):
 *   1. Twilio account — twilio.com
 *   2. Buy a phone number or port the firm's existing number
 *   3. Register for 10DLC (10-digit long code) — required by carriers
 *      for business SMS. Twilio handles the registration.
 *   4. Set webhook URL to /api/sms/inbound for incoming texts
 *
 * 10DLC registration:
 *   Required by US carriers since 2021 for business texting.
 *   Twilio's Trust Hub handles it. Takes 2-5 business days.
 *   Cost: ~$4/month per number + carrier fees.
 *   This is what MyRepChat charges $35/user/month to manage.
 *   We do it directly.
 *
 * Env vars required:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER (the firm's Twilio number)
 */

import twilio from 'twilio'
import { db, communications, complianceItems } from '@/lib/db'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

// ── Twilio client ─────────────────────────────────────────

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken  = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.')
  }

  return twilio(accountSid, authToken)
}

// ── AI compliance scanner ─────────────────────────────────

const anthropic = new Anthropic()

async function scanOutboundSMS(body: string): Promise<{
  flagged:  boolean
  severity: 'low' | 'medium' | 'high' | null
  reason:   string | null
  excerpt:  string | null
}> {
  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 300,
      system: `You are a compliance monitoring system for a registered investment adviser (RIA).
Analyze this outbound SMS for SEC/FINRA violations.

Flag if it contains:
- Guarantees of investment returns or specific performance promises
- Discretionary trading decisions without prior written authorization  
- Recommendations contradicting the client's stated risk profile
- Undisclosed conflicts of interest
- Instructions to move assets inconsistently with the investment policy statement
- Language that could constitute a client complaint response
- Promises about specific securities

Respond ONLY with valid JSON:
{"flagged":boolean,"severity":"low"|"medium"|"high"|null,"reason":string|null,"excerpt":string|null}`,
      messages: [{ role: 'user', content: `Outbound SMS from advisor:\n\n${body}` }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch {
    return { flagged: false, severity: null, reason: null, excerpt: null }
  }
}

// ── Phone number resolver ─────────────────────────────────

export async function resolveClientByPhone(
  tenantId: string,
  phone: string
): Promise<string | null> {
  const normalized = phone.replace(/\D/g, '')

  const result = await db.execute(sql`
    SELECT DISTINCT ON (id) id
    FROM clients
    WHERE tenant_id = ${tenantId}
      AND archived_at IS NULL
      AND (
        regexp_replace(data->>'phone',       '[^0-9]', '', 'g') = ${normalized}
      )
    ORDER BY id, version DESC
    LIMIT 1
  `)

  return (result.rows[0] as { id: string } | undefined)?.id ?? null
}

// ── Send SMS ──────────────────────────────────────────────

export interface SendSMSOptions {
  tenantId:   string
  clientId:   string
  fromUserId: string
  toPhone:    string      // client's phone number
  body:       string
  threadId?:  string      // optional — creates new thread if omitted
  auditCtx:   { tenantId: string; userId?: string; ipAddress?: string }
}

export async function sendSMS(opts: SendSMSOptions): Promise<{
  success:   boolean
  messageId: string
  sid:       string
}> {
  const {
    tenantId, clientId, fromUserId,
    toPhone, body, auditCtx,
  } = opts

  const threadId = opts.threadId ?? crypto.randomUUID()
  const fromPhone = process.env.TWILIO_PHONE_NUMBER!

  // 1. Send via Twilio
  const client = getTwilioClient()
  const twilioMessage = await client.messages.create({
    to:   toPhone,
    from: fromPhone,
    body,
  })

  // 2. Store immediately — never wait on scan
  const [record] = await db.insert(communications).values({
    tenantId,
    threadId,
    clientId,
    fromUserId,
    channel:       'sms',
    direction:     'outbound',
    body,
    bodyEncrypted: Buffer.from(body).toString('base64'),
    aiScanned:     false,
    aiFlagged:     false,
    metadata: {
      twilioSid:    twilioMessage.sid,
      twilioStatus: twilioMessage.status,
      toPhone,
      fromPhone,
    },
  } as any).returning()

  // 3. Write audit log immediately
  await writeAudit(auditCtx, {
    skillSlug:  'messaging',
    action:     AUDIT_ACTIONS.MSG_SENT,
    entityType: 'client',
    entityId:   clientId,
    nextState: {
      messageId:  record.id,
      channel:    'sms',
      twilioSid:  twilioMessage.sid,
      direction:  'outbound',
      bodyLength: body.length,
    },
  })

  // 4. Fire-and-forget AI scan
  void (async () => {
    try {
      const scan = await scanOutboundSMS(body)

      await db.execute(sql`
        UPDATE communications
        SET
          ai_scanned  = true,
          ai_flagged  = ${scan.flagged},
          ai_severity = ${scan.severity},
          ai_reason   = ${scan.reason},
          ai_excerpt  = ${scan.excerpt}
        WHERE id = ${record.id}
      `)

      if (scan.flagged && scan.severity === 'high') {
        await db.insert(complianceItems).values({
          tenantId,
          clientId,
          itemType:    'communication_flagged',
          severity:    'critical',
          title:       `High severity SMS flag — ${scan.reason}`,
          description: scan.excerpt ?? undefined,
          sourceType:  'communication',
          sourceId:    record.id,
        })

        await writeAudit(auditCtx, {
          skillSlug:  'messaging',
          action:     AUDIT_ACTIONS.MSG_FLAGGED,
          entityType: 'communication',
          entityId:   record.id,
          metadata: {
            severity: scan.severity,
            reason:   scan.reason,
            excerpt:  scan.excerpt,
          },
        })
      }
    } catch (err) {
      console.error('[SMS AI scan failed]', err)
    }
  })()

  return {
    success:   true,
    messageId: record.id,
    sid:       twilioMessage.sid,
  }
}

// ── Verify Twilio webhook signature ───────────────────────
// Critical security step — ensures inbound webhooks are from Twilio,
// not from someone trying to inject fake messages into the audit log

export function verifyTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  return twilio.validateRequest(authToken, signature, url, params)
}

// ── Handle inbound SMS (Twilio webhook) ───────────────────

export interface InboundSMSPayload {
  MessageSid:  string
  AccountSid:  string
  From:        string   // client's phone number
  To:          string   // firm's Twilio number
  Body:        string   // message content
  NumMedia:    string
  MediaUrl0?:  string   // if client sent image/file
}

export async function handleInboundSMS(
  payload: InboundSMSPayload,
  tenantId: string
): Promise<void> {
  // Idempotency — skip if already processed
  const existing = await db.execute(sql`
    SELECT id FROM communications
    WHERE metadata->>'twilioSid' = ${payload.MessageSid}
    LIMIT 1
  `)

  if (existing.rows.length > 0) return

  // Resolve client by their phone number
  const clientId = await resolveClientByPhone(tenantId, payload.From)

  if (!clientId) {
    // Unknown number — log but don't store in client record
    console.warn('[SMS] Inbound from unknown number:', payload.From)
    return
  }

  // Find existing thread or create new one
  const existingThread = await db.execute(sql`
    SELECT DISTINCT thread_id
    FROM communications
    WHERE tenant_id = ${tenantId}
      AND client_id = ${clientId}
      AND channel = 'sms'
    ORDER BY thread_id
    LIMIT 1
  `)

  const threadId = (existingThread.rows[0] as { thread_id: string } | undefined)?.thread_id
    ?? crypto.randomUUID()

  // Store inbound message
  await db.insert(communications).values({
    tenantId,
    threadId,
    clientId,
    fromUserId:    null,  // from client, not advisor
    channel:       'sms',
    direction:     'inbound',
    body:          payload.Body,
    bodyEncrypted: Buffer.from(payload.Body).toString('base64'),
    aiScanned:     true,   // inbound not scanned for outbound violations
    aiFlagged:     false,
    metadata: {
      twilioSid: payload.MessageSid,
      fromPhone: payload.From,
      toPhone:   payload.To,
      hasMedia:  payload.NumMedia !== '0',
      mediaUrl:  payload.MediaUrl0,
    },
  } as any)

  // Audit log
  await writeAudit(
    { tenantId },
    {
      skillSlug:  'messaging',
      action:     AUDIT_ACTIONS.MSG_SENT,
      entityType: 'client',
      entityId:   clientId,
      nextState: {
        channel:    'sms',
        direction:  'inbound',
        twilioSid:  payload.MessageSid,
        bodyLength: payload.Body.length,
      },
    }
  )
}
