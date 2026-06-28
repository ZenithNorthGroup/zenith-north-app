/**
 * ZENITH NORTH — Marketing Compliance Router
 * SEC Rule 206(4)-1 pre-approval workflow for all marketing content.
 */

import { z } from 'zod'
import { router, protectedProcedure, withPermission } from '@/lib/trpc'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

const CONTENT_TYPES = ['linkedin_post','newsletter','website','advertisement','social','email_campaign','other'] as const
const PLATFORMS     = ['linkedin','twitter','instagram','facebook','youtube','other'] as const

export const marketingRouter = router({

  /** List all marketing submissions */
  list: withPermission('compliance.view')
    .input(z.object({
      status: z.enum(['pending','approved','rejected','revision_requested','all']).default('all'),
      limit:  z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const result = await db.execute(sql`
        SELECT m.*,
          su.full_name as submitted_by_name,
          ru.full_name as reviewed_by_name,
          TRIM(COALESCE(cl.data->>'firstName','') || ' ' || COALESCE(cl.data->>'lastName','')) as client_name
        FROM marketing_content m
        LEFT JOIN users su ON su.id = m.submitted_by
        LEFT JOIN users ru ON ru.id = m.reviewed_by
        LEFT JOIN LATERAL (
          SELECT data FROM clients
          WHERE id::text = ANY(m.tags)
          LIMIT 1
        ) cl ON true
        WHERE m.tenant_id = ${ctx.tenant.id}
          AND m.archived_at IS NULL
          ${input.status !== 'all' ? sql`AND m.status = ${input.status}` : sql``}
        ORDER BY m.created_at DESC
        LIMIT ${input.limit}
      `)
      return result.rows as any[]
    }),

  /** Submit content for review */
  submit: protectedProcedure
    .input(z.object({
      contentType: z.enum(CONTENT_TYPES),
      platform:    z.string().optional(),
      title:       z.string().min(1),
      body:        z.string().min(1),
      scheduledFor:z.string().optional(),
      tags:        z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await db.execute(sql`
        INSERT INTO marketing_content (
          tenant_id, submitted_by, content_type, platform, title, body,
          scheduled_for, tags, status
        ) VALUES (
          ${ctx.tenant.id}, ${ctx.user.id}, ${input.contentType},
          ${input.platform ?? null}, ${input.title}, ${input.body},
          ${input.scheduledFor ? new Date(input.scheduledFor) : null},
          ${input.tags ?? []}, 'pending'
        )
        RETURNING *
      `)

      // Create compliance item for CCO review
      await db.execute(sql`
        INSERT INTO compliance_items (tenant_id, item_type, severity, title, source_type, source_id)
        VALUES (
          ${ctx.tenant.id}, 'marketing_review', 'warning',
          'Marketing content pending CCO approval: ${input.title}',
          'marketing', ${(result.rows[0] as any).id}
        )
      `)

      return result.rows[0] as any
    }),

  /** CCO reviews content */
  review: withPermission('compliance.resolve')
    .input(z.object({
      id:     z.string().uuid(),
      status: z.enum(['approved','rejected','revision_requested']),
      notes:  z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.execute(sql`
        UPDATE marketing_content
        SET status = ${input.status},
            reviewed_by = ${ctx.user.id},
            reviewed_at = NOW(),
            review_notes = ${input.notes ?? null}
        WHERE id = ${input.id}
          AND tenant_id = ${ctx.tenant.id}
      `)

      // Resolve the compliance item
      await db.execute(sql`
        UPDATE compliance_items
        SET resolved_at = NOW(), resolved_by = ${ctx.user.id}
        WHERE source_type = 'marketing'
          AND source_id = ${input.id}
          AND tenant_id = ${ctx.tenant.id}
          AND resolved_at IS NULL
      `)

      return { success: true }
    }),

  /** Summary counts */
  summary: withPermission('compliance.view')
    .query(async ({ ctx }) => {
      const result = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')            as pending,
          COUNT(*) FILTER (WHERE status = 'approved')           as approved,
          COUNT(*) FILTER (WHERE status = 'rejected')           as rejected,
          COUNT(*) FILTER (WHERE status = 'revision_requested') as needs_revision,
          COUNT(*)                                              as total
        FROM marketing_content
        WHERE tenant_id = ${ctx.tenant.id}
          AND archived_at IS NULL
      `)
      const row = result.rows[0] as any
      return {
        pending:       Number(row.pending),
        approved:      Number(row.approved),
        rejected:      Number(row.rejected),
        needsRevision: Number(row.needs_revision),
        total:         Number(row.total),
      }
    }),
})
