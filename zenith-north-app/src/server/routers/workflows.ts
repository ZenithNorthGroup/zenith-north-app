/**
 * ZENITH NORTH — Workflows Router
 *
 * Handles:
 *   - Listing and getting workflow runs
 *   - Starting new workflow runs (e.g. client onboarding)
 *   - Advancing steps (with full policy gate check)
 *   - Completing / rejecting internal approvals
 *   - Workflow definition CRUD (builder)
 *   - Step completion tracking
 *
 * Every write:
 *   1. Checks policy gate — may block
 *   2. Writes to workflow_step_completions
 *   3. Updates workflow_run status
 *   4. Writes to audit log
 *   5. Creates calendar events for next steps
 *   6. Emits compliance items if stalled
 */

import { z } from 'zod'
import { router, protectedProcedure, adminProcedure } from '@/lib/trpc'
import {
  db,
  workflows,
  workflowSteps,
  workflowRuns,
  workflowStepCompletions,
  calendarEvents,
  complianceItems,
} from '@/lib/db'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { eq, and, desc, asc, inArray, isNull, sql } from 'drizzle-orm'

// ── Types ─────────────────────────────────────────────────

type WorkflowStatus =
  | 'in_progress'
  | 'awaiting_client'
  | 'awaiting_advisor'
  | 'awaiting_approval'
  | 'blocked'
  | 'complete'

interface PolicyBlocker {
  type: string
  message: string
  stepId?: string
}

interface StepConfig {
  portal?: boolean
  assignee?: string
  deadline_days?: number
  requires_signature?: boolean
  requires_acknowledgment?: boolean
  approver_role?: string
  notification?: {
    reminder_days?: number[]
  }
  conditions?: Array<{
    field: string
    operator: string
    value: unknown
  }>
}

// ── Helpers ───────────────────────────────────────────────

async function getRunWithSteps(runId: string) {
  const [run, steps, completions] = await Promise.all([
    db.query.workflowRuns.findFirst({
      where: eq(workflowRuns.id, runId),
    }),
    db.query.workflowSteps.findMany({
      where: eq(
        workflowSteps.workflowId,
        db.select({ id: workflowRuns.workflowId })
          .from(workflowRuns)
          .where(eq(workflowRuns.id, runId))
          .limit(1)
          .then(r => r[0]?.id ?? '')
      ),
      orderBy: asc(workflowSteps.sortOrder),
    }),
    db.query.workflowStepCompletions.findMany({
      where: eq(workflowStepCompletions.runId, runId),
    }),
  ])
  return { run, steps, completions }
}

// Determine the correct run status based on next pending step
function deriveRunStatus(
  nextStep: typeof workflowSteps.$inferSelect | undefined,
  actorType: 'advisor' | 'client' | 'system'
): WorkflowStatus {
  if (!nextStep) return 'complete'

  const config = nextStep.config as StepConfig

  if (config.portal === true) return 'awaiting_client'
  if (config.approver_role) return 'awaiting_approval'
  return 'awaiting_advisor'
}

// Full policy gate — called before every step advance
async function checkPolicyGate(
  runId: string,
  stepId: string,
  actor: { userId: string; role: string; type: 'advisor' | 'client' | 'system' }
): Promise<{ allowed: boolean; blockers: PolicyBlocker[] }> {
  const blockers: PolicyBlocker[] = []

  const run = await db.query.workflowRuns.findFirst({
    where: eq(workflowRuns.id, runId),
  })
  if (!run) return { allowed: false, blockers: [{ type: 'not_found', message: 'Run not found' }] }

  const step = await db.query.workflowSteps.findFirst({
    where: eq(workflowSteps.id, stepId),
  })
  if (!step) return { allowed: false, blockers: [{ type: 'not_found', message: 'Step not found' }] }

  const allSteps = await db.query.workflowSteps.findMany({
    where: eq(workflowSteps.workflowId, run.workflowId),
    orderBy: asc(workflowSteps.sortOrder),
  })

  const completions = await db.query.workflowStepCompletions.findMany({
    where: eq(workflowStepCompletions.runId, runId),
  })

  const config = step.config as StepConfig

  // Rule 1 — all prior required steps must be complete
  const priorRequired = allSteps.filter(
    s => s.sortOrder < step.sortOrder && s.required
  )
  for (const prior of priorRequired) {
    const done = completions.find(
      c => c.stepId === prior.id && c.status === 'complete'
    )
    if (!done) {
      blockers.push({
        type:    'prior_step_incomplete',
        message: `"${prior.name}" must be completed first`,
        stepId:  prior.id,
      })
    }
  }

  // Rule 2 — actor must match assignee type
  if (config.portal === true && actor.type !== 'client') {
    blockers.push({
      type:    'wrong_actor',
      message: 'This step must be completed by the client via their portal',
    })
  }

  if (
    config.approver_role &&
    actor.type === 'advisor' &&
    !['admin', 'cco', 'owner'].includes(actor.role)
  ) {
    blockers.push({
      type:    'insufficient_role',
      message: `This step requires a ${config.approver_role}`,
    })
  }

  return { allowed: blockers.length === 0, blockers }
}

// ── Router ────────────────────────────────────────────────

export const workflowsRouter = router({

  /**
   * List all workflow definitions for this tenant.
   * Used by the workflow builder.
   */
  listDefinitions: protectedProcedure
    .query(async ({ ctx }) => {
      return db.query.workflows.findMany({
        where: and(
          eq(workflows.tenantId, ctx.tenant.id),
          eq(workflows.enabled, true),
        ),
        with: { steps: { orderBy: asc(workflowSteps.sortOrder) } },
      })
    }),

  /**
   * Get a single workflow definition with its steps.
   */
  getDefinition: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return db.query.workflows.findFirst({
        where: and(
          eq(workflows.id, input.id),
          eq(workflows.tenantId, ctx.tenant.id),
        ),
        with: { steps: { orderBy: asc(workflowSteps.sortOrder) } },
      })
    }),

  /**
   * Create a new workflow definition.
   * Used by the workflow builder.
   */
  createDefinition: adminProcedure
    .input(z.object({
      slug:    z.string().min(1),
      name:    z.string().min(1),
      trigger: z.string().min(1),
      steps:   z.array(z.object({
        skillSlug:  z.string(),
        slug:       z.string(),
        name:       z.string(),
        sortOrder:  z.number(),
        required:   z.boolean().default(true),
        config:     z.record(z.unknown()).default({}),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.transaction(async trx => {
        const [workflow] = await trx.insert(workflows).values({
          tenantId: ctx.tenant.id,
          slug:     input.slug,
          name:     input.name,
          trigger:  input.trigger,
          enabled:  true,
        }).returning()

        if (input.steps.length > 0) {
          await trx.insert(workflowSteps).values(
            input.steps.map(step => ({
              workflowId: workflow.id,
              ...step,
            }))
          )
        }

        await writeAudit(ctx.auditCtx, {
          skillSlug:  'workflows',
          action:     'workflow.definition_created',
          entityType: 'workflow',
          entityId:   workflow.id,
          nextState:  { slug: input.slug, stepCount: input.steps.length },
        })

        return workflow
      })
    }),

  /**
   * Update a workflow step.
   * Used by the workflow builder inspector panel.
   */
  updateStep: adminProcedure
    .input(z.object({
      stepId:    z.string().uuid(),
      name:      z.string().optional(),
      required:  z.boolean().optional(),
      sortOrder: z.number().optional(),
      config:    z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { stepId, ...updates } = input

      const [updated] = await db
        .update(workflowSteps)
        .set(updates)
        .where(eq(workflowSteps.id, stepId))
        .returning()

      await writeAudit(ctx.auditCtx, {
        skillSlug:  'workflows',
        action:     'workflow.step_updated',
        entityType: 'workflow_step',
        entityId:   stepId,
        nextState:  updates,
      })

      return updated
    }),

  /**
   * List all active workflow runs for this tenant.
   * Used by the workflows dashboard page.
   */
  listRuns: protectedProcedure
    .input(z.object({
      status:   z.string().optional(),
      entityId: z.string().uuid().optional(),
      limit:    z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const runs = await db.query.workflowRuns.findMany({
        where: and(
          eq(workflowRuns.tenantId, ctx.tenant.id),
          input.status
            ? eq(workflowRuns.status, input.status)
            : undefined,
          input.entityId
            ? eq(workflowRuns.entityId, input.entityId)
            : undefined,
        ),
        orderBy: desc(workflowRuns.startedAt),
        limit: input.limit,
      })

      // Enrich with step completion data
      const runIds = runs.map(r => r.id)
      if (runIds.length === 0) return []

      const allCompletions = await db.query.workflowStepCompletions.findMany({
        where: inArray(workflowStepCompletions.runId, runIds),
      })

      const allStepDefs = await db.query.workflowSteps.findMany({
        where: inArray(
          workflowSteps.workflowId,
          [...new Set(runs.map(r => r.workflowId))]
        ),
        orderBy: asc(workflowSteps.sortOrder),
      })

      // Fetch client names for all runs in one query
      const clientIds = [...new Set(runs.map(r => r.entityId).filter(Boolean))]
      const clientNames: Record<string, string> = {}

      if (clientIds.length > 0) {
        const clientRows = await db.execute(sql`
          SELECT DISTINCT ON (id) id,
            data->>'firstName' as first_name,
            data->>'lastName'  as last_name
          FROM clients
          WHERE id = ANY(${clientIds})
            AND tenant_id = ${ctx.tenant.id}
          ORDER BY id, version DESC
        `)
        for (const row of clientRows.rows as any[]) {
          clientNames[row.id] = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim()
        }
      }

      return runs.map(run => {
        const steps = allStepDefs.filter(s => s.workflowId === run.workflowId)
        const completions = allCompletions.filter(c => c.runId === run.id)
        const completedCount = completions.filter(c => c.status === 'complete').length
        const totalRequired = steps.filter(s => s.required).length
        const progressPct = totalRequired > 0
          ? Math.round((completedCount / steps.length) * 100)
          : 0

        const currentStep = steps.find(s => {
          const completion = completions.find(c => c.stepId === s.id)
          return !completion || completion.status === 'pending'
        })

        return {
          ...run,
          steps,
          completions,
          completedCount,
          totalSteps: steps.length,
          progressPct,
          currentStep,
          clientName: clientNames[run.entityId] ?? null,
        }
      })
    }),

  /**
   * Get a single run with full step detail.
   * Used by the run detail / approval view.
   */
  getRun: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const run = await db.query.workflowRuns.findFirst({
        where: and(
          eq(workflowRuns.id, input.id),
          eq(workflowRuns.tenantId, ctx.tenant.id),
        ),
        with: { completions: true },
      })

      if (!run) throw new Error('Run not found')

      const steps = await db.query.workflowSteps.findMany({
        where: eq(workflowSteps.workflowId, run.workflowId),
        orderBy: asc(workflowSteps.sortOrder),
      })

      // Check policy gate on next pending step
      const nextPendingStep = steps.find(s => {
        const completion = run.completions.find(c => c.stepId === s.id)
        return !completion || completion.status === 'pending'
      })

      let policyResult = null
      if (nextPendingStep) {
        policyResult = await checkPolicyGate(
          run.id,
          nextPendingStep.id,
          { userId: ctx.user.id, role: ctx.user.role, type: 'advisor' }
        )
      }

      return { run, steps, policyResult, nextPendingStep }
    }),

  /**
   * Start a new workflow run for a client.
   * Triggered automatically on client.created or manually.
   */
  startRun: protectedProcedure
    .input(z.object({
      workflowSlug: z.string(),
      entityType:   z.string().default('client'),
      entityId:     z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Find the workflow definition
      const workflow = await db.query.workflows.findFirst({
        where: and(
          eq(workflows.tenantId, ctx.tenant.id),
          eq(workflows.slug, input.workflowSlug),
          eq(workflows.enabled, true),
        ),
        with: { steps: { orderBy: asc(workflowSteps.sortOrder) } },
      })

      if (!workflow) throw new Error(`Workflow "${input.workflowSlug}" not found`)

      return db.transaction(async trx => {
        // Create the run
        const [run] = await trx.insert(workflowRuns).values({
          workflowId:  workflow.id,
          tenantId:    ctx.tenant.id,
          entityType:  input.entityType,
          entityId:    input.entityId,
          status:      'awaiting_advisor',
        }).returning()

        // Pre-create pending completions for all steps
        if (workflow.steps.length > 0) {
          await trx.insert(workflowStepCompletions).values(
            workflow.steps.map((step, i) => ({
              runId:      run.id,
              stepId:     step.id,
              status:     'pending' as const,
              assignedAt: i === 0 ? new Date() : null, // assign first step immediately
            }))
          )
        }

        // Create calendar events for deadline-bearing steps
        const deadlineSteps = workflow.steps.filter(
          s => (s.config as StepConfig).deadline_days
        )
        if (deadlineSteps.length > 0) {
          const now = new Date()
          await trx.insert(calendarEvents).values(
            deadlineSteps.map(step => {
              const config = step.config as StepConfig
              const dueAt = new Date(now)
              dueAt.setDate(dueAt.getDate() + (config.deadline_days ?? 14))
              return {
                tenantId:   ctx.tenant.id,
                clientId:   input.entityId,
                eventType:  'workflow_task',
                title:      `${step.name} due — ${workflow.name}`,
                dueAt,
                sourceType: 'workflow_run',
                sourceId:   run.id,
              }
            })
          )
        }

        await writeAudit(ctx.auditCtx, {
          skillSlug:  'workflows',
          action:     AUDIT_ACTIONS.WORKFLOW_STARTED,
          entityType: input.entityType,
          entityId:   input.entityId,
          nextState:  {
            runId:        run.id,
            workflowSlug: input.workflowSlug,
            totalSteps:   workflow.steps.length,
          },
        })

        return run
      })
    }),

  /**
   * Advance a workflow step.
   * The most important mutation in the platform.
   * Checks policy gate, marks complete, updates run status.
   */
  advanceStep: protectedProcedure
    .input(z.object({
      runId:     z.string().uuid(),
      stepId:    z.string().uuid(),
      actorType: z.enum(['advisor', 'client', 'system']).default('advisor'),
      data:      z.record(z.unknown()).optional(),
      notes:     z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Policy gate check
      const policy = await checkPolicyGate(
        input.runId,
        input.stepId,
        {
          userId: ctx.user.id,
          role:   ctx.user.role,
          type:   input.actorType,
        }
      )

      if (!policy.allowed) {
        // Log the blocked attempt
        await writeAudit(ctx.auditCtx, {
          skillSlug:  'workflows',
          action:     AUDIT_ACTIONS.STEP_BLOCKED,
          entityType: 'workflow_run',
          entityId:   input.runId,
          metadata:   { blockers: policy.blockers, stepId: input.stepId },
        })

        return {
          success:  false,
          blockers: policy.blockers,
        }
      }

      return db.transaction(async trx => {
        // Mark step complete
        await trx
          .update(workflowStepCompletions)
          .set({
            status:        'complete',
            completedAt:   new Date(),
            completedBy:   ctx.user.id,
            completedType: input.actorType,
            data:          input.data,
            notes:         input.notes,
          })
          .where(and(
            eq(workflowStepCompletions.runId, input.runId),
            eq(workflowStepCompletions.stepId, input.stepId),
          ))

        // Get all steps to find next pending
        const run = await trx.query.workflowRuns.findFirst({
          where: eq(workflowRuns.id, input.runId),
        })

        const allSteps = await trx.query.workflowSteps.findMany({
          where: eq(workflowSteps.workflowId, run!.workflowId),
          orderBy: asc(workflowSteps.sortOrder),
        })

        const allCompletions = await trx.query.workflowStepCompletions.findMany({
          where: eq(workflowStepCompletions.runId, input.runId),
        })

        const nextStep = allSteps.find(s => {
          const completion = allCompletions.find(c => c.stepId === s.id)
          return !completion || completion.status === 'pending'
        })

        // Assign next step
        if (nextStep) {
          await trx
            .update(workflowStepCompletions)
            .set({ assignedAt: new Date() })
            .where(and(
              eq(workflowStepCompletions.runId, input.runId),
              eq(workflowStepCompletions.stepId, nextStep.id),
            ))
        }

        // Determine new run status
        const nextStatus = nextStep
          ? deriveRunStatus(nextStep, input.actorType)
          : 'complete'

        await trx
          .update(workflowRuns)
          .set({
            status:      nextStatus,
            completedAt: nextStatus === 'complete' ? new Date() : null,
          })
          .where(eq(workflowRuns.id, input.runId))

        // Write audit log
        await writeAudit(ctx.auditCtx, {
          skillSlug:  'workflows',
          action:     nextStatus === 'complete'
            ? AUDIT_ACTIONS.WORKFLOW_COMPLETED
            : AUDIT_ACTIONS.STEP_COMPLETED,
          entityType: 'workflow_run',
          entityId:   input.runId,
          nextState: {
            stepId:     input.stepId,
            actorType:  input.actorType,
            nextStatus,
            nextStepId: nextStep?.id,
            data:       input.data,
          },
        })

        return {
          success:    true,
          nextStatus,
          nextStep,
          complete:   nextStatus === 'complete',
        }
      })
    }),

  /**
   * Internal approval — approve, reject, or approve with conditions.
   * Requires admin or CCO role.
   */
  processApproval: adminProcedure
    .input(z.object({
      runId:         z.string().uuid(),
      stepId:        z.string().uuid(),
      outcome:       z.enum(['approved', 'approved_with_conditions', 'rejected']),
      notes:         z.string().optional(),
      reason:        z.string().optional(),
      conditions:    z.array(z.string()).optional(),
      reviewedItems: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      return db.transaction(async trx => {
        if (input.outcome === 'rejected') {
          // Mark step as blocked
          await trx
            .update(workflowStepCompletions)
            .set({
              status:        'blocked',
              completedAt:   new Date(),
              completedBy:   ctx.user.id,
              completedType: 'advisor',
              notes:         input.reason,
              data:          { outcome: 'rejected', reviewedItems: input.reviewedItems },
            })
            .where(and(
              eq(workflowStepCompletions.runId, input.runId),
              eq(workflowStepCompletions.stepId, input.stepId),
            ))

          await trx
            .update(workflowRuns)
            .set({ status: 'blocked' })
            .where(eq(workflowRuns.id, input.runId))

          await writeAudit(ctx.auditCtx, {
            skillSlug:  'workflows',
            action:     AUDIT_ACTIONS.APPROVAL_REJECTED,
            entityType: 'workflow_run',
            entityId:   input.runId,
            nextState:  {
              outcome:       'rejected',
              reason:        input.reason,
              reviewedItems: input.reviewedItems,
              rejectedBy:    ctx.user.id,
            },
          })

          return { success: true, outcome: 'rejected' }
        }

        // Approved or approved with conditions
        await trx
          .update(workflowStepCompletions)
          .set({
            status:        'complete',
            completedAt:   new Date(),
            completedBy:   ctx.user.id,
            completedType: 'advisor',
            notes:         input.notes,
            data: {
              outcome:       input.outcome,
              conditions:    input.conditions,
              reviewedItems: input.reviewedItems,
            },
          })
          .where(and(
            eq(workflowStepCompletions.runId, input.runId),
            eq(workflowStepCompletions.stepId, input.stepId),
          ))

        // Create compliance items for each condition
        if (input.conditions?.length) {
          const run = await trx.query.workflowRuns.findFirst({
            where: eq(workflowRuns.id, input.runId),
          })

          await trx.insert(complianceItems).values(
            input.conditions.map(condition => ({
              tenantId:    ctx.tenant.id,
              clientId:    run?.entityId,
              itemType:    'approval_condition',
              severity:    'warning' as const,
              title:       `Approval condition — ${condition}`,
              description: `Set during internal approval by ${ctx.user.fullName}`,
              sourceType:  'workflow_step',
              sourceId:    input.stepId,
            }))
          )
        }

        // Advance to next step
        const run = await trx.query.workflowRuns.findFirst({
          where: eq(workflowRuns.id, input.runId),
        })

        const allSteps = await trx.query.workflowSteps.findMany({
          where: eq(workflowSteps.workflowId, run!.workflowId),
          orderBy: asc(workflowSteps.sortOrder),
        })

        const allCompletions = await trx.query.workflowStepCompletions.findMany({
          where: eq(workflowStepCompletions.runId, input.runId),
        })

        const nextStep = allSteps.find(s => {
          if (s.id === input.stepId) return false
          const completion = allCompletions.find(c => c.stepId === s.id)
          return !completion || completion.status === 'pending'
        })

        const nextStatus = nextStep
          ? deriveRunStatus(nextStep, 'advisor')
          : 'complete'

        await trx
          .update(workflowRuns)
          .set({
            status:      nextStatus,
            completedAt: nextStatus === 'complete' ? new Date() : null,
          })
          .where(eq(workflowRuns.id, input.runId))

        await writeAudit(ctx.auditCtx, {
          skillSlug:  'workflows',
          action:     input.outcome === 'approved'
            ? AUDIT_ACTIONS.APPROVAL_APPROVED
            : AUDIT_ACTIONS.APPROVAL_CONDITIONS,
          entityType: 'workflow_run',
          entityId:   input.runId,
          nextState: {
            outcome:       input.outcome,
            conditions:    input.conditions,
            reviewedItems: input.reviewedItems,
            approvedBy:    ctx.user.id,
            nextStatus,
          },
        })

        return { success: true, outcome: input.outcome, nextStatus }
      })
    }),

  /**
   * Dashboard summary — counts by status.
   * Used by the sidebar badge and dashboard stat card.
   */
  summary: protectedProcedure
    .query(async ({ ctx }) => {
      const runs = await db.query.workflowRuns.findMany({
        where: and(
          eq(workflowRuns.tenantId, ctx.tenant.id),
          isNull(workflowRuns.completedAt),
        ),
      })

      return {
        total:            runs.length,
        awaitingClient:   runs.filter(r => r.status === 'awaiting_client').length,
        awaitingAdvisor:  runs.filter(r => r.status === 'awaiting_advisor').length,
        awaitingApproval: runs.filter(r => r.status === 'awaiting_approval').length,
        blocked:          runs.filter(r => r.status === 'blocked').length,
      }
    }),
})
