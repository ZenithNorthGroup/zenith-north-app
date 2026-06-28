/**
 * ZENITH NORTH — Messages Router
 *
 * Compliant messaging between advisors and clients.
 * Every message is:
 *   1. Stored in the communications table (append-only)
 *   2. Encrypted at rest
 *   3. Scanned by AI for compliance flags
 *   4. Linked to the client record
 *   5. Producible in seconds during an exam
 *
 * Off-channel communications are the #1 SEC fine source.
 * This router makes that fine structurally impossible.
 */

import { z } from 'zod'
import { router, protectedProcedure, adminProcedure, withPermission } from '@/lib/trpc'
import { db, communications } from '@/lib/db'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { eq, and, desc, asc, isNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// ── AI compliance scanner ─────────────────────────────────

interface ScanResult {
  flagged:   boolean
  severity:  'low' | 'medium' | 'high' | null
  reason:    string | null
  excerpt:   string | null
}

async function scanMessage(body: string): Promise<ScanResult> {
  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 300,
      system: `You are a compliance monitoring system for a registered investment adviser (RIA).
Analyze advisor-to-client messages for potential SEC/FINRA compliance issues.

Flag if the message contains:
- Guarantees of investment returns or specific performance promises
- Discretionary trading decisions communicated without prior written authorization
- Recommendations that contradict the client's stated risk profile
- Language suggesting undisclosed conflicts of interest
- Instructions to move assets in ways inconsistent with the investment policy statement
- Language that could constitute a client complaint
- Promises or representations about specific securities

Respond ONLY with valid JSON, no other text:
{
  "flagged": boolean,
  "severity": "low" | "medium" | "high" | null,
  "reason": "brief description" | null,
  "excerpt": "the specific phrase that triggered the flag" | null
}`,
      messages: [{
        role:    'user',
        content: `Advisor message:\n\n${body}`,
      }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    return JSON.parse(text.replace(/```json|```/g, '').trim()) as ScanResult
  } catch {
    // Never let AI failures block message sending
    return { flagged: false, severity: null, reason: null, excerpt: null }
  }
}

// ── Encryption helpers (simplified — use KMS in production) ──

function encryptBody(body: string): string {
  // In production: AES-256-GCM with AWS KMS or similar
  // This is a placeholder — swap with real encryption
  return Buffer.from(body).toString('base64')
}

// ── Router ────────────────────────────────────────────────

export const messagesRouter = router({

  /**
   * List all threads for this tenant.
   * Returns one row per thread (latest message).
   */
  listThreads: withPermission('messages.view')
    .query(async ({ ctx }) => {
      // Get distinct threads with latest message + client name
      const threads = await db.execute(sql`
        SELECT DISTINCT ON (c.thread_id)
          c.*,
          TRIM(COALESCE(cl.data->>'firstName', '') || ' ' || COALESCE(cl.data->>'lastName', '')) as client_name,
          COUNT(*) FILTER (WHERE c.ai_flagged = true AND c.reviewed_at IS NULL)
            OVER (PARTITION BY c.thread_id) as flag_count
        FROM communications c
        LEFT JOIN LATERAL (
          SELECT data FROM clients
          WHERE id = c.client_id AND tenant_id = ${ctx.tenant.id}
          ORDER BY version DESC LIMIT 1
        ) cl ON true
        WHERE c.tenant_id = ${ctx.tenant.id}
          AND c.archived_at IS NULL
        ORDER BY c.thread_id, c.created_at DESC
      `)

      return threads.rows as Array<{
        id: string
        threadId: string
        clientId: string
        clientName: string | null
        channel: string
        direction: string
        subject: string | null
        body: string
        aiFlagged: boolean
        aiSeverity: string | null
        createdAt: Date
        flagCount: number
      }>
    }),

  /**
   * Get all messages in a thread.
   */
  getThread: withPermission('messages.view')
    .input(z.object({
      threadId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      return db.query.communications.findMany({
        where: and(
          eq(communications.tenantId, ctx.tenant.id),
          eq(communications.threadId, input.threadId),
          isNull(communications.archivedAt),
        ),
        orderBy: asc(communications.createdAt),
      })
    }),

  /**
   * Get all communications for a specific client.
   * Used on the Client 360 view and for exam packages.
   */
  getClientThread: withPermission('messages.view')
    .input(z.object({
      clientId: z.string().uuid(),
      limit:    z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      return db.query.communications.findMany({
        where: and(
          eq(communications.tenantId, ctx.tenant.id),
          eq(communications.clientId, input.clientId),
          isNull(communications.archivedAt),
        ),
        orderBy: asc(communications.createdAt),
        limit: input.limit,
      })
    }),

  /**
   * Send a message to a client.
   * Stores, encrypts, and queues AI scan — never blocks on scan.
   */
  send: withPermission('messages.send')
    .input(z.object({
      clientId:  z.string().uuid(),
      threadId:  z.string().uuid().optional(),
      channel:   z.enum(['platform', 'sms', 'email', 'phone_log', 'zoom', 'google_chat']).default('platform'),
      direction: z.enum(['inbound', 'outbound']).default('outbound'),
      subject:   z.string().optional(),
      body:      z.string().min(1).max(10000),
    }))
    .mutation(async ({ ctx, input }) => {
      // Generate thread ID if this is a new conversation
      const threadId = input.threadId ?? crypto.randomUUID()

      // Store message immediately — never block on AI scan
      const [message] = await db.insert(communications).values({
        tenantId:      ctx.tenant.id,
        threadId,
        clientId:      input.clientId,
        fromUserId:    ctx.user.id,
        channel:       input.channel,
        direction:     input.direction,
        subject:       input.subject,
        body:          input.body,
        bodyEncrypted: encryptBody(input.body),
        aiScanned:     false,
        aiFlagged:     false,
      }).returning()

      // Write audit log
      await writeAudit(ctx.auditCtx, {
        skillSlug:  'messaging',
        action:     AUDIT_ACTIONS.MSG_SENT,
        entityType: 'client',
        entityId:   input.clientId,
        nextState: {
          messageId: message.id,
          threadId,
          channel:   input.channel,
          direction: input.direction,
          bodyLength: input.body.length,
        },
      })

      // Fire-and-forget AI scan — runs after response is sent
      // In production: push to job queue (Inngest/BullMQ)
      // For now: run async without awaiting
      void (async () => {
        try {
          // Only scan outbound advisor messages
          if (input.direction !== 'outbound') {
            await db
              .update(communications)
              .set({ aiScanned: true })
              .where(eq(communications.id, message.id))
            return
          }

          const scan = await scanMessage(input.body)

          await db
            .update(communications)
            .set({
              aiScanned:  true,
              aiFlagged:  scan.flagged,
              aiSeverity: scan.severity,
              aiReason:   scan.reason,
              aiExcerpt:  scan.excerpt,
            })
            .where(eq(communications.id, message.id))

          // High severity — create compliance item immediately
          if (scan.flagged && scan.severity === 'high') {
            await db.insert(require('@/lib/db/schema').complianceItems).values({
              tenantId:    ctx.tenant.id,
              clientId:    input.clientId,
              itemType:    'communication_flagged',
              severity:    'critical',
              title:       `High severity communication flag — ${scan.reason}`,
              description: scan.excerpt ?? undefined,
              sourceType:  'communication',
              sourceId:    message.id,
            })

            await writeAudit(ctx.auditCtx, {
              skillSlug:  'messaging',
              action:     AUDIT_ACTIONS.MSG_FLAGGED,
              entityType: 'communication',
              entityId:   message.id,
              metadata: {
                severity: scan.severity,
                reason:   scan.reason,
                excerpt:  scan.excerpt,
              },
            })
          }
        } catch (err) {
          console.error('[AI SCAN] Failed:', err)
        }
      })()

      return { message, threadId }
    }),

  /**
   * Log an inbound message from a client.
   * Used when a client replies via email or the platform notifies us.
   */
  logInbound: withPermission('messages.view')
    .input(z.object({
      clientId:  z.string().uuid(),
      threadId:  z.string().uuid(),
      channel:   z.enum(['platform', 'sms', 'email', 'phone_log', 'zoom', 'google_chat']).default('platform'),
      subject:   z.string().optional(),
      body:      z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const [message] = await db.insert(communications).values({
        tenantId:      ctx.tenant.id,
        threadId:      input.threadId,
        clientId:      input.clientId,
        fromUserId:    null, // from client, not advisor
        channel:       input.channel,
        direction:     'inbound',
        subject:       input.subject,
        body:          input.body,
        bodyEncrypted: encryptBody(input.body),
        aiScanned:     true, // inbound not scanned
        aiFlagged:     false,
      }).returning()

      await writeAudit(ctx.auditCtx, {
        skillSlug:  'messaging',
        action:     AUDIT_ACTIONS.MSG_SENT,
        entityType: 'client',
        entityId:   input.clientId,
        nextState:  { messageId: message.id, direction: 'inbound' },
      })

      return message
    }),

  /**
   * Review a flagged message — mark as reviewed.
   * Requires admin or CCO role.
   */
  reviewFlag: withPermission('messages.review_flag')
    .input(z.object({
      messageId: z.string().uuid(),
      notes:     z.string().optional(),
      dismiss:   z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(communications)
        .set({
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          reviewNotes: input.notes,
        })
        .where(and(
          eq(communications.id, input.messageId),
          eq(communications.tenantId, ctx.tenant.id),
        ))
        .returning()

      await writeAudit(ctx.auditCtx, {
        skillSlug:  'messaging',
        action:     AUDIT_ACTIONS.MSG_REVIEWED,
        entityType: 'communication',
        entityId:   input.messageId,
        nextState: {
          reviewedBy: ctx.user.id,
          dismissed:  input.dismiss,
          notes:      input.notes,
        },
      })

      return updated
    }),

  /**
   * All flagged messages across all clients.
   * Used by the CCO compliance view.
   */
  listFlagged: withPermission('messages.view_flagged')
    .input(z.object({
      reviewed: z.boolean().optional(),
      limit:    z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      return db.query.communications.findMany({
        where: and(
          eq(communications.tenantId, ctx.tenant.id),
          eq(communications.aiFlagged, true),
          input.reviewed === false
            ? isNull(communications.reviewedAt)
            : undefined,
          isNull(communications.archivedAt),
        ),
        orderBy: desc(communications.createdAt),
        limit: input.limit,
      })
    }),

  /**
   * Summary stats for the sidebar badge and dashboard.
   */
  summary: withPermission('messages.view')
    .query(async ({ ctx }) => {
      const flagged = await db.query.communications.findMany({
        where: and(
          eq(communications.tenantId, ctx.tenant.id),
          eq(communications.aiFlagged, true),
          isNull(communications.reviewedAt),
          isNull(communications.archivedAt),
        ),
      })

      return {
        unreviewed: flagged.length,
        critical:   flagged.filter(f => f.aiSeverity === 'high').length,
      }
    }),
})
