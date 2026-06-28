/**
 * ZENITH NORTH — Vendor Management Router
 * Third party vendor due diligence tracking.
 */

import { z } from 'zod'
import { router, protectedProcedure, withPermission } from '@/lib/trpc'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

const VENDOR_TYPES  = ['custodian','technology','compliance','legal','accounting','other'] as const
const DD_STATUSES   = ['pending','in_review','approved','rejected','expired'] as const
const RISK_LEVELS   = ['low','medium','high'] as const

export const vendorsRouter = router({

  list: withPermission('settings.view')
    .input(z.object({
      status: z.string().optional(),
      type:   z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const result = await db.execute(sql`
        SELECT *,
          CASE
            WHEN contract_end IS NOT NULL AND contract_end < NOW() THEN 'expired'
            WHEN contract_end IS NOT NULL AND contract_end < NOW() + INTERVAL '90 days' THEN 'expiring_soon'
            WHEN dd_next_review_at IS NOT NULL AND dd_next_review_at < NOW() THEN 'dd_overdue'
            ELSE dd_status
          END as computed_status,
          CEIL(EXTRACT(EPOCH FROM (contract_end - NOW())) / 86400) as days_until_contract_end
        FROM vendors
        WHERE tenant_id = ${ctx.tenant.id}
          AND archived_at IS NULL
          ${input.status ? sql`AND dd_status = ${input.status}` : sql``}
          ${input.type   ? sql`AND vendor_type = ${input.type}` : sql``}
        ORDER BY vendor_type, name
      `)
      return result.rows as any[]
    }),

  create: withPermission('settings.edit')
    .input(z.object({
      name:          z.string().min(1),
      vendorType:    z.enum(VENDOR_TYPES),
      website:       z.string().optional(),
      contactName:   z.string().optional(),
      contactEmail:  z.string().email().optional(),
      riskLevel:     z.enum(RISK_LEVELS).default('medium'),
      contractStart: z.string().optional(),
      contractEnd:   z.string().optional(),
      notes:         z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.execute(sql`
        INSERT INTO vendors (
          tenant_id, name, vendor_type, website, contact_name,
          contact_email, risk_level, contract_start, contract_end, notes
        ) VALUES (
          ${ctx.tenant.id}, ${input.name}, ${input.vendorType},
          ${input.website ?? null}, ${input.contactName ?? null},
          ${input.contactEmail ?? null}, ${input.riskLevel},
          ${input.contractStart ? new Date(input.contractStart) : null},
          ${input.contractEnd   ? new Date(input.contractEnd)   : null},
          ${input.notes ?? null}
        )
        RETURNING *
      `)
      return result.rows[0] as any
    }),

  update: withPermission('settings.edit')
    .input(z.object({
      id:              z.string().uuid(),
      ddStatus:        z.enum(DD_STATUSES).optional(),
      ddNextReviewAt:  z.string().optional(),
      notes:           z.string().optional(),
      contactName:     z.string().optional(),
      contactEmail:    z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input
      const sets: string[] = []

      if (updates.ddStatus)       sets.push(`dd_status = '${updates.ddStatus}'`)
      if (updates.ddNextReviewAt) sets.push(`dd_next_review_at = '${updates.ddNextReviewAt}'::timestamp`)
      if (updates.notes)          sets.push(`notes = '${updates.notes.replace(/'/g, "''")}'`)
      if (updates.contactName)    sets.push(`contact_name = '${updates.contactName}'`)
      if (updates.contactEmail)   sets.push(`contact_email = '${updates.contactEmail}'`)

      if (updates.ddStatus === 'approved') {
        sets.push(`dd_completed_at = NOW()`)
        sets.push(`dd_next_review_at = NOW() + INTERVAL '1 year'`)
      }

      if (sets.length > 0) {
        await db.execute(sql`
          UPDATE vendors SET ${sql.raw(sets.join(', '))}
          WHERE id = ${id} AND tenant_id = ${ctx.tenant.id}
        `)
      }
      return { success: true }
    }),

  archive: withPermission('settings.edit')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db.execute(sql`
        UPDATE vendors SET archived_at = NOW()
        WHERE id = ${input.id} AND tenant_id = ${ctx.tenant.id}
      `)
      return { success: true }
    }),

  summary: withPermission('settings.view')
    .query(async ({ ctx }) => {
      const result = await db.execute(sql`
        SELECT
          COUNT(*)                                              as total,
          COUNT(*) FILTER (WHERE dd_status = 'approved')       as approved,
          COUNT(*) FILTER (WHERE dd_status IN ('pending','in_review')) as pending_review,
          COUNT(*) FILTER (WHERE contract_end < NOW() + INTERVAL '90 days' AND contract_end > NOW()) as expiring_soon,
          COUNT(*) FILTER (WHERE dd_next_review_at < NOW() AND dd_status = 'approved') as dd_overdue
        FROM vendors
        WHERE tenant_id = ${ctx.tenant.id} AND archived_at IS NULL
      `)
      const row = result.rows[0] as any
      return {
        total:         Number(row.total),
        approved:      Number(row.approved),
        pendingReview: Number(row.pending_review),
        expiringSoon:  Number(row.expiring_soon),
        ddOverdue:     Number(row.dd_overdue),
      }
    }),
})
