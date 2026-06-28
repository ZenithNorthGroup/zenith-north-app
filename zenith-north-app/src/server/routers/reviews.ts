/**
 * ZENITH NORTH — Annual Reviews Router
 * Dedicated annual review tracking with 60/30/7 day alerts.
 */

import { z } from 'zod'
import { router, protectedProcedure, withPermission } from '@/lib/trpc'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export const reviewsRouter = router({

  /** List all annual reviews */
  list: withPermission('clients.view')
    .input(z.object({
      status: z.enum(['upcoming','overdue','completed','all']).default('all'),
      limit:  z.number().default(100),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date().toISOString()
      const result = await db.execute(sql`
        SELECT
          ar.*,
          TRIM(COALESCE(cl.data->>'firstName','') || ' ' || COALESCE(cl.data->>'lastName','')) as client_name,
          cl.data->>'status' as client_status,
          u.full_name as advisor_name,
          CEIL(EXTRACT(EPOCH FROM (ar.due_at - NOW())) / 86400) as days_until_due
        FROM annual_reviews ar
        LEFT JOIN LATERAL (
          SELECT data FROM clients
          WHERE id = ar.client_id AND tenant_id = ${ctx.tenant.id}
          ORDER BY version DESC LIMIT 1
        ) cl ON true
        LEFT JOIN users u ON u.id = ar.advisor_id
        WHERE ar.tenant_id = ${ctx.tenant.id}
          ${input.status === 'upcoming'  ? sql`AND ar.completed_at IS NULL AND ar.due_at >= NOW()` : sql``}
          ${input.status === 'overdue'   ? sql`AND ar.completed_at IS NULL AND ar.due_at < NOW()`  : sql``}
          ${input.status === 'completed' ? sql`AND ar.completed_at IS NOT NULL`                    : sql``}
        ORDER BY ar.due_at ASC
        LIMIT ${input.limit}
      `)
      return result.rows as any[]
    }),

  /** Summary counts */
  summary: withPermission('clients.view')
    .query(async ({ ctx }) => {
      const result = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE completed_at IS NULL AND due_at < NOW())           as overdue,
          COUNT(*) FILTER (WHERE completed_at IS NULL AND due_at BETWEEN NOW() AND NOW() + INTERVAL '30 days') as due_30d,
          COUNT(*) FILTER (WHERE completed_at IS NULL AND due_at BETWEEN NOW() AND NOW() + INTERVAL '60 days') as due_60d,
          COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND completed_at > NOW() - INTERVAL '90 days') as recent_completed,
          COUNT(*) FILTER (WHERE completed_at IS NULL) as total_pending
        FROM annual_reviews
        WHERE tenant_id = ${ctx.tenant.id}
      `)
      const row = result.rows[0] as any
      return {
        overdue:          Number(row.overdue),
        due30d:           Number(row.due_30d),
        due60d:           Number(row.due_60d),
        recentCompleted:  Number(row.recent_completed),
        totalPending:     Number(row.total_pending),
      }
    }),

  /** Sync reviews from client records (run on demand or via cron) */
  syncFromClients: withPermission('compliance.run_engine')
    .mutation(async ({ ctx }) => {
      // Get all active clients with annual review dates
      const clients = await db.execute(sql`
        SELECT DISTINCT ON (id) id, data, assigned_advisor_id
        FROM clients
        WHERE tenant_id = ${ctx.tenant.id}
          AND archived_at IS NULL
          AND data->>'annualReviewDue' IS NOT NULL
          AND data->>'status' = 'active'
        ORDER BY id, version DESC
      `)

      let created = 0
      for (const client of clients.rows as any[]) {
        const dueAt = new Date(client.data.annualReviewDue)

        // Check if review already exists for this period
        const existing = await db.execute(sql`
          SELECT id FROM annual_reviews
          WHERE client_id = ${client.id}
            AND tenant_id = ${ctx.tenant.id}
            AND completed_at IS NULL
            AND due_at BETWEEN ${dueAt.toISOString()}::timestamp - INTERVAL '30 days'
                           AND ${dueAt.toISOString()}::timestamp + INTERVAL '30 days'
          LIMIT 1
        `)

        if (existing.rows.length === 0) {
          await db.execute(sql`
            INSERT INTO annual_reviews (tenant_id, client_id, advisor_id, due_at)
            VALUES (${ctx.tenant.id}, ${client.id}, ${client.assigned_advisor_id ?? null}, ${dueAt.toISOString()}::timestamp)
            ON CONFLICT DO NOTHING
          `)
          created++
        }
      }

      return { created, total: clients.rows.length }
    }),

  /** Complete a review */
  complete: withPermission('clients.edit')
    .input(z.object({
      id:           z.string().uuid(),
      notes:        z.string().optional(),
      outcome:      z.string().optional(),
      nextReviewDue:z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const nextDue = input.nextReviewDue
        ? new Date(input.nextReviewDue).toISOString()
        : new Date(Date.now() + 365 * 86400000).toISOString()

      await db.execute(sql`
        UPDATE annual_reviews
        SET completed_at = NOW(),
            completed_by = ${ctx.user.id},
            notes = ${input.notes ?? null},
            outcome = ${input.outcome ?? 'completed'},
            next_review_due = ${nextDue}::timestamp
        WHERE id = ${input.id}
          AND tenant_id = ${ctx.tenant.id}
      `)

      // Schedule next review
      const reviewData = await db.execute(sql`
        SELECT client_id, advisor_id FROM annual_reviews WHERE id = ${input.id}
      `)
      const review = reviewData.rows[0] as any

      if (review) {
        await db.execute(sql`
          INSERT INTO annual_reviews (tenant_id, client_id, advisor_id, due_at)
          VALUES (${ctx.tenant.id}, ${review.client_id}, ${review.advisor_id ?? null}, ${nextDue}::timestamp)
        `)
      }

      return { success: true }
    }),

  /** Schedule a review */
  schedule: withPermission('clients.edit')
    .input(z.object({
      id:          z.string().uuid(),
      scheduledAt: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.execute(sql`
        UPDATE annual_reviews
        SET scheduled_at = ${input.scheduledAt}::timestamp
        WHERE id = ${input.id} AND tenant_id = ${ctx.tenant.id}
      `)
      return { success: true }
    }),
})
