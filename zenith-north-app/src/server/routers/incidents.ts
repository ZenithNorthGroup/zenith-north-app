/**
 * ZENITH NORTH — Incidents & Complaints Router
 * Client complaints, regulatory inquiries, breach events.
 * Timed response tracking per regulatory requirements.
 */

import { z } from 'zod'
import { router, protectedProcedure, withPermission } from '@/lib/trpc'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

const INCIDENT_TYPES = ['complaint','regulatory_inquiry','data_breach','trading_error','other'] as const
const SEVERITIES     = ['low','medium','high','critical'] as const

// Response deadlines by type (business days)
const RESPONSE_DEADLINES: Record<string, number> = {
  complaint:           5,
  regulatory_inquiry:  3,
  data_breach:         1,
  trading_error:       2,
  other:               5,
}

export const incidentsRouter = router({

  /** List all incidents */
  list: withPermission('compliance.view')
    .input(z.object({
      status: z.enum(['open','resolved','all']).default('open'),
      limit:  z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const result = await db.execute(sql`
        SELECT i.*,
          ru.full_name as reported_by_name,
          au.full_name as assigned_to_name,
          TRIM(COALESCE(cl.data->>'firstName','') || ' ' || COALESCE(cl.data->>'lastName','')) as client_name,
          CEIL(EXTRACT(EPOCH FROM (i.response_deadline - NOW())) / 3600) as hours_until_deadline,
          CASE
            WHEN i.resolved_at IS NOT NULL THEN 'resolved'
            WHEN i.response_deadline < NOW() AND i.responded_at IS NULL THEN 'overdue'
            WHEN i.responded_at IS NULL THEN 'open'
            ELSE 'responded'
          END as computed_status
        FROM incidents i
        LEFT JOIN users ru ON ru.id = i.reported_by
        LEFT JOIN users au ON au.id = i.assigned_to
        LEFT JOIN LATERAL (
          SELECT data FROM clients
          WHERE id = i.client_id AND tenant_id = ${ctx.tenant.id}
          ORDER BY version DESC LIMIT 1
        ) cl ON true
        WHERE i.tenant_id = ${ctx.tenant.id}
          AND i.archived_at IS NULL
          ${input.status === 'open'     ? sql`AND i.resolved_at IS NULL`     : sql``}
          ${input.status === 'resolved' ? sql`AND i.resolved_at IS NOT NULL` : sql``}
        ORDER BY i.severity DESC, i.created_at DESC
        LIMIT ${input.limit}
      `)
      return result.rows as any[]
    }),

  /** Get single incident with full timeline */
  get: withPermission('compliance.view')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await db.execute(sql`
        SELECT i.*,
          ru.full_name as reported_by_name,
          au.full_name as assigned_to_name,
          TRIM(COALESCE(cl.data->>'firstName','') || ' ' || COALESCE(cl.data->>'lastName','')) as client_name
        FROM incidents i
        LEFT JOIN users ru ON ru.id = i.reported_by
        LEFT JOIN users au ON au.id = i.assigned_to
        LEFT JOIN LATERAL (
          SELECT data FROM clients
          WHERE id = i.client_id AND tenant_id = ${ctx.tenant.id}
          ORDER BY version DESC LIMIT 1
        ) cl ON true
        WHERE i.id = ${input.id} AND i.tenant_id = ${ctx.tenant.id}
        LIMIT 1
      `)
      if (!result.rows.length) throw new Error('Incident not found')
      return result.rows[0] as any
    }),

  /** Create new incident */
  create: protectedProcedure
    .input(z.object({
      incidentType:    z.enum(INCIDENT_TYPES),
      severity:        z.enum(SEVERITIES).default('medium'),
      title:           z.string().min(1),
      description:     z.string().min(1),
      clientId:        z.string().uuid().optional(),
      assignedTo:      z.string().uuid().optional(),
      regulatoryRef:   z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const deadlineDays = RESPONSE_DEADLINES[input.incidentType] ?? 5
      const deadline = new Date(Date.now() + deadlineDays * 24 * 3600 * 1000)

      const result = await db.execute(sql`
        INSERT INTO incidents (
          tenant_id, client_id, reported_by, assigned_to,
          incident_type, severity, title, description,
          response_deadline, regulatory_ref,
          timeline
        ) VALUES (
          ${ctx.tenant.id},
          ${input.clientId ?? null},
          ${ctx.user.id},
          ${input.assignedTo ?? null},
          ${input.incidentType}, ${input.severity},
          ${input.title}, ${input.description},
          ${deadline.toISOString()}::timestamp,
          ${input.regulatoryRef ?? null},
          ${JSON.stringify([{
            at: new Date().toISOString(),
            by: ctx.user.fullName,
            action: 'Incident reported',
          }])}::jsonb
        )
        RETURNING *
      `)

      // Create compliance item
      await db.execute(sql`
        INSERT INTO compliance_items (
          tenant_id, client_id, item_type, severity, title,
          description, source_type, source_id
        ) VALUES (
          ${ctx.tenant.id}, ${input.clientId ?? null},
          'incident', ${input.severity === 'critical' ? 'critical' : 'warning'},
          ${'Incident: ' + input.title},
          ${'Response required by ' + deadline.toLocaleDateString()},
          'incident', ${(result.rows[0] as any).id}
        )
      `)

      return result.rows[0] as any
    }),

  /** Add timeline entry */
  addTimelineEntry: withPermission('compliance.view')
    .input(z.object({
      id:     z.string().uuid(),
      action: z.string().min(1),
      notes:  z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const entry = {
        at:     new Date().toISOString(),
        by:     ctx.user.fullName,
        action: input.action,
        notes:  input.notes,
      }

      await db.execute(sql`
        UPDATE incidents
        SET timeline = timeline || ${JSON.stringify([entry])}::jsonb
        WHERE id = ${input.id} AND tenant_id = ${ctx.tenant.id}
      `)
      return { success: true }
    }),

  /** Mark as responded */
  markResponded: withPermission('compliance.resolve')
    .input(z.object({ id: z.string().uuid(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await db.execute(sql`
        UPDATE incidents
        SET responded_at = NOW(),
            timeline = timeline || ${JSON.stringify([{
              at: new Date().toISOString(),
              by: ctx.user.fullName,
              action: 'Initial response sent',
              notes: input.notes,
            }])}::jsonb
        WHERE id = ${input.id} AND tenant_id = ${ctx.tenant.id}
      `)
      return { success: true }
    }),

  /** Resolve incident */
  resolve: withPermission('compliance.resolve')
    .input(z.object({
      id:         z.string().uuid(),
      resolution: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.execute(sql`
        UPDATE incidents
        SET resolved_at = NOW(), resolution = ${input.resolution},
            timeline = timeline || ${JSON.stringify([{
              at: new Date().toISOString(),
              by: ctx.user.fullName,
              action: 'Incident resolved',
              notes: input.resolution,
            }])}::jsonb
        WHERE id = ${input.id} AND tenant_id = ${ctx.tenant.id}
      `)

      await db.execute(sql`
        UPDATE compliance_items SET resolved_at = NOW(), resolved_by = ${ctx.user.id}
        WHERE source_type = 'incident' AND source_id = ${input.id}
          AND tenant_id = ${ctx.tenant.id} AND resolved_at IS NULL
      `)

      return { success: true }
    }),

  /** Summary */
  summary: withPermission('compliance.view')
    .query(async ({ ctx }) => {
      const result = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE resolved_at IS NULL)                                   as open,
          COUNT(*) FILTER (WHERE resolved_at IS NULL AND severity IN ('critical','high')) as high_priority,
          COUNT(*) FILTER (WHERE resolved_at IS NULL AND response_deadline < NOW() AND responded_at IS NULL) as overdue,
          COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at > NOW() - INTERVAL '30 days') as resolved_30d
        FROM incidents
        WHERE tenant_id = ${ctx.tenant.id} AND archived_at IS NULL
      `)
      const row = result.rows[0] as any
      return {
        open:         Number(row.open),
        highPriority: Number(row.high_priority),
        overdue:      Number(row.overdue),
        resolved30d:  Number(row.resolved_30d),
      }
    }),
})
