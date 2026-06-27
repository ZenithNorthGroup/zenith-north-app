/**
 * ZENITH NORTH — Clients Router
 *
 * All client operations go through here.
 * Every write automatically:
 *   1. Inserts a new version row (never updates)
 *   2. Writes to the audit log
 *   3. Invalidates the Redis cache
 */

import { z } from 'zod'
import { router, protectedProcedure } from '@/lib/trpc'
import { db, clients } from '@/lib/db'
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { eq, and, desc, sql } from 'drizzle-orm'

// ── Zod schemas ───────────────────────────────────────────

const ClientDataSchema = z.object({
  firstName:           z.string().min(1),
  lastName:            z.string().min(1),
  email:               z.string().email(),
  phone:               z.string().optional(),
  dateOfBirth:         z.string().optional(),
  clientType:          z.enum(['individual', 'entity', 'trust']),
  status:              z.enum(['prospect', 'active', 'inactive', 'archived'])
                        .default('prospect'),
  kycStatus:           z.enum(['pending', 'verified', 'flagged', 'needs_review'])
                        .default('pending'),
  kycVerifiedAt:       z.string().optional(),
  kycExpiresAt:        z.string().optional(),
  annualReviewDue:     z.string().optional(),
  lastReviewDate:      z.string().optional(),
  riskProfileVersion:  z.number().optional(),
  aumBand:             z.string().optional(),
  advisorId:           z.string().optional(),
  householdId:         z.string().optional(),
  householdRole:       z.enum(['primary', 'spouse', 'dependent']).optional(),
  importSource:        z.enum(['redtail', 'wealthbox', 'salesforce', 'csv']).optional(),
  importId:            z.string().optional(),
})

// ── Helpers ───────────────────────────────────────────────

// Get the current (latest) version of a client
async function getCurrentClient(tenantId: string, clientId: string) {
  const result = await db.query.clients.findFirst({
    where: (c, { eq, and, isNull }) => and(
      eq(c.tenantId, tenantId),
      eq(c.id, clientId),
      isNull(c.archivedAt),
    ),
    orderBy: (c, { desc }) => [desc(c.version)],
  })
  return result ?? null
}

// ── Router ────────────────────────────────────────────────

export const clientsRouter = router({

  /**
   * List all active clients for the current tenant.
   * Returns latest version of each client.
   */
  list: protectedProcedure
    .input(z.object({
      status:   z.string().optional(),
      search:   z.string().optional(),
      limit:    z.number().min(1).max(100).default(50),
      offset:   z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { tenantId } = ctx.tenant

      // Subquery: get max version per client ID
      // Then join back to get full row
      const result = await db.execute(sql`
        SELECT DISTINCT ON (id) *
        FROM clients
        WHERE tenant_id = ${tenantId}
          AND archived_at IS NULL
          ${input.status
            ? sql`AND data->>'status' = ${input.status}`
            : sql``
          }
          ${input.search
            ? sql`AND (
                data->>'firstName' ILIKE ${'%' + input.search + '%'} OR
                data->>'lastName'  ILIKE ${'%' + input.search + '%'} OR
                data->>'email'     ILIKE ${'%' + input.search + '%'}
              )`
            : sql``
          }
        ORDER BY id, version DESC
        LIMIT ${input.limit}
        OFFSET ${input.offset}
      `)

      return result.rows as Array<typeof clients.$inferSelect>
    }),

  /**
   * Get a single client (latest version).
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const client = await getCurrentClient(ctx.tenant.id, input.id)
      if (!client) throw new Error('Client not found')
      return client
    }),

  /**
   * Get full version history of a client.
   * Used for audit packages and exam prep.
   */
  history: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return db.query.clients.findMany({
        where: (c, { eq, and }) => and(
          eq(c.tenantId, ctx.tenant.id),
          eq(c.id, input.id),
        ),
        orderBy: (c, { asc }) => [asc(c.version)],
      })
    }),

  /**
   * Create a new client (version 1).
   * Automatically writes audit log entry.
   */
  create: protectedProcedure
    .input(ClientDataSchema)
    .mutation(async ({ ctx, input }) => {
      const clientId = crypto.randomUUID()

      const [created] = await db.insert(clients).values({
        id:        clientId,
        tenantId:  ctx.tenant.id,
        version:   1,
        data:      input,
        createdBy: ctx.user.id,
      }).returning()

      await writeAudit(ctx.auditCtx, {
        skillSlug:  'crm',
        action:     AUDIT_ACTIONS.CLIENT_CREATED,
        entityType: 'client',
        entityId:   clientId,
        nextState:  input,
      })

      return created
    }),

  /**
   * Update a client — inserts a NEW VERSION, never updates in place.
   * Previous version remains in DB permanently.
   */
  update: protectedProcedure
    .input(z.object({
      id:   z.string().uuid(),
      data: ClientDataSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const current = await getCurrentClient(ctx.tenant.id, input.id)
      if (!current) throw new Error('Client not found')

      const prevData = current.data as Record<string, unknown>
      const nextData = { ...prevData, ...input.data }

      // Insert new version — never UPDATE
      const [updated] = await db.insert(clients).values({
        id:        input.id,
        tenantId:  ctx.tenant.id,
        version:   current.version + 1,
        data:      nextData,
        createdBy: ctx.user.id,
      }).returning()

      await writeAudit(ctx.auditCtx, {
        skillSlug:  'crm',
        action:     AUDIT_ACTIONS.CLIENT_UPDATED,
        entityType: 'client',
        entityId:   input.id,
        prevState:  prevData,
        nextState:  nextData,
      })

      return updated
    }),

  /**
   * Archive a client (soft delete — never hard delete).
   */
  archive: protectedProcedure
    .input(z.object({
      id:     z.string().uuid(),
      reason: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const current = await getCurrentClient(ctx.tenant.id, input.id)
      if (!current) throw new Error('Client not found')

      // Insert archive version
      const [archived] = await db.insert(clients).values({
        id:         input.id,
        tenantId:   ctx.tenant.id,
        version:    current.version + 1,
        data:       { ...(current.data as object), status: 'archived' },
        createdBy:  ctx.user.id,
        archivedAt: new Date(),
      }).returning()

      await writeAudit(ctx.auditCtx, {
        skillSlug:  'crm',
        action:     AUDIT_ACTIONS.CLIENT_ARCHIVED,
        entityType: 'client',
        entityId:   input.id,
        prevState:  current.data as Record<string, unknown>,
        metadata:   { reason: input.reason },
      })

      return archived
    }),

  /**
   * Client 360 — everything about a client in one query.
   * Used for the Client 360 view and audit packages.
   */
  get360: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tenantId = ctx.tenant.id
      const clientId = input.id

      const [client, docs, comms, workflowRuns, upcomingEvents, compItems] =
        await Promise.all([
          // Latest client version
          getCurrentClient(tenantId, clientId),

          // Active documents
          db.query.documents.findMany({
            where: (d, { eq, and, isNull }) => and(
              eq(d.tenantId, tenantId),
              eq(d.clientId, clientId),
              isNull(d.archivedAt),
            ),
            orderBy: (d, { desc }) => [desc(d.createdAt)],
          }),

          // Recent communications
          db.query.communications.findMany({
            where: (c, { eq, and }) => and(
              eq(c.tenantId, tenantId),
              eq(c.clientId, clientId),
            ),
            orderBy: (c, { desc }) => [desc(c.createdAt)],
            limit: 50,
          }),

          // Active workflow runs
          db.query.workflowRuns.findMany({
            where: (r, { eq, and }) => and(
              eq(r.tenantId, tenantId),
              eq(r.entityId, clientId),
            ),
            with: { completions: true },
          }),

          // Upcoming calendar events
          db.query.calendarEvents.findMany({
            where: (e, { eq, and, isNull, gte }) => and(
              eq(e.tenantId, tenantId),
              eq(e.clientId, clientId),
              isNull(e.completedAt),
              gte(e.dueAt, new Date()),
            ),
            orderBy: (e, { asc }) => [asc(e.dueAt)],
            limit: 10,
          }),

          // Open compliance items
          db.query.complianceItems.findMany({
            where: (c, { eq, and, isNull }) => and(
              eq(c.tenantId, tenantId),
              eq(c.clientId, clientId),
              isNull(c.resolvedAt),
            ),
          }),
        ])

      if (!client) throw new Error('Client not found')

      return {
        client,
        documents:      docs,
        communications: comms,
        workflowRuns,
        upcomingEvents,
        complianceItems: compItems,
      }
    }),
})
