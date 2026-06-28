/**
 * ZENITH NORTH — Calendar Router
 * Fetches calendar events and compliance deadlines from the DB.
 */

import { z } from 'zod'
import { router, protectedProcedure, withPermission } from '@/lib/trpc'
import { db, calendarEvents, complianceItems } from '@/lib/db'
import { eq, and, isNull, gte, lte, sql, desc, asc } from 'drizzle-orm'

export const calendarRouter = router({

  /**
   * List events for a given month range.
   * Combines:
   *   - Manual calendar events (meetings, reviews)
   *   - Compliance filing deadlines
   *   - Workflow step due dates
   */
  listEvents: withPermission('calendar.view')
    .input(z.object({
      from: z.string(), // ISO date
      to:   z.string(), // ISO date
    }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenant.id

      // Calendar events from DB
      const events = await db.execute(sql`
        SELECT
          ce.id,
          ce.title,
          ce.event_type,
          ce.due_at,
          ce.completed_at,
          ce.source_type,
          ce.source_id,
          ce.client_id,
          TRIM(COALESCE(cl.data->>'firstName','') || ' ' || COALESCE(cl.data->>'lastName','')) as client_name
        FROM calendar_events ce
        LEFT JOIN LATERAL (
          SELECT data FROM clients
          WHERE id = ce.client_id AND tenant_id = ${tenantId}
          ORDER BY version DESC LIMIT 1
        ) cl ON true
        WHERE ce.tenant_id = ${tenantId}
          AND ce.archived_at IS NULL
          AND ce.due_at BETWEEN ${input.from}::timestamp AND ${input.to}::timestamp
        ORDER BY ce.due_at ASC
      `)

      return (events.rows as any[]).map(row => ({
        id:          row.id,
        title:       row.title,
        type:        row.event_type as string,
        date:        row.due_at as string,
        completed:   !!row.completed_at,
        clientId:    row.client_id as string | null,
        clientName:  row.client_name as string | null,
        sourceType:  row.source_type as string | null,
      }))
    }),

  /**
   * Upcoming events — next 30 days, for dashboard sidebar.
   */
  upcoming: withPermission('calendar.view')
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenant.id

      const events = await db.execute(sql`
        SELECT
          ce.id, ce.title, ce.event_type, ce.due_at, ce.client_id,
          TRIM(COALESCE(cl.data->>'firstName','') || ' ' || COALESCE(cl.data->>'lastName','')) as client_name
        FROM calendar_events ce
        LEFT JOIN LATERAL (
          SELECT data FROM clients
          WHERE id = ce.client_id AND tenant_id = ${tenantId}
          ORDER BY version DESC LIMIT 1
        ) cl ON true
        WHERE ce.tenant_id = ${tenantId}
          AND ce.archived_at IS NULL
          AND ce.completed_at IS NULL
          AND ce.due_at BETWEEN NOW() AND NOW() + INTERVAL '60 days'
        ORDER BY ce.due_at ASC
        LIMIT 20
      `)

      return events.rows as any[]
    }),

  /**
   * Create a manual calendar event.
   */
  create: withPermission('calendar.edit')
    .input(z.object({
      title:     z.string().min(1),
      eventType: z.string().default('meeting'),
      dueAt:     z.string(),
      clientId:  z.string().uuid().optional(),
      notes:     z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [event] = await db.insert(calendarEvents).values({
        tenantId:   ctx.tenant.id,
        createdBy:  ctx.user.id,
        title:      input.title,
        eventType:  input.eventType,
        dueAt:      new Date(input.dueAt),
        clientId:   input.clientId,
        sourceType: 'manual',
      } as any).returning()

      return event
    }),
})
