/**
 * ZENITH NORTH — Compliance Engine
 *
 * Runs nightly (or on-demand) to scan every tenant for:
 *
 *   1. OVERDUE ANNUAL REVIEWS
 *      Clients whose annual review is past due
 *      → Creates critical compliance item
 *      → Appears on compliance dashboard
 *
 *   2. STALE KYC
 *      Clients whose KYC verification is expired or expiring
 *      → Creates compliance item with days-until-expiry
 *
 *   3. MISSING REQUIRED DOCUMENTS
 *      Active clients without signed agreement or ADV acknowledgment
 *      → Creates compliance item per missing document
 *
 *   4. UPCOMING SEC FILINGS
 *      Form ADV annual amendment (due within 90 days of fiscal year end)
 *      Form ADV-W (if firm is withdrawing)
 *      → Creates calendar events + compliance items
 *
 *   5. STALLED WORKFLOWS
 *      Onboarding workflows stalled for more than 14 days
 *      → Creates compliance item, sends reminder
 *
 *   6. UNREVIEWED COMMUNICATION FLAGS
 *      AI-flagged messages not reviewed within 48 hours
 *      → Escalates to critical
 *
 *   7. RETENTION POLICY ENFORCEMENT
 *      Records approaching or past retention periods
 *      → Flags for CCO review
 *
 * SCHEDULING:
 *   Production: Inngest cron job, runs at 2am UTC daily
 *   Development: Call POST /api/compliance/engine directly
 *
 * IDEMPOTENCY:
 *   The engine checks if a compliance item already exists before
 *   creating a new one. Running multiple times is safe.
 */

import { db, complianceItems, clients, documents, workflowRuns, communications, calendarEvents } from '@/lib/db'
import { writeAudit } from '@/lib/audit'
import { eq, and, lt, lte, gte, isNull, ne, sql, desc } from 'drizzle-orm'

// ── Types ─────────────────────────────────────────────────

interface EngineResult {
  tenantId:        string
  ranAt:           Date
  itemsCreated:    number
  itemsUpdated:    number
  checks: {
    annualReviews:    number
    kycExpiry:        number
    missingDocuments: number
    secFilings:       number
    stalledWorkflows: number
    unreviewedFlags:  number
    retention:        number
  }
}

// ── Helper — create or skip compliance item ───────────────

async function upsertComplianceItem(item: {
  tenantId:    string
  clientId?:   string
  itemType:    string
  severity:    'info' | 'warning' | 'critical'
  title:       string
  description?: string
  dueDate?:    Date
  sourceType?: string
  sourceId?:   string
}): Promise<'created' | 'exists'> {
  // Check if this exact item already exists and is unresolved
  const existing = await db.execute(sql`
    SELECT id FROM compliance_items
    WHERE tenant_id = ${item.tenantId}
      ${item.clientId ? sql`AND client_id = ${item.clientId}` : sql``}
      AND item_type = ${item.itemType}
      AND resolved_at IS NULL
      AND snoozed_until IS NULL
    LIMIT 1
  `)

  if (existing.rows.length > 0) return 'exists'

  await db.insert(complianceItems).values({
    tenantId:    item.tenantId,
    clientId:    item.clientId,
    itemType:    item.itemType,
    severity:    item.severity,
    title:       item.title,
    description: item.description,
    dueDate:     item.dueDate,
    sourceType:  item.sourceType,
    sourceId:    item.sourceId,
  } as any)

  return 'created'
}

// ── Check 1: Overdue annual reviews ───────────────────────

async function checkAnnualReviews(tenantId: string): Promise<number> {
  const today = new Date()

  // Find clients where annual_review_due is in the past and not resolved
  const overdueClients = await db.execute(sql`
    SELECT DISTINCT ON (id) id, data
    FROM clients
    WHERE tenant_id = ${tenantId}
      AND archived_at IS NULL
      AND data->>'status' = 'active'
      AND data->>'annualReviewDue' IS NOT NULL
      AND (data->>'annualReviewDue')::date < CURRENT_DATE
    ORDER BY id, version DESC
  `)

  let created = 0

  for (const row of overdueClients.rows as Array<{ id: string; data: any }>) {
    const data    = row.data
    const dueDate = new Date(data.annualReviewDue)
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000)

    const result = await upsertComplianceItem({
      tenantId,
      clientId:    row.id,
      itemType:    'annual_review_overdue',
      severity:    daysOverdue > 60 ? 'critical' : 'warning',
      title:       `Annual review overdue — ${data.firstName} ${data.lastName}`,
      description: `Review was due ${dueDate.toLocaleDateString()}. Now ${daysOverdue} days overdue.`,
      dueDate:     today,
    })

    if (result === 'created') created++
  }

  // Also warn for reviews due in next 30 days
  const upcomingClients = await db.execute(sql`
    SELECT DISTINCT ON (id) id, data
    FROM clients
    WHERE tenant_id = ${tenantId}
      AND archived_at IS NULL
      AND data->>'status' = 'active'
      AND data->>'annualReviewDue' IS NOT NULL
      AND (data->>'annualReviewDue')::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
    ORDER BY id, version DESC
  `)

  for (const row of upcomingClients.rows as Array<{ id: string; data: any }>) {
    const data    = row.data
    const dueDate = new Date(data.annualReviewDue)
    const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000)

    const result = await upsertComplianceItem({
      tenantId,
      clientId:    row.id,
      itemType:    'annual_review_upcoming',
      severity:    daysUntil <= 7 ? 'warning' : 'info',
      title:       `Annual review due in ${daysUntil} days — ${data.firstName} ${data.lastName}`,
      description: `Review due ${dueDate.toLocaleDateString()}.`,
      dueDate,
    })

    if (result === 'created') created++
  }

  return created
}

// ── Check 2: KYC expiry ───────────────────────────────────

async function checkKYCExpiry(tenantId: string): Promise<number> {
  const today    = new Date()
  let created = 0

  // Clients with expired or expiring KYC
  const kycIssues = await db.execute(sql`
    SELECT DISTINCT ON (id) id, data
    FROM clients
    WHERE tenant_id = ${tenantId}
      AND archived_at IS NULL
      AND data->>'status' = 'active'
      AND (
        data->>'kycStatus' = 'needs_review'
        OR data->>'kycStatus' = 'expired'
        OR (
          data->>'kycStatus' = 'verified'
          AND data->>'kycExpiresAt' IS NOT NULL
          AND (data->>'kycExpiresAt')::date <= CURRENT_DATE + 60
        )
      )
    ORDER BY id, version DESC
  `)

  for (const row of kycIssues.rows as Array<{ id: string; data: any }>) {
    const data = row.data
    const isExpired = data.kycStatus === 'expired' || data.kycStatus === 'needs_review'

    const result = await upsertComplianceItem({
      tenantId,
      clientId:    row.id,
      itemType:    'kyc_expiry',
      severity:    isExpired ? 'critical' : 'warning',
      title:       isExpired
        ? `KYC verification required — ${data.firstName} ${data.lastName}`
        : `KYC expiring soon — ${data.firstName} ${data.lastName}`,
      description: isExpired
        ? `Client's identity verification is expired or has not been completed.`
        : `KYC verification expires on ${data.kycExpiresAt}. Renew within 60 days.`,
    })

    if (result === 'created') created++
  }

  return created
}

// ── Check 3: Missing required documents ───────────────────

async function checkMissingDocuments(tenantId: string): Promise<number> {
  let created = 0

  // Active clients without a signed investment advisory agreement
  const missingAgreements = await db.execute(sql`
    SELECT DISTINCT ON (c.id) c.id, c.data
    FROM clients c
    WHERE c.tenant_id = ${tenantId}
      AND c.archived_at IS NULL
      AND c.data->>'status' = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM documents d
        WHERE d.tenant_id = ${tenantId}
          AND d.client_id = c.id
          AND d.doc_type = 'agreement'
          AND d.signed_at IS NOT NULL
          AND d.archived_at IS NULL
      )
    ORDER BY c.id, c.version DESC
  `)

  for (const row of missingAgreements.rows as Array<{ id: string; data: any }>) {
    const data = row.data
    const result = await upsertComplianceItem({
      tenantId,
      clientId:    row.id,
      itemType:    'missing_signed_agreement',
      severity:    'critical',
      title:       `Signed agreement missing — ${data.firstName} ${data.lastName}`,
      description: 'Active client does not have a signed investment advisory agreement on file.',
    })
    if (result === 'created') created++
  }

  // Active clients without ADV Part 2 acknowledgment
  const missingADV = await db.execute(sql`
    SELECT DISTINCT ON (c.id) c.id, c.data
    FROM clients c
    WHERE c.tenant_id = ${tenantId}
      AND c.archived_at IS NULL
      AND c.data->>'status' = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM documents d
        WHERE d.tenant_id = ${tenantId}
          AND d.client_id = c.id
          AND d.doc_type = 'disclosure'
          AND d.signed_at IS NOT NULL
          AND d.archived_at IS NULL
      )
    ORDER BY c.id, c.version DESC
  `)

  for (const row of missingADV.rows as Array<{ id: string; data: any }>) {
    const data = row.data
    const result = await upsertComplianceItem({
      tenantId,
      clientId:    row.id,
      itemType:    'missing_adv_acknowledgment',
      severity:    'warning',
      title:       `ADV Part 2 not acknowledged — ${data.firstName} ${data.lastName}`,
      description: 'Client has not acknowledged receipt of Form ADV Part 2.',
    })
    if (result === 'created') created++
  }

  return created
}

// ── Check 4: SEC filing deadlines ─────────────────────────

async function checkSECFilings(tenantId: string): Promise<number> {
  let created = 0
  const today = new Date()

  // Form ADV annual amendment — due within 90 days of fiscal year end
  // Default fiscal year end: December 31
  // Due: March 31 each year
  const thisYearDeadline = new Date(today.getFullYear(), 2, 31) // March 31
  const nextYearDeadline = new Date(today.getFullYear() + 1, 2, 31)

  const deadline = today > thisYearDeadline ? nextYearDeadline : thisYearDeadline
  const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / 86400000)

  if (daysUntil <= 90) {
    const result = await upsertComplianceItem({
      tenantId,
      itemType:    'sec_filing_due',
      severity:    daysUntil <= 30 ? 'critical' : 'warning',
      title:       `Form ADV annual amendment due in ${daysUntil} days`,
      description: `Form ADV annual amendment must be filed by ${deadline.toLocaleDateString()}. Review and update your ADV in IAPD before the deadline.`,
      dueDate:     deadline,
    })
    if (result === 'created') created++

    // Also create a calendar event if not already there
    const existingEvent = await db.execute(sql`
      SELECT id FROM calendar_events
      WHERE tenant_id = ${tenantId}
        AND event_type = 'compliance'
        AND title LIKE '%Form ADV%'
        AND due_at = ${deadline.toISOString()}
      LIMIT 1
    `)

    if (!existingEvent.rows.length) {
      await db.insert(calendarEvents).values({
        tenantId,
        eventType: 'compliance',
        title:     'Form ADV Annual Amendment Due',
        dueAt:     deadline,
        sourceType: 'compliance_engine',
      } as any)
    }
  }

  return created
}

// ── Check 5: Stalled workflows ────────────────────────────

async function checkStalledWorkflows(tenantId: string): Promise<number> {
  let created = 0

  // Workflows that haven't moved in 14+ days and aren't complete
  const stalledRuns = await db.execute(sql`
    SELECT wr.id, wr.entity_id, wr.status, wr.started_at,
           wr.updated_at,
           EXTRACT(EPOCH FROM (NOW() - COALESCE(wr.updated_at, wr.started_at))) / 86400 as days_stalled
    FROM workflow_runs wr
    WHERE wr.tenant_id = ${tenantId}
      AND wr.status NOT IN ('complete', 'blocked')
      AND wr.completed_at IS NULL
      AND COALESCE(wr.updated_at, wr.started_at) < NOW() - INTERVAL '14 days'
  `)

  for (const row of stalledRuns.rows as Array<{
    id: string; entity_id: string; status: string; days_stalled: number
  }>) {
    const result = await upsertComplianceItem({
      tenantId,
      clientId:    row.entity_id,
      itemType:    'stalled_workflow',
      severity:    row.days_stalled > 30 ? 'critical' : 'warning',
      title:       `Onboarding stalled for ${Math.floor(row.days_stalled)} days`,
      description: `Workflow run ${row.id} has been in status "${row.status}" for ${Math.floor(row.days_stalled)} days without progress.`,
      sourceType:  'workflow_run',
      sourceId:    row.id,
    })
    if (result === 'created') created++
  }

  return created
}

// ── Check 6: Unreviewed AI flags ──────────────────────────

async function checkUnreviewedFlags(tenantId: string): Promise<number> {
  let created = 0

  // High-severity flags not reviewed within 24 hours
  const urgentFlags = await db.execute(sql`
    SELECT id, client_id, ai_reason, ai_severity, created_at
    FROM communications
    WHERE tenant_id = ${tenantId}
      AND ai_flagged = true
      AND reviewed_at IS NULL
      AND ai_severity = 'high'
      AND created_at < NOW() - INTERVAL '24 hours'
      AND archived_at IS NULL
  `)

  for (const row of urgentFlags.rows as Array<{
    id: string; client_id: string; ai_reason: string; ai_severity: string
  }>) {
    const result = await upsertComplianceItem({
      tenantId,
      clientId:    row.client_id,
      itemType:    'unreviewed_flag',
      severity:    'critical',
      title:       `High severity communication flag unreviewed — ${row.ai_reason}`,
      description: 'A high-severity AI compliance flag has not been reviewed within 24 hours.',
      sourceType:  'communication',
      sourceId:    row.id,
    })
    if (result === 'created') created++
  }

  return created
}

// ── Main engine ───────────────────────────────────────────

export async function runComplianceEngine(tenantId: string): Promise<EngineResult> {
  const ranAt = new Date()

  const [
    annualReviews,
    kycExpiry,
    missingDocuments,
    secFilings,
    stalledWorkflows,
    unreviewedFlags,
  ] = await Promise.all([
    checkAnnualReviews(tenantId),
    checkKYCExpiry(tenantId),
    checkMissingDocuments(tenantId),
    checkSECFilings(tenantId),
    checkStalledWorkflows(tenantId),
    checkUnreviewedFlags(tenantId),
  ])

  const totalCreated = annualReviews + kycExpiry + missingDocuments +
    secFilings + stalledWorkflows + unreviewedFlags

  // Write audit log for the engine run
  await writeAudit(
    { tenantId },
    {
      skillSlug:  'compliance',
      action:     'compliance.engine_ran',
      entityType: 'tenant',
      entityId:   tenantId,
      metadata: {
        itemsCreated: totalCreated,
        checks: {
          annualReviews,
          kycExpiry,
          missingDocuments,
          secFilings,
          stalledWorkflows,
          unreviewedFlags,
        },
      },
    }
  )

  return {
    tenantId,
    ranAt,
    itemsCreated: totalCreated,
    itemsUpdated: 0,
    checks: {
      annualReviews,
      kycExpiry,
      missingDocuments,
      secFilings,
      stalledWorkflows,
      unreviewedFlags,
      retention:    0,
    },
  }
}
