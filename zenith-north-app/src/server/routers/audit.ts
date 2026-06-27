/**
 * ZENITH NORTH — Audit Router
 *
 * Real audit log queries wired to the database.
 * Every write in the system goes through writeAudit().
 * This router reads it back for:
 *   - The audit center log viewer
 *   - Exam package generation
 *   - Client timeline on Client 360
 *   - Compliance reporting
 */

import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '@/lib/trpc'
import { db, auditLog, clients, communications, documents, workflowRuns } from '@/lib/db'
import { writeAudit } from '@/lib/audit'
import { eq, and, desc, asc, gte, lte, like, or, inArray, sql, isNull } from 'drizzle-orm'

// ── Types ─────────────────────────────────────────────────

type AuditEntry = typeof auditLog.$inferSelect

// ── Exam package builder ───────────────────────────────────

async function buildExamPackage(
  tenantId:  string,
  clientId?: string,
  dateFrom?: Date,
  dateTo?:   Date
) {
  const now = new Date()
  const from = dateFrom ?? new Date(now.getFullYear() - 5, 0, 1)
  const to   = dateTo   ?? now

  // Build conditions
  const baseConditions = [
    eq(auditLog.tenantId, tenantId),
    gte(auditLog.createdAt, from),
    lte(auditLog.createdAt, to),
  ]

  // Gather all records in parallel
  const [
    auditEntries,
    allComms,
    allDocs,
    workflowActivity,
    clientData,
  ] = await Promise.all([
    // Audit log entries
    db.query.auditLog.findMany({
      where: and(
        ...baseConditions,
        clientId ? eq(auditLog.entityId, clientId) : undefined,
      ),
      orderBy: asc(auditLog.createdAt),
      limit:   10000,
    }),

    // Communications
    db.query.communications.findMany({
      where: and(
        eq(communications.tenantId, tenantId),
        isNull(communications.archivedAt),
        clientId ? eq(communications.clientId, clientId) : undefined,
        gte(communications.createdAt, from),
        lte(communications.createdAt, to),
      ),
      orderBy: asc(communications.createdAt),
    }),

    // Documents
    db.query.documents.findMany({
      where: and(
        eq(documents.tenantId, tenantId),
        isNull(documents.archivedAt),
        clientId ? eq(documents.clientId, clientId) : undefined,
      ),
      orderBy: asc(documents.createdAt),
    }),

    // Workflow runs
    db.query.workflowRuns.findMany({
      where: and(
        eq(workflowRuns.tenantId, tenantId),
        clientId ? eq(workflowRuns.entityId, clientId) : undefined,
      ),
      orderBy: asc(workflowRuns.startedAt),
    }),

    // Client data if specific client
    clientId ? db.query.clients.findFirst({
      where: and(
        eq(clients.id, clientId),
        eq(clients.tenantId, tenantId),
      ),
      orderBy: desc(clients.version),
    }) : Promise.resolve(null),
  ])

  // Communications by channel
  const commsByChannel: Record<string, number> = {}
  for (const comm of allComms) {
    commsByChannel[comm.channel] = (commsByChannel[comm.channel] ?? 0) + 1
  }

  // Flag review status
  const flaggedComms   = allComms.filter(c => c.aiFlagged)
  const reviewedFlags  = flaggedComms.filter(c => c.reviewedAt)
  const pendingFlags   = flaggedComms.filter(c => !c.reviewedAt)

  // Signed documents
  const signedDocs   = allDocs.filter(d => d.signedAt)
  const unsignedDocs = allDocs.filter(d => !d.signedAt && d.docType !== 'meeting_recording')

  return {
    generatedAt: now.toISOString(),
    period: { from: from.toISOString(), to: to.toISOString() },
    client: clientData ? {
      id:        clientData.id,
      name:      `${(clientData.data as any).firstName} ${(clientData.data as any).lastName}`,
      email:     (clientData.data as any).email,
      status:    (clientData.data as any).status,
      kycStatus: (clientData.data as any).kycStatus,
    } : null,

    summary: {
      totalAuditEntries:     auditEntries.length,
      totalCommunications:   allComms.length,
      totalDocuments:        allDocs.length,
      signedDocuments:       signedDocs.length,
      unsignedDocuments:     unsignedDocs.length,
      totalWorkflowRuns:     workflowActivity.length,
      flaggedCommunications: flaggedComms.length,
      reviewedFlags:         reviewedFlags.length,
      pendingFlags:          pendingFlags.length,
      commsByChannel,
    },

    // The actual records — what examiners want to see
    auditLog:       auditEntries,
    communications: allComms.map(c => ({
      id:        c.id,
      channel:   c.channel,
      direction: c.direction,
      subject:   c.subject,
      body:      c.body,   // unencrypted body for exam package
      aiFlagged: c.aiFlagged,
      aiSeverity: c.aiSeverity,
      aiReason:  c.aiReason,
      reviewedAt: c.reviewedAt,
      createdAt:  c.createdAt,
    })),
    documents: allDocs.map(d => ({
      id:       d.id,
      name:     d.name,
      docType:  d.docType,
      signedAt: d.signedAt,
      createdAt: d.createdAt,
    })),
    workflows: workflowActivity,
  }
}

// ── Router ────────────────────────────────────────────────

export const auditRouter = router({

  /**
   * List audit log entries — paginated, filterable.
   * Used by the audit center log viewer.
   */
  listEntries: adminProcedure
    .input(z.object({
      skillSlug: z.string().optional(),
      entityType: z.string().optional(),
      entityId:  z.string().uuid().optional(),
      search:    z.string().optional(),
      dateFrom:  z.string().optional(),
      dateTo:    z.string().optional(),
      limit:     z.number().min(1).max(500).default(100),
      offset:    z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(auditLog.tenantId, ctx.tenant.id),
        input.skillSlug  ? eq(auditLog.skillSlug,  input.skillSlug)  : undefined,
        input.entityType ? eq(auditLog.entityType, input.entityType) : undefined,
        input.entityId   ? eq(auditLog.entityId,   input.entityId)   : undefined,
        input.dateFrom   ? gte(auditLog.createdAt, new Date(input.dateFrom)) : undefined,
        input.dateTo     ? lte(auditLog.createdAt, new Date(input.dateTo))   : undefined,
        input.search     ? or(
          like(auditLog.action,     `%${input.search}%`),
          like(auditLog.entityType, `%${input.search}%`),
        ) : undefined,
      ].filter(Boolean) as any[]

      const [entries, countResult] = await Promise.all([
        db.query.auditLog.findMany({
          where:   and(...conditions),
          orderBy: desc(auditLog.createdAt),
          limit:   input.limit,
          offset:  input.offset,
        }),
        db.execute(sql`
          SELECT COUNT(*) as count FROM audit_log
          WHERE tenant_id = ${ctx.tenant.id}
        `),
      ])

      return {
        entries,
        total:  Number((countResult.rows[0] as any).count),
        limit:  input.limit,
        offset: input.offset,
      }
    }),

  /**
   * Get all audit entries for a specific entity.
   * Used by the Client 360 activity timeline.
   */
  getEntityHistory: protectedProcedure
    .input(z.object({
      entityType: z.string(),
      entityId:   z.string().uuid(),
      limit:      z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      return db.query.auditLog.findMany({
        where: and(
          eq(auditLog.tenantId,  ctx.tenant.id),
          eq(auditLog.entityType, input.entityType),
          eq(auditLog.entityId,   input.entityId),
        ),
        orderBy: desc(auditLog.createdAt),
        limit:   input.limit,
      })
    }),

  /**
   * Generate a complete exam package.
   * One click — produces every record an SEC examiner would request.
   */
  generateExamPackage: adminProcedure
    .input(z.object({
      clientId: z.string().uuid().optional(),
      dateFrom: z.string().optional(),
      dateTo:   z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const pkg = await buildExamPackage(
        ctx.tenant.id,
        input.clientId,
        input.dateFrom ? new Date(input.dateFrom) : undefined,
        input.dateTo   ? new Date(input.dateTo)   : undefined,
      )

      // Write audit log for the package generation itself
      await writeAudit(ctx.auditCtx, {
        skillSlug:  'audit',
        action:     'audit.exam_package_generated',
        entityType: input.clientId ? 'client' : 'tenant',
        entityId:   input.clientId ?? ctx.tenant.id,
        metadata: {
          period:       pkg.period,
          totalRecords: pkg.summary.totalAuditEntries,
          requestedBy:  ctx.user.id,
        },
      })

      return pkg
    }),

  /**
   * Summary stats for the audit center dashboard.
   */
  summary: adminProcedure
    .query(async ({ ctx }) => {
      const [total, today, flagged, skills] = await Promise.all([
        // Total audit entries ever
        db.execute(sql`
          SELECT COUNT(*) as count FROM audit_log
          WHERE tenant_id = ${ctx.tenant.id}
        `),

        // Entries today
        db.execute(sql`
          SELECT COUNT(*) as count FROM audit_log
          WHERE tenant_id = ${ctx.tenant.id}
            AND created_at >= CURRENT_DATE
        `),

        // Unreviewed compliance flags
        db.execute(sql`
          SELECT COUNT(*) as count FROM communications
          WHERE tenant_id = ${ctx.tenant.id}
            AND ai_flagged = true
            AND reviewed_at IS NULL
        `),

        // Breakdown by skill
        db.execute(sql`
          SELECT skill_slug, COUNT(*) as count
          FROM audit_log
          WHERE tenant_id = ${ctx.tenant.id}
          GROUP BY skill_slug
          ORDER BY count DESC
        `),
      ])

      return {
        totalEntries:   Number((total.rows[0] as any).count),
        entriesToday:   Number((today.rows[0] as any).count),
        unreviewedFlags: Number((flagged.rows[0] as any).count),
        bySkill: (skills.rows as Array<{ skill_slug: string; count: string }>).map(r => ({
          skill: r.skill_slug,
          count: Number(r.count),
        })),
      }
    }),
})
