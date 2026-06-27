/**
 * ZENITH NORTH — Compliance Router
 *
 * Handles:
 *   - Compliance dashboard data
 *   - Item resolution / snoozing
 *   - Policy engine checks
 *   - Filing calendar
 */

import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '@/lib/trpc'
import { db, complianceItems, calendarEvents } from '@/lib/db'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { eq, and, isNull, or, lt, gte, sql, desc } from 'drizzle-orm'

export const complianceRouter = router({

  /**
   * Dashboard — all open items + stats + upcoming filings.
   * This is the main compliance view query.
   */
  dashboard: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenant.id
      const now = new Date()

      const [items, filings, clientCountResult] = await Promise.all([
        // All open compliance items (not resolved, not snoozed)
        db.query.complianceItems.findMany({
          where: (c, { eq, and, isNull, or, lt }) => and(
            eq(c.tenantId, tenantId),
            isNull(c.resolvedAt),
            or(
              isNull(c.snoozedUntil),
              lt(c.snoozedUntil, now),
            ),
          ),
          orderBy: (c, { asc, sql }) => [
            // Critical first, then warning, then info
            sql`CASE severity
              WHEN 'critical' THEN 1
              WHEN 'warning'  THEN 2
              ELSE 3
            END`,
            asc(c.dueAt),
          ],
        }),

        // Upcoming SEC filing deadlines
        db.query.calendarEvents.findMany({
          where: (e, { eq, and, isNull, gte }) => and(
            eq(e.tenantId, tenantId),
            eq(e.eventType, 'compliance'),
            isNull(e.completedAt),
            gte(e.dueAt, now),
          ),
          orderBy: (e, { asc }) => [asc(e.dueAt)],
          limit: 10,
        }),

        // Active client count
        db.execute(sql`
          SELECT COUNT(DISTINCT id) as count
          FROM clients
          WHERE tenant_id = ${tenantId}
            AND archived_at IS NULL
            AND data->>'status' = 'active'
        `),
      ])

      // Stats
      const stats = {
        critical: items.filter(i => i.severity === 'critical').length,
        warning:  items.filter(i => i.severity === 'warning').length,
        info:     items.filter(i => i.severity === 'info').length,
        byType: {
          annualReview:    items.filter(i => i.itemType === 'annual_review_overdue').length,
          missingDoc:      items.filter(i => i.itemType === 'missing_document').length,
          missingSig:      items.filter(i => i.itemType === 'missing_signature').length,
          commsFlagged:    items.filter(i => i.itemType === 'communication_flagged').length,
          workflowStalled: items.filter(i => i.itemType === 'workflow_stalled').length,
          kycExpired:      items.filter(i => i.itemType === 'kyc_expired').length,
        },
      }

      const activeClients = Number((clientCountResult.rows[0] as any).count)

      return { items, filings, stats, activeClients }
    }),

  /**
   * Resolve a compliance item.
   * Writes audit log entry.
   */
  resolve: adminProcedure
    .input(z.object({
      id:    z.string().uuid(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [resolved] = await db
        .update(complianceItems)
        .set({
          resolvedAt: new Date(),
          resolvedBy: ctx.user.id,
        })
        .where(and(
          eq(complianceItems.id, input.id),
          eq(complianceItems.tenantId, ctx.tenant.id),
        ))
        .returning()

      await writeAudit(ctx.auditCtx, {
        skillSlug:  'compliance',
        action:     AUDIT_ACTIONS.CI_RESOLVED,
        entityType: 'compliance_item',
        entityId:   input.id,
        metadata:   { notes: input.notes },
      })

      return resolved
    }),

  /**
   * Snooze a compliance item.
   * CCO can acknowledge and defer for up to 14 days.
   */
  snooze: adminProcedure
    .input(z.object({
      id:      z.string().uuid(),
      days:    z.number().min(1).max(14),
      reason:  z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const snoozedUntil = new Date()
      snoozedUntil.setDate(snoozedUntil.getDate() + input.days)

      const [snoozed] = await db
        .update(complianceItems)
        .set({ snoozedUntil })
        .where(and(
          eq(complianceItems.id, input.id),
          eq(complianceItems.tenantId, ctx.tenant.id),
        ))
        .returning()

      await writeAudit(ctx.auditCtx, {
        skillSlug:  'compliance',
        action:     AUDIT_ACTIONS.CI_SNOOZED,
        entityType: 'compliance_item',
        entityId:   input.id,
        metadata:   { days: input.days, reason: input.reason, snoozedUntil },
      })

      return snoozed
    }),

  /**
   * Policy check — called before any workflow step advances.
   * Returns whether the step is allowed and what's blocking it.
   */
  checkPolicy: protectedProcedure
    .input(z.object({
      runId:      z.string().uuid(),
      stepId:     z.string().uuid(),
      actorType:  z.enum(['advisor', 'client', 'system']),
    }))
    .query(async ({ ctx, input }) => {
      const { runId, stepId, actorType } = input
      const tenantId = ctx.tenant.id

      const [run, step, allSteps, completions] = await Promise.all([
        db.query.workflowRuns.findFirst({
          where: (r, { eq }) => eq(r.id, runId),
        }),
        db.query.workflowSteps.findFirst({
          where: (s, { eq }) => eq(s.id, stepId),
        }),
        db.query.workflowSteps.findMany({
          where: (s, { eq }) => eq(s.workflowId,
            db.query.workflowRuns.findFirst({
              where: (r, { eq }) => eq(r.id, runId),
            }).then(r => r?.workflowId ?? '')
          ),
          orderBy: (s, { asc }) => [asc(s.sortOrder)],
        }),
        db.query.workflowStepCompletions.findMany({
          where: (c, { eq }) => eq(c.runId, runId),
        }),
      ])

      if (!run || !step) {
        return { allowed: false, blockers: [{ type: 'not_found', message: 'Workflow or step not found' }] }
      }

      const blockers: Array<{ type: string; message: string; stepId?: string }> = []

      // Rule 1: All prior required steps must be complete
      const priorRequired = allSteps.filter(
        s => s.sortOrder < step.sortOrder && s.required
      )
      for (const prior of priorRequired) {
        const completion = completions.find(c => c.stepId === prior.id)
        if (!completion || completion.status !== 'complete') {
          blockers.push({
            type:    'prior_step_incomplete',
            message: `"${prior.name}" must be completed first`,
            stepId:  prior.id,
          })
        }
      }

      // Rule 2: Actor must match step assignee
      const stepConfig = step.config as Record<string, unknown>
      if (stepConfig.portal === true && actorType !== 'client') {
        blockers.push({
          type:    'wrong_actor',
          message: 'This step must be completed by the client via their portal',
        })
      }

      return {
        allowed: blockers.length === 0,
        blockers,
        skip: false,
      }
    }),
})
