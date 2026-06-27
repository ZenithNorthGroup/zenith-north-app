/**
 * POST /api/portal/step-complete
 *
 * Called by the client portal when a client completes a step.
 * This is a service-to-service call, authenticated with a shared secret.
 *
 * It advances the workflow step exactly like an advisor would,
 * but with actorType: 'client' so the audit log reflects the right actor.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db, workflowStepCompletions, workflowRuns } from '@/lib/db'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { eq, and, asc } from 'drizzle-orm'
import * as schema from '@/lib/db/schema'

export async function POST(request: NextRequest) {
  // Validate service-to-service token
  const serviceToken = request.headers.get('x-service-token')
  if (serviceToken !== process.env.SERVICE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    runId, stepId, clientId, tenantId,
    stepType, actorType, data,
  } = body

  // Set RLS context
  await db.execute(
    `SELECT set_config('app.tenant_id', '${tenantId}', false)`
  )

  // Mark step complete
  await db
    .update(workflowStepCompletions)
    .set({
      status:        'complete',
      completedAt:   new Date(),
      completedType: 'client',
      completedBy:   null,  // client, not a user
      data:          data,
      notes:         `Completed via client portal · Step: ${stepType}`,
    })
    .where(and(
      eq(workflowStepCompletions.runId, runId),
      eq(workflowStepCompletions.stepId, stepId),
    ))

  // Get workflow steps to find next
  const run = await db.query.workflowRuns.findFirst({
    where: eq(workflowRuns.id, runId),
  })

  if (run) {
    const allSteps = await db.query.workflowSteps.findMany({
      where: eq(schema.workflowSteps.workflowId, run.workflowId),
      orderBy: asc(schema.workflowSteps.sortOrder),
    })

    const allCompletions = await db.query.workflowStepCompletions.findMany({
      where: eq(workflowStepCompletions.runId, runId),
    })

    const nextStep = allSteps.find(s => {
      const completion = allCompletions.find(c => c.stepId === s.id)
      return !completion || completion.status === 'pending'
    })

    const nextStatus = nextStep
      ? (nextStep.config as any)?.portal === true
        ? 'awaiting_client'
        : (nextStep.config as any)?.approver_role
        ? 'awaiting_approval'
        : 'awaiting_advisor'
      : 'complete'

    await db
      .update(workflowRuns)
      .set({
        status:      nextStatus,
        completedAt: nextStatus === 'complete' ? new Date() : null,
      })
      .where(eq(workflowRuns.id, runId))

    // Audit log
    await writeAudit(
      { tenantId },
      {
        skillSlug:  'workflows',
        action:     nextStatus === 'complete'
          ? AUDIT_ACTIONS.WORKFLOW_COMPLETED
          : AUDIT_ACTIONS.STEP_COMPLETED,
        entityType: 'workflow_run',
        entityId:   runId,
        nextState: {
          stepId,
          stepType,
          actorType:  'client',
          clientId,
          nextStatus,
          nextStepId: nextStep?.id,
          portalData: {
            completedAt: data.completedAt,
            ipAddress:   data.ipAddress,
          },
        },
      }
    )

    return NextResponse.json({
      success:    true,
      nextStatus,
      complete:   nextStatus === 'complete',
    })
  }

  return NextResponse.json({ success: true })
}
