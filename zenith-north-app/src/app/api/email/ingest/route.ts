/**
 * ZENITH NORTH — Email Ingest
 *
 * Receives journaled emails from:
 *   - Microsoft 365 (Exchange journaling via Compliance Management)
 *   - Google Workspace (Third-party email archiving via Gmail Routing)
 *   - Google Chat (journaling to SMTP)
 *   - Google Calendar (journaling to SMTP)
 *   - Google Meet (recordings metadata)
 *
 * HOW IT WORKS — both providers use the same pattern:
 *
 *   Microsoft 365 setup:
 *     Admin center → Exchange → Compliance Management → Journal Rules
 *     Journal recipient: ingest-{tenantSlug}@mail.zenith-north.com
 *     Scope: All messages (internal + external)
 *
 *   Google Workspace setup:
 *     Admin console → Apps → Gmail → Routing → Third-party email archiving
 *     Journal address: ingest-{tenantSlug}@mail.zenith-north.com
 *     (Same address — Google uses BCC-style journaling, Microsoft uses
 *      envelope journaling — we handle both)
 *
 * EMAIL PROCESSING FLOW:
 *   1. Provider sends email copy to ingest-{tenantSlug}@mail.zenith-north.com
 *   2. Sendgrid / Postmark receives it and POSTs to /api/email/ingest
 *   3. We parse the MIME email
 *   4. Identify the provider (Microsoft envelope vs Google BCC)
 *   5. Extract sender, recipient, subject, body, attachments
 *   6. Match sender/recipient email to client or advisor record
 *   7. Write to communications table (channel: 'email')
 *   8. AI scan for compliance flags
 *   9. Write to audit log
 *
 * INBOUND EMAIL INFRASTRUCTURE:
 *   We use Sendgrid Inbound Parse or Postmark Inbound to receive SMTP
 *   and convert to an HTTP POST. This avoids running our own SMTP server.
 *
 *   Sendgrid: Settings → Inbound Parse → Add Host & URL
 *     MX record: mx.sendgrid.net
 *     URL: https://api.zenith-north.com/api/email/ingest
 *
 *   Postmark: Inbound → Add Inbound Stream
 *     MX record: inbound.postmarkapp.com
 *     URL: https://api.zenith-north.com/api/email/ingest
 *
 * TENANT JOURNAL ADDRESS FORMAT:
 *   ingest-{tenantSlug}@mail.zenith-north.com
 *   e.g. ingest-wright-advisory@mail.zenith-north.com
 *
 *   The tenantSlug in the address is how we identify which firm's
 *   email is being received without requiring any auth header.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, communications, complianceItems } from '@/lib/db'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { eq, sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// ── Types ─────────────────────────────────────────────────

interface ParsedEmail {
  messageId:    string
  provider:     'microsoft365' | 'google_workspace' | 'unknown'
  channel:      'email' | 'google_chat' | 'google_calendar' | 'google_meet'
  from:         { email: string; name?: string }
  to:           Array<{ email: string; name?: string }>
  cc:           Array<{ email: string; name?: string }>
  subject:      string
  bodyText:     string
  bodyHtml?:    string
  date:         Date
  attachments:  Array<{ filename: string; contentType: string; size: number }>
  // Microsoft envelope journal fields
  originalFrom?: string
  originalTo?:   string[]
  // Raw headers for chain of custody
  headers:      Record<string, string>
}

// ── Email parser ───────────────────────────────────────────

function parseEmailAddresses(header: string): Array<{ email: string; name?: string }> {
  if (!header) return []

  // Basic RFC 5322 address parsing
  // Handles: "Name <email@domain.com>", "email@domain.com", comma-separated lists
  const results: Array<{ email: string; name?: string }> = []
  const parts = header.split(',')

  for (const part of parts) {
    const trimmed = part.trim()
    const angleMatch = trimmed.match(/^(.+?)\s*<([^>]+)>$/)
    const emailOnly = trimmed.match(/^([^\s@]+@[^\s@]+\.[^\s@]+)$/)

    if (angleMatch) {
      results.push({
        name:  angleMatch[1].replace(/^"|"$/g, '').trim() || undefined,
        email: angleMatch[2].toLowerCase().trim(),
      })
    } else if (emailOnly) {
      results.push({ email: emailOnly[1].toLowerCase().trim() })
    }
  }

  return results
}

function detectProvider(headers: Record<string, string>): ParsedEmail['provider'] {
  // Microsoft 365 journal reports have a specific X-MS header
  if (headers['x-ms-journal-report'] || headers['x-microsoft-antispam']) {
    return 'microsoft365'
  }
  // Google Workspace adds X-Google headers
  if (headers['x-google-dkim-signature'] || headers['x-gm-message-state']) {
    return 'google_workspace'
  }
  return 'unknown'
}

function detectChannel(subject: string, headers: Record<string, string>): ParsedEmail['channel'] {
  // Google Chat journals look like: "Chat message from..."
  if (subject?.toLowerCase().includes('chat message') ||
      headers['x-google-chat-space']) {
    return 'google_chat'
  }
  // Google Calendar journals have calendar event data
  if (subject?.toLowerCase().includes('calendar event') ||
      headers['x-google-calendar']) {
    return 'google_calendar'
  }
  // Google Meet journals
  if (subject?.toLowerCase().includes('meeting recording') ||
      headers['x-google-meet']) {
    return 'google_meet'
  }
  return 'email'
}

/**
 * Parse a Sendgrid Inbound Parse webhook payload.
 * Sendgrid POSTs multipart/form-data with parsed email fields.
 */
function parseSendgridPayload(formData: FormData): ParsedEmail {
  const headers: Record<string, string> = {}
  const rawHeaders = formData.get('headers')?.toString() ?? ''

  // Parse raw headers
  for (const line of rawHeaders.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).toLowerCase().trim()
      const val = line.slice(colonIdx + 1).trim()
      headers[key] = val
    }
  }

  const from    = parseEmailAddresses(formData.get('from')?.toString() ?? '')
  const to      = parseEmailAddresses(formData.get('to')?.toString() ?? '')
  const cc      = parseEmailAddresses(formData.get('cc')?.toString() ?? '')
  const subject = formData.get('subject')?.toString() ?? '(no subject)'
  const bodyText= formData.get('text')?.toString() ?? ''
  const bodyHtml= formData.get('html')?.toString()

  // Parse attachments
  const attachmentInfo = formData.get('attachment-info')?.toString()
  const attachments: ParsedEmail['attachments'] = []
  if (attachmentInfo) {
    try {
      const info = JSON.parse(attachmentInfo)
      for (const [_, att] of Object.entries(info as Record<string, any>)) {
        attachments.push({
          filename:    att.filename ?? 'unknown',
          contentType: att.type ?? 'application/octet-stream',
          size:        att.size ?? 0,
        })
      }
    } catch {}
  }

  return {
    messageId:  headers['message-id'] ?? crypto.randomUUID(),
    provider:   detectProvider(headers),
    channel:    detectChannel(subject, headers),
    from:       from[0] ?? { email: 'unknown@unknown.com' },
    to,
    cc,
    subject,
    bodyText,
    bodyHtml,
    date:       new Date(headers['date'] ?? Date.now()),
    attachments,
    headers,
  }
}

// ── Tenant resolver ────────────────────────────────────────

async function resolveTenantFromJournalAddress(
  journalAddress: string
): Promise<string | null> {
  // Address format: ingest-{tenantSlug}@mail.zenith-north.com
  const match = journalAddress.match(/^ingest-([^@]+)@/)
  if (!match) return null

  const slug = match[1]

  const result = await db.execute(sql`
    SELECT id FROM tenants
    WHERE slug = ${slug} AND archived_at IS NULL
    LIMIT 1
  `)

  return (result.rows[0] as { id: string } | undefined)?.id ?? null
}

// ── Client/advisor resolver ────────────────────────────────

async function resolveParticipant(
  tenantId: string,
  email: string
): Promise<{ type: 'client' | 'advisor' | 'unknown'; id: string | null }> {
  const normalizedEmail = email.toLowerCase().trim()

  // Check if it's an advisor (user in this tenant)
  const userResult = await db.execute(sql`
    SELECT id FROM users
    WHERE tenant_id = ${tenantId}
      AND LOWER(email) = ${normalizedEmail}
      AND archived_at IS NULL
    LIMIT 1
  `)

  if (userResult.rows.length > 0) {
    return { type: 'advisor', id: (userResult.rows[0] as { id: string }).id }
  }

  // Check if it's a client
  const clientResult = await db.execute(sql`
    SELECT DISTINCT ON (id) id
    FROM clients
    WHERE tenant_id = ${tenantId}
      AND LOWER(data->>'email') = ${normalizedEmail}
      AND archived_at IS NULL
    ORDER BY id, version DESC
    LIMIT 1
  `)

  if (clientResult.rows.length > 0) {
    return { type: 'client', id: (clientResult.rows[0] as { id: string }).id }
  }

  return { type: 'unknown', id: null }
}

// ── AI compliance scanner ─────────────────────────────────

async function scanEmail(subject: string, body: string): Promise<{
  flagged:  boolean
  severity: 'low' | 'medium' | 'high' | null
  reason:   string | null
  excerpt:  string | null
}> {
  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 400,
      system: `You are a compliance monitoring system for a registered investment adviser.
Analyze this outbound email for SEC/FINRA violations.

Flag if it contains:
- Guarantees of investment returns or specific performance promises
- Discretionary trading decisions communicated without prior written authorization
- Recommendations contradicting the client's stated risk profile
- Undisclosed conflicts of interest
- Testimonials or endorsements that violate SEC marketing rules
- Performance data presented without required disclosures
- Instructions to move assets inconsistently with the investment policy
- Language that could constitute a client complaint

Respond ONLY with valid JSON:
{"flagged":boolean,"severity":"low"|"medium"|"high"|null,"reason":string|null,"excerpt":string|null}`,
      messages: [{
        role:    'user',
        content: `Subject: ${subject}\n\nBody:\n${body.slice(0, 3000)}`,
      }],
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

// ── Main ingest handler ───────────────────────────────────

export async function POST(request: NextRequest) {
  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  // Parse the email
  const email = parseSendgridPayload(formData)

  // Find the journal address in the To field to identify tenant
  // The journal address is always in To or Envelope-To
  const envelopeTo = formData.get('envelope')?.toString()
  let tenantId: string | null = null

  if (envelopeTo) {
    try {
      const envelope = JSON.parse(envelopeTo)
      for (const addr of (envelope.to ?? [])) {
        tenantId = await resolveTenantFromJournalAddress(addr)
        if (tenantId) break
      }
    } catch {}
  }

  // Also check To field
  if (!tenantId) {
    for (const addr of email.to) {
      tenantId = await resolveTenantFromJournalAddress(addr.email)
      if (tenantId) break
    }
  }

  if (!tenantId) {
    // No tenant found — still return 200 to prevent retries
    console.warn('[EMAIL INGEST] Could not resolve tenant from journal address')
    return NextResponse.json({ status: 'tenant_not_found' })
  }

  // Idempotency check
  const existing = await db.execute(sql`
    SELECT id FROM communications
    WHERE metadata->>'emailMessageId' = ${email.messageId}
      AND tenant_id = ${tenantId}
    LIMIT 1
  `)

  if (existing.rows.length > 0) {
    return NextResponse.json({ status: 'already_ingested' })
  }

  // Resolve who sent and who received
  const sender    = await resolveParticipant(tenantId, email.from.email)
  const direction = sender.type === 'advisor' ? 'outbound' : 'inbound'

  // Find the client in this communication
  let clientId: string | null = null

  if (sender.type === 'client') {
    clientId = sender.id
  } else {
    // Look through recipients for a client
    for (const recipient of [...email.to, ...email.cc]) {
      const p = await resolveParticipant(tenantId, recipient.email)
      if (p.type === 'client') {
        clientId = p.id
        break
      }
    }
  }

  if (!clientId) {
    // Internal email (advisor to advisor) — still archive it
    // but without client linkage
    console.info('[EMAIL INGEST] Internal email — no client found, archiving without client link')
  }

  // Find or create thread ID (group by email thread)
  const threadRef = email.headers['in-reply-to'] || email.headers['references']
  let threadId: string

  if (threadRef && clientId) {
    const existingThread = await db.execute(sql`
      SELECT DISTINCT thread_id FROM communications
      WHERE tenant_id = ${tenantId}
        AND client_id = ${clientId}
        AND channel = 'email'
        AND metadata->>'emailMessageId' = ANY(${[threadRef]})
      LIMIT 1
    `)
    threadId = (existingThread.rows[0] as { thread_id: string } | undefined)?.thread_id
      ?? crypto.randomUUID()
  } else {
    threadId = crypto.randomUUID()
  }

  // Write to communications table
  const [record] = await db.insert(communications).values({
    tenantId,
    threadId,
    clientId:      clientId ?? undefined,
    fromUserId:    sender.type === 'advisor' ? sender.id ?? undefined : undefined,
    channel:       email.channel,
    direction,
    subject:       email.subject,
    body:          email.bodyText,
    bodyEncrypted: Buffer.from(email.bodyText).toString('base64'),
    aiScanned:     false,
    aiFlagged:     false,
    metadata: {
      emailMessageId:    email.messageId,
      emailFrom:         email.from.email,
      emailTo:           email.to.map(t => t.email),
      emailCc:           email.cc.map(c => c.email),
      provider:          email.provider,
      hasAttachments:    email.attachments.length > 0,
      attachmentCount:   email.attachments.length,
      attachments:       email.attachments.map(a => ({
        filename: a.filename,
        type:     a.contentType,
        size:     a.size,
      })),
      inReplyTo:         email.headers['in-reply-to'],
    },
  } as any).returning()

  // Write audit log immediately
  await writeAudit(
    { tenantId },
    {
      skillSlug:  'messaging',
      action:     AUDIT_ACTIONS.MSG_SENT,
      entityType: clientId ? 'client' : 'internal',
      entityId:   clientId ?? tenantId,
      nextState: {
        messageId:   record.id,
        channel:     email.channel,
        provider:    email.provider,
        direction,
        subject:     email.subject,
        from:        email.from.email,
        to:          email.to.map(t => t.email),
        attachments: email.attachments.length,
      },
    }
  )

  // Fire-and-forget AI scan (outbound only, non-internal)
  if (direction === 'outbound' && clientId) {
    void (async () => {
      try {
        const scan = await scanEmail(email.subject, email.bodyText)

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
            title:       `High severity email flag — ${scan.reason}`,
            description: `Subject: ${email.subject} · ${scan.excerpt ?? ''}`,
            sourceType:  'communication',
            sourceId:    record.id,
          })

          await writeAudit(
            { tenantId },
            {
              skillSlug:  'messaging',
              action:     AUDIT_ACTIONS.MSG_FLAGGED,
              entityType: 'communication',
              entityId:   record.id,
              metadata: {
                severity: scan.severity,
                reason:   scan.reason,
                subject:  email.subject,
              },
            }
          )
        }
      } catch (err) {
        console.error('[EMAIL AI SCAN]', err)
      }
    })()
  }

  return NextResponse.json({
    status:    'ingested',
    messageId: record.id,
    channel:   email.channel,
    provider:  email.provider,
    direction,
    clientId,
  })
}
