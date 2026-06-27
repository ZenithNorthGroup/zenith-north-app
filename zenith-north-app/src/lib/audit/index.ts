/**
 * ZENITH NORTH — Audit Log Writer
 *
 * Every significant action in the platform writes here.
 * This is the backbone of examination readiness.
 *
 * Usage:
 *   import { writeAudit } from '@/lib/audit'
 *
 *   await writeAudit(ctx, {
 *     skillSlug:  'crm',
 *     action:     'client.created',
 *     entityType: 'client',
 *     entityId:   client.id,
 *     nextState:  clientData,
 *   })
 *
 * The audit log table has DELETE blocked at the DB level via RLS.
 * Even a compromised application cannot erase audit records.
 */

import { db, auditLog } from '@/lib/db'
import { headers } from 'next/headers'
import { auth } from '@clerk/nextjs/server'

export interface AuditContext {
  tenantId:  string
  userId?:   string
  ipAddress?: string
  userAgent?: string
}

export interface AuditEntry {
  skillSlug:  string
  action:     string      // 'client.created' | 'document.signed' | etc.
  entityType: string      // 'client' | 'document' | 'workflow_run'
  entityId?:  string
  prevState?: Record<string, unknown>
  nextState?: Record<string, unknown>
  metadata?:  Record<string, unknown>
}

// Standard action constants — use these everywhere
// so searches in the audit log are consistent
export const AUDIT_ACTIONS = {
  // Clients
  CLIENT_CREATED:       'client.created',
  CLIENT_UPDATED:       'client.updated',
  CLIENT_ARCHIVED:      'client.archived',
  CLIENT_VIEWED:        'client.viewed',
  // Documents
  DOC_UPLOADED:         'document.uploaded',
  DOC_SIGNED:           'document.signed',
  DOC_ARCHIVED:         'document.archived',
  DOC_EXTRACTED:        'document.data_extracted',
  // Workflows
  WORKFLOW_STARTED:     'workflow.started',
  WORKFLOW_COMPLETED:   'workflow.completed',
  STEP_COMPLETED:       'workflow.step_completed',
  STEP_BLOCKED:         'workflow.step_blocked',
  // Compliance
  CI_CREATED:           'compliance_item.created',
  CI_RESOLVED:          'compliance_item.resolved',
  CI_SNOOZED:           'compliance_item.snoozed',
  // Communications
  MSG_SENT:             'communication.sent',
  MSG_FLAGGED:          'communication.flagged',
  MSG_REVIEWED:         'communication.reviewed',
  // Approval
  APPROVAL_APPROVED:    'approval.approved',
  APPROVAL_REJECTED:    'approval.rejected',
  APPROVAL_CONDITIONS:  'approval.approved_with_conditions',
  // Audit packages
  PKG_GENERATED:        'audit_package.generated',
  // Auth
  USER_SIGNED_IN:       'auth.signed_in',
  USER_INVITED:         'auth.user_invited',
  // Portal
  PORTAL_INVITE_SENT:   'portal.invite_sent',
  PORTAL_STEP_DONE:     'portal.step_completed',
  // Migrations
  IMPORT_COMPLETED:     'migration.import_completed',
} as const

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS]

// ── Main writer ───────────────────────────────────────────

export async function writeAudit(
  ctx: AuditContext,
  entry: AuditEntry
): Promise<void> {
  try {
    await db.insert(auditLog).values({
      tenantId:   ctx.tenantId,
      userId:     ctx.userId,
      skillSlug:  entry.skillSlug,
      action:     entry.action,
      entityType: entry.entityType,
      entityId:   entry.entityId,
      prevState:  entry.prevState,
      nextState:  entry.nextState,
      metadata:   entry.metadata,
      ipAddress:  ctx.ipAddress,
      userAgent:  ctx.userAgent,
    })
  } catch (error) {
    // Audit failures should NEVER crash the app.
    // Log to monitoring but let the operation succeed.
    console.error('[AUDIT] Failed to write audit entry:', error, entry)
    // In production: send to error monitoring (Sentry, etc.)
  }
}

// ── Context builder from Next.js request ─────────────────

export async function buildAuditContext(): Promise<AuditContext> {
  const { userId } = await auth()
  const headersList = await headers()

  const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headersList.get('x-real-ip')
    || undefined

  const userAgent = headersList.get('user-agent') || undefined

  // tenantId is resolved from Clerk org in tRPC middleware
  // and passed through ctx — see trpc/context.ts
  return { tenantId: '', userId: userId || undefined, ipAddress, userAgent }
}

// ── Audit package generator ───────────────────────────────

export interface AuditPackageOptions {
  tenantId:   string
  clientId:   string
  dateRange:  { from: Date; to: Date }
  requestedBy: string
}

export async function generateAuditPackage(opts: AuditPackageOptions) {
  const { tenantId, clientId, dateRange, requestedBy } = opts

  // Pull everything in parallel
  const [clientHistory, docEntries, commEntries, workflowEntries, auditEntries] =
    await Promise.all([
      // Client version history
      db.query.clients.findMany({
        where: (c, { eq, and }) => and(
          eq(c.tenantId, tenantId),
          eq(c.id, clientId)
        ),
        orderBy: (c, { asc }) => [asc(c.version)],
      }),

      // All documents in range
      db.query.documents.findMany({
        where: (d, { eq, and, gte, lte }) => and(
          eq(d.tenantId, tenantId),
          eq(d.clientId, clientId),
          gte(d.createdAt, dateRange.from),
          lte(d.createdAt, dateRange.to),
        ),
      }),

      // All communications in range
      db.query.communications.findMany({
        where: (c, { eq, and, gte, lte }) => and(
          eq(c.tenantId, tenantId),
          eq(c.clientId, clientId),
          gte(c.createdAt, dateRange.from),
          lte(c.createdAt, dateRange.to),
        ),
        orderBy: (c, { asc }) => [asc(c.createdAt)],
      }),

      // Workflow history
      db.query.workflowRuns.findMany({
        where: (r, { eq, and }) => and(
          eq(r.tenantId, tenantId),
          eq(r.entityId, clientId),
        ),
        with: { completions: true },
      }),

      // Full audit trail for this client
      db.query.auditLog.findMany({
        where: (a, { eq, and, gte, lte }) => and(
          eq(a.tenantId, tenantId),
          eq(a.entityId, clientId),
          gte(a.createdAt, dateRange.from),
          lte(a.createdAt, dateRange.to),
        ),
        orderBy: (a, { asc }) => [asc(a.createdAt)],
      }),
    ])

  const pkg = {
    generatedAt:    new Date(),
    generatedBy:    requestedBy,
    tenantId,
    clientId,
    dateRange,
    sections: {
      clientProfile: {
        current:  clientHistory[clientHistory.length - 1],
        history:  clientHistory,
      },
      documents:        docEntries,
      communications:   commEntries,
      workflowHistory:  workflowEntries,
      auditTrail:       auditEntries,
    },
    summary: {
      totalDocuments:       docEntries.length,
      signedDocuments:      docEntries.filter(d => d.signedAt).length,
      totalCommunications:  commEntries.length,
      flaggedCommunications:commEntries.filter(c => c.aiFlagged).length,
      workflowsCompleted:   workflowEntries.filter(r => r.status === 'complete').length,
      auditEntries:         auditEntries.length,
    },
  }

  // Log the package generation itself
  await writeAudit(
    { tenantId, userId: requestedBy },
    {
      skillSlug:  'audit',
      action:     AUDIT_ACTIONS.PKG_GENERATED,
      entityType: 'client',
      entityId:   clientId,
      nextState:  { dateRange, sections: Object.keys(pkg.sections), summary: pkg.summary },
    }
  )

  return pkg
}
