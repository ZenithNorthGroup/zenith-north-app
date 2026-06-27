/**
 * ZENITH NORTH — MyRepChat Integration
 *
 * MyRepChat is the industry-standard compliant texting solution for RIAs.
 * Instead of building SMS compliance from scratch, we integrate with them.
 *
 * HOW IT WORKS:
 *   1. Firm connects Zenith North to MyRepChat via Settings > Integrations
 *   2. They paste their Zenith North API token into MyRepChat
 *   3. MyRepChat pulls contacts from our /api/myrepchat/contacts endpoint
 *   4. When an advisor texts a client via MyRepChat, it POSTs the message
 *      to our /api/myrepchat/messages endpoint as a "note"
 *   5. We write it to our communications table — it becomes part of the
 *      Client 360 timeline, audit log, and exam packages
 *
 * WHAT THIS GIVES US:
 *   - Full WORM-compliant SMS archiving (MyRepChat handles this)
 *   - SEC Rule 17a-4 compliance (MyRepChat handles this)
 *   - Messages unified with all other client communications in Zenith North
 *   - AI monitoring on ingested messages (we run our scan on ingest)
 *   - SMS history in Client 360 timeline
 *   - SMS included in one-click exam packages
 *
 * BUSINESS NOTE:
 *   To get officially listed in MyRepChat's integration dropdown,
 *   contact integrations@myrepchat.com. They add new CRM partners
 *   by partnership agreement. In the meantime, firms can use the
 *   "Other CRM" option with a custom API URL.
 *
 * PRICING CONSIDERATION:
 *   MyRepChat charges ~$35/user/month separately from Zenith North.
 *   This is a tool the firm already pays for or will add.
 *   Do NOT bundle it into our subscription — it's their compliance
 *   infrastructure and we just integrate with it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, communications, complianceItems } from '@/lib/db'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { eq, and, sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// ── Token validation ───────────────────────────────────────
// MyRepChat will pass the tenant's API token in every request
// We validate it and resolve the tenant

async function validateToken(request: NextRequest): Promise<{
  tenantId: string
  userId: string
} | null> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '') ??
    request.headers.get('x-api-token') ??
    new URL(request.url).searchParams.get('token')

  if (!token) return null

  // Look up the tenant by their integration token
  // Stored in tenants.config.integrationTokens.myrepchat
  const result = await db.execute(sql`
    SELECT id, config
    FROM tenants
    WHERE config->>'myrepchatToken' = ${token}
      AND archived_at IS NULL
    LIMIT 1
  `)

  if (!result.rows.length) return null

  const tenant = result.rows[0] as { id: string; config: Record<string, unknown> }

  return {
    tenantId: tenant.id,
    userId:   (tenant.config.myrepchatUserId as string) ?? 'system',
  }
}

// ── AI compliance scan (same as native messaging) ─────────

async function scanSMSMessage(body: string): Promise<{
  flagged: boolean
  severity: 'low' | 'medium' | 'high' | null
  reason: string | null
  excerpt: string | null
}> {
  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 300,
      system: `You are a compliance monitoring system for a registered investment adviser.
Analyze this SMS text message for potential SEC/FINRA compliance violations.
Flag if it contains return guarantees, unauthorized discretionary decisions,
undisclosed conflicts, or anything that could constitute a regulatory violation.
Respond ONLY with JSON: {"flagged":boolean,"severity":"low"|"medium"|"high"|null,"reason":string|null,"excerpt":string|null}`,
      messages: [{ role: 'user', content: `SMS from advisor: ${body}` }],
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

// ── Client phone resolver ─────────────────────────────────

async function resolveClientByPhone(
  tenantId: string,
  phone: string
): Promise<string | null> {
  // Normalize phone — strip all non-digits
  const normalized = phone.replace(/\D/g, '')

  // Search client records for matching phone
  const result = await db.execute(sql`
    SELECT DISTINCT ON (id) id
    FROM clients
    WHERE tenant_id = ${tenantId}
      AND archived_at IS NULL
      AND (
        regexp_replace(data->>'phone', '[^0-9]', '', 'g') = ${normalized}
        OR regexp_replace(data->>'phoneMobile', '[^0-9]', '', 'g') = ${normalized}
        OR regexp_replace(data->>'phoneHome', '[^0-9]', '', 'g') = ${normalized}
      )
    ORDER BY id, version DESC
    LIMIT 1
  `)

  return (result.rows[0] as { id: string } | undefined)?.id ?? null
}

// ─────────────────────────────────────────────────────────
// ENDPOINT 1: GET /api/myrepchat/contacts
// MyRepChat calls this to pull your clients into their system
// so advisors can text them
// ─────────────────────────────────────────────────────────

export async function GET_contacts(request: NextRequest) {
  const auth = await validateToken(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tenantId } = auth

  // Get latest version of all active clients
  const contacts = await db.execute(sql`
    SELECT DISTINCT ON (id)
      id,
      data->>'firstName'   as first_name,
      data->>'lastName'    as last_name,
      data->>'email'       as email,
      data->>'phone'       as phone,
      data->>'phoneMobile' as phone_mobile
    FROM clients
    WHERE tenant_id = ${tenantId}
      AND archived_at IS NULL
      AND data->>'status' IN ('active', 'prospect')
    ORDER BY id, version DESC
  `)

  // Return in MyRepChat's expected format
  // Based on their Wealthbox/Redtail integration pattern
  const formatted = (contacts.rows as Array<{
    id: string
    first_name: string
    last_name: string
    email: string
    phone: string
    phone_mobile: string
  }>).map(c => ({
    id:         c.id,
    first_name: c.first_name ?? '',
    last_name:  c.last_name ?? '',
    email:      c.email ?? '',
    // MyRepChat needs mobile phone — prefer mobile, fall back to primary
    phone:      c.phone_mobile || c.phone || '',
    // Metadata MyRepChat uses to link back to us
    crm_id:     c.id,
    crm_source: 'zenith_north',
  }))

  return NextResponse.json({
    contacts: formatted,
    total:    formatted.length,
    page:     1,
  })
}

// ─────────────────────────────────────────────────────────
// ENDPOINT 2: POST /api/myrepchat/messages
// MyRepChat POSTs here whenever a text is sent or received
// This is the core of the integration
// ─────────────────────────────────────────────────────────

export interface MyRepChatMessagePayload {
  // MyRepChat message fields (based on their Wealthbox integration pattern)
  message_id:    string          // their internal ID
  conversation_id: string        // thread identifier
  contact_id:    string          // their contact ID (maps to our client.id via crm_id)
  contact_phone: string          // client's phone number
  advisor_phone: string          // advisor's MyRepChat number
  direction:     'outbound' | 'inbound'
  message:       string          // the actual text
  timestamp:     string          // ISO timestamp
  advisor_name?: string          // advisor display name
  contact_name?: string          // client display name
  // MyRepChat also sends this for archived content
  archived:      boolean
}

export async function POST_message(request: NextRequest) {
  const auth = await validateToken(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { tenantId, userId } = auth

  let payload: MyRepChatMessagePayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Idempotency — check if we already have this message
  const existing = await db.execute(sql`
    SELECT id FROM communications
    WHERE tenant_id = ${tenantId}
      AND metadata->>'myrepchatMessageId' = ${payload.message_id}
    LIMIT 1
  `)

  if (existing.rows.length > 0) {
    // Already ingested — return success (idempotent)
    return NextResponse.json({ status: 'already_ingested' })
  }

  // Resolve client by phone or CRM ID
  let clientId = payload.contact_id // if MyRepChat sends back our crm_id
  if (!clientId || clientId === payload.contact_id) {
    // Try phone lookup as fallback
    const resolved = await resolveClientByPhone(tenantId, payload.contact_phone)
    if (resolved) clientId = resolved
  }

  if (!clientId) {
    // Client not found — log but don't fail
    // Could be a contact not yet in Zenith North
    console.warn('[MyRepChat] Could not resolve client for phone:', payload.contact_phone)
    return NextResponse.json({
      status:  'client_not_found',
      message: 'Phone number not matched to any client. Import client first.',
    })
  }

  // Run AI compliance scan on outbound messages
  let scanResult = { flagged: false, severity: null as string | null, reason: null as string | null, excerpt: null as string | null }

  if (payload.direction === 'outbound') {
    // Fire-and-forget scan
    void (async () => {
      try {
        const scan = await scanSMSMessage(payload.message)
        scanResult = scan

        if (scan.flagged) {
          await db.execute(sql`
            UPDATE communications
            SET
              ai_scanned  = true,
              ai_flagged  = ${scan.flagged},
              ai_severity = ${scan.severity},
              ai_reason   = ${scan.reason},
              ai_excerpt  = ${scan.excerpt}
            WHERE metadata->>'myrepchatMessageId' = ${payload.message_id}
              AND tenant_id = ${tenantId}
          `)

          if (scan.severity === 'high') {
            await db.insert(complianceItems).values({
              tenantId,
              clientId,
              itemType:    'communication_flagged',
              severity:    'critical',
              title:       `High severity SMS flag — ${scan.reason}`,
              description: scan.excerpt ?? undefined,
              sourceType:  'communication',
            })
          }
        }
      } catch (err) {
        console.error('[MyRepChat AI scan failed]', err)
      }
    })()
  }

  // Write to our communications table
  const [message] = await db.insert(communications).values({
    tenantId,
    threadId:      payload.conversation_id,
    clientId,
    fromUserId:    payload.direction === 'outbound' ? userId : null,
    channel:       'sms',                    // ← SMS via MyRepChat
    direction:     payload.direction,
    body:          payload.message,
    bodyEncrypted: Buffer.from(payload.message).toString('base64'),
    aiScanned:     payload.direction !== 'outbound', // inbound not scanned
    aiFlagged:     false,
    metadata: {
      myrepchatMessageId:      payload.message_id,
      myrepchatConversationId: payload.conversation_id,
      advisorPhone:            payload.advisor_phone,
      contactPhone:            payload.contact_phone,
      source:                  'myrepchat',
    },
  } as any).returning()

  // Write audit log
  await writeAudit(
    { tenantId, userId, ipAddress: request.headers.get('x-forwarded-for') ?? undefined },
    {
      skillSlug:  'messaging',
      action:     AUDIT_ACTIONS.MSG_SENT,
      entityType: 'client',
      entityId:   clientId,
      nextState: {
        messageId:  message.id,
        channel:    'sms',
        source:     'myrepchat',
        direction:  payload.direction,
        bodyLength: payload.message.length,
      },
    }
  )

  return NextResponse.json({
    status:     'ingested',
    messageId:  message.id,
    clientId,
  })
}
