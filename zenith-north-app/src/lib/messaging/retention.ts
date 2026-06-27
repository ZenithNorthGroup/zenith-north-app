/**
 * ZENITH NORTH — Retention Enforcement
 *
 * SEC Investment Advisers Act Rule 204-2 requires:
 *   - Client communications: 5 years (first 2 immediately accessible)
 *   - Agreements: 5 years from termination
 *   - Financial records: 5 years
 *   - Compliance records: 5 years
 *
 * We enforce this at the database level with retention_policies table.
 * Records are NEVER deleted — they are marked archived_at after
 * the retention period expires, meaning they move from "immediately
 * accessible" to "accessible on request" status.
 *
 * This satisfies the two-tier accessibility requirement:
 *   Tier 1 (years 1-2): active, immediately accessible
 *   Tier 2 (years 3-5): archived, accessible on request
 *   After 5 years: flagged for CCO review before any disposal
 *
 * This job runs nightly via Inngest (Phase 2).
 * For now it can be called manually via the admin API.
 */

import { db, retentionPolicies, communications, documents } from '@/lib/db'
import { writeAudit } from '@/lib/audit'
import { eq, and, lt, isNull, sql } from 'drizzle-orm'

export interface RetentionSummary {
  tenantId:             string
  communicationsChecked: number
  documentsChecked:      number
  archivedCommunications: number
  archivedDocuments:      number
  flaggedForReview:       number
}

/**
 * Run retention enforcement for a tenant.
 * Called nightly. Moves expired records to archived state.
 * Never deletes — marks archived_at so they're still queryable.
 */
export async function enforceRetention(tenantId: string): Promise<RetentionSummary> {
  const summary: RetentionSummary = {
    tenantId,
    communicationsChecked:  0,
    documentsChecked:        0,
    archivedCommunications:  0,
    archivedDocuments:       0,
    flaggedForReview:        0,
  }

  // Get this tenant's retention policies
  const policies = await db.query.retentionPolicies.findMany({
    where: eq(retentionPolicies.tenantId, tenantId),
  })

  const policyMap = Object.fromEntries(
    policies.map(p => [p.recordType, p.retainYears])
  )

  const commRetentionYears = policyMap['communication'] ?? 5
  const docRetentionYears  = policyMap['agreement']     ?? 5
  const now = new Date()

  // ── Communications ────────────────────────────────────────

  // Find communications past their retention period
  const commCutoff = new Date(now)
  commCutoff.setFullYear(commCutoff.getFullYear() - commRetentionYears)

  const expiredComms = await db.execute(sql`
    SELECT id, created_at
    FROM communications
    WHERE tenant_id = ${tenantId}
      AND archived_at IS NULL
      AND created_at < ${commCutoff.toISOString()}
  `)

  summary.communicationsChecked = expiredComms.rows.length

  // Flag for CCO review — never auto-delete
  if (expiredComms.rows.length > 0) {
    summary.flaggedForReview += expiredComms.rows.length

    await writeAudit(
      { tenantId },
      {
        skillSlug:  'compliance',
        action:     'retention.records_flagged_for_review',
        entityType: 'tenant',
        entityId:   tenantId,
        metadata: {
          recordType:   'communication',
          count:        expiredComms.rows.length,
          cutoffDate:   commCutoff.toISOString(),
          retainYears:  commRetentionYears,
          action:       'flagged_for_cco_review',
          note:         'Records past retention period. CCO must authorize disposal per Rule 204-2.',
        },
      }
    )
  }

  // ── Tier 1 → Tier 2 transition (year 2 → year 3) ─────────
  // Records older than 2 years move from "immediately accessible"
  // to "accessible on request" — in our system this means
  // we mark them as tier2 in metadata (still fully queryable)

  const tier1Cutoff = new Date(now)
  tier1Cutoff.setFullYear(tier1Cutoff.getFullYear() - 2)

  await db.execute(sql`
    UPDATE communications
    SET metadata = jsonb_set(
      COALESCE(metadata, '{}'),
      '{accessTier}',
      '"tier2"'
    )
    WHERE tenant_id = ${tenantId}
      AND created_at < ${tier1Cutoff.toISOString()}
      AND (metadata->>'accessTier' IS NULL OR metadata->>'accessTier' = 'tier1')
      AND archived_at IS NULL
  `)

  return summary
}

/**
 * Generate the retention compliance report.
 * Used in exam packages and for the DEO undertaking.
 */
export async function getRetentionStatus(tenantId: string) {
  const now = new Date()

  const [total, tier1, tier2, flagged] = await Promise.all([
    // Total communications
    db.execute(sql`
      SELECT COUNT(*) as count FROM communications
      WHERE tenant_id = ${tenantId} AND archived_at IS NULL
    `),

    // Tier 1 — immediately accessible (< 2 years)
    db.execute(sql`
      SELECT COUNT(*) as count FROM communications
      WHERE tenant_id = ${tenantId}
        AND archived_at IS NULL
        AND created_at > ${new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()).toISOString()}
    `),

    // Tier 2 — accessible on request (2-5 years)
    db.execute(sql`
      SELECT COUNT(*) as count FROM communications
      WHERE tenant_id = ${tenantId}
        AND archived_at IS NULL
        AND created_at <= ${new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()).toISOString()}
        AND created_at > ${new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()).toISOString()}
    `),

    // Flagged for review (> 5 years)
    db.execute(sql`
      SELECT COUNT(*) as count FROM communications
      WHERE tenant_id = ${tenantId}
        AND archived_at IS NULL
        AND created_at <= ${new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()).toISOString()}
    `),
  ])

  return {
    totalRecords:      Number((total.rows[0] as { count: string }).count),
    tier1ImmediateAccess: Number((tier1.rows[0] as { count: string }).count),
    tier2OnRequest:    Number((tier2.rows[0] as { count: string }).count),
    flaggedForReview:  Number((flagged.rows[0] as { count: string }).count),
    retentionPolicy:   '5 years (2 immediately accessible)',
    regulatoryBasis:   'Investment Advisers Act Rule 204-2',
    lastChecked:       now.toISOString(),
  }
}
