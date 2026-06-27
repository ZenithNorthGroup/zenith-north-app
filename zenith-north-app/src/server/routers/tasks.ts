/**
 * ZENITH NORTH — Tasks Router
 *
 * Tasks come from two sources:
 *   1. Manual tasks created by advisors
 *   2. Auto-generated tasks from:
 *      - Workflow steps needing advisor action
 *      - Compliance items needing review
 *      - AI-flagged messages needing CCO review
 *
 * Stored in calendar_events with event_type = 'task'
 * Manual tasks also stored with source_type = 'manual'
 */

import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { db, calendarEvents, complianceItems, workflowRuns, communications } from '@/lib/db'
import { writeAudit } from '@/lib/audit'
import { eq, and, isNull, desc, asc, lte, gte, sql, or } from 'drizzle-orm'

// ── Task shape returned to the client ─────────────────────

export interface Task {
  id:          string
  title:       string
  type:        'workflow' | 'compliance' | 'filing' | 'meeting' | 'manual' | 'flag_review'
  priority:    'high' | 'medium' | 'low'
  dueAt:       string | null
  clientId:    string | null
  clientName:  string | null
  sourceType:  string | null
  sourceId:    string | null
  done:        boolean
  daysUntil:   number | null
}

// ── Helper: build task from calendar event ─────────────────

function eventToTask(row: any): Task {
  const now = Date.now()
  const due = row.due_at ? new Date(row.due_at).getTime() : null
  const daysUntil = due ? Math.ceil((due - now) / 86400000) : null

  const priority: Task['priority'] =
    (daysUntil !== null && daysUntil < 0) || row.event_type === 'compliance' ? 'high'
    : daysUntil !== null && daysUntil <= 7 ? 'medium'
    : 'low'

  const type: Task['type'] =
    row.event_type === 'compliance'    ? 'filing'
    : row.event_type === 'client_review' ? 'compliance'
    : row.event_type === 'workflow_task' ? 'workflow'
    : row.event_type === 'meeting'       ? 'meeting'
    : row.source_type === 'compliance_flag' ? 'flag_review'
    : 'manual'

  const clientName = row.first_name
    ? `${row.first_name} ${row.last_name}`.trim()
    : null

  return {
    id:         row.id,
    title:      row.title,
    type,
    priority,
    dueAt:      row.due_at,
    clientId:   row.client_id,
    clientName,
    sourceType: row.source_type,
    sourceId:   row.source_id,
    done:       !!row.completed_at,
    daysUntil,
  }
}

export const tasksRouter = router({

  /**
   * List all tasks — manual + auto-generated.
   * Combines calendar events with unreviewed AI flags
   * and stalled workflow runs.
   */
  list: protectedProcedure
    .input(z.object({
      filter: z.enum(['all', 'overdue', 'today', 'done']).default('all'),
    }))
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenant.id
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrow = new Date(today.getTime() + 86400000)

      // 1. Calendar-based tasks (manual + auto from workflows/compliance)
      const calendarTasks = await db.execute(sql`
        SELECT
          ce.id,
          ce.title,
          ce.event_type,
          ce.due_at,
          ce.client_id,
          ce.source_type,
          ce.source_id,
          ce.completed_at,
          cl.data->>'firstName' as first_name,
          cl.data->>'lastName'  as last_name
        FROM calendar_events ce
        LEFT JOIN LATERAL (
          SELECT data FROM clients
          WHERE id = ce.client_id AND tenant_id = ${tenantId}
          ORDER BY version DESC LIMIT 1
        ) cl ON true
        WHERE ce.tenant_id = ${tenantId}
          AND ce.archived_at IS NULL
        ORDER BY ce.due_at ASC NULLS LAST
      `)

      // 2. Unreviewed AI flags (high + medium) as tasks
      const flagTasks = await db.execute(sql`
        SELECT
          c.id,
          'Review AI flag: ' || COALESCE(c.subject, c.channel || ' message') as title,
          'compliance_flag' as event_type,
          c.created_at as due_at,
          c.client_id,
          'ai_flag' as source_type,
          c.id as source_id,
          null as completed_at,
          cl.data->>'firstName' as first_name,
          cl.data->>'lastName'  as last_name
        FROM communications c
        LEFT JOIN LATERAL (
          SELECT data FROM clients
          WHERE id = c.client_id AND tenant_id = ${tenantId}
          ORDER BY version DESC LIMIT 1
        ) cl ON true
        WHERE c.tenant_id = ${tenantId}
          AND c.ai_flagged = true
          AND c.reviewed_at IS NULL
          AND c.ai_severity IN ('high', 'medium')
          AND c.archived_at IS NULL
        ORDER BY c.created_at DESC
        LIMIT 20
      `)

      // 3. Stalled workflow runs as tasks
      const workflowTasks = await db.execute(sql`
        SELECT
          wr.id,
          'Follow up: onboarding stalled ' || FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(wr.updated_at, wr.started_at))) / 86400)::text || ' days' as title,
          'workflow_task' as event_type,
          wr.started_at as due_at,
          wr.entity_id as client_id,
          'workflow_run' as source_type,
          wr.id as source_id,
          null as completed_at,
          cl.data->>'firstName' as first_name,
          cl.data->>'lastName'  as last_name
        FROM workflow_runs wr
        LEFT JOIN LATERAL (
          SELECT data FROM clients
          WHERE id = wr.entity_id AND tenant_id = ${tenantId}
          ORDER BY version DESC LIMIT 1
        ) cl ON true
        WHERE wr.tenant_id = ${tenantId}
          AND wr.status NOT IN ('complete', 'blocked')
          AND wr.completed_at IS NULL
          AND COALESCE(wr.updated_at, wr.started_at) < NOW() - INTERVAL '7 days'
        ORDER BY wr.started_at ASC
        LIMIT 10
      `)

      const allTasks = [
        ...(calendarTasks.rows as any[]).map(eventToTask),
        ...(flagTasks.rows as any[]).map(r => ({ ...eventToTask(r), type: 'flag_review' as const, priority: 'high' as const })),
        ...(workflowTasks.rows as any[]).map(r => ({ ...eventToTask(r), priority: 'medium' as const })),
      ]

      // Deduplicate by id
      const seen = new Set<string>()
      return allTasks.filter(t => {
        if (seen.has(t.id)) return false
        seen.add(t.id)
        return true
      })
    }),

  /**
   * Create a manual task.
   */
  create: protectedProcedure
    .input(z.object({
      title:    z.string().min(1),
      clientId: z.string().uuid().optional(),
      dueAt:    z.string().optional(),
      priority: z.enum(['high', 'medium', 'low']).default('medium'),
    }))
    .mutation(async ({ ctx, input }) => {
      // dueAt is NOT NULL in schema — default to 7 days from now if not provided
      const dueAt = input.dueAt
        ? new Date(input.dueAt)
        : new Date(Date.now() + 7 * 86400000)

      const [event] = await db.insert(calendarEvents).values({
        tenantId:   ctx.tenant.id,
        clientId:   input.clientId,
        eventType:  'task',
        title:      input.title,
        dueAt,
        sourceType: 'manual',
      } as any).returning()

      await writeAudit(ctx.auditCtx, {
        skillSlug:  'crm',
        action:     'task.created',
        entityType: 'task',
        entityId:   event.id,
        nextState:  { title: input.title, dueAt: input.dueAt },
      })

      return event
    }),

  /**
   * Mark a calendar-based task complete.
   */
  complete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(calendarEvents)
        .set({ completedAt: new Date() } as any)
        .where(and(
          eq(calendarEvents.id, input.id),
          eq(calendarEvents.tenantId, ctx.tenant.id),
        ))
        .returning()

      await writeAudit(ctx.auditCtx, {
        skillSlug:  'crm',
        action:     'task.completed',
        entityType: 'task',
        entityId:   input.id,
      })

      return updated
    }),

  /**
   * Summary counts for the sidebar and stat cards.
   */
  summary: protectedProcedure
    .query(async ({ ctx }) => {
      const tenantId = ctx.tenant.id

      const result = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE completed_at IS NULL) as open,
          COUNT(*) FILTER (WHERE completed_at IS NULL AND due_at < NOW()) as overdue,
          COUNT(*) FILTER (WHERE completed_at IS NULL AND due_at::date = CURRENT_DATE) as today,
          COUNT(*) FILTER (WHERE completed_at IS NOT NULL) as done
        FROM calendar_events
        WHERE tenant_id = ${tenantId}
          AND archived_at IS NULL
      `)

      const row = result.rows[0] as any
      return {
        open:    Number(row.open    ?? 0),
        overdue: Number(row.overdue ?? 0),
        today:   Number(row.today   ?? 0),
        done:    Number(row.done    ?? 0),
      }
    }),
})
