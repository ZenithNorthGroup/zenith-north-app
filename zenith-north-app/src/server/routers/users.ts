/**
 * ZENITH NORTH — Users Router
 * Full team management: invite, update role, remove members.
 */

import { z } from 'zod'
import { router, protectedProcedure, withPermission } from '@/lib/trpc'
import { db, users } from '@/lib/db'
import { eq, and, isNull, sql } from 'drizzle-orm'

export const usersRouter = router({

  /** List all team members for this tenant */
  list: withPermission('settings.view')
    .query(async ({ ctx }) => {
      const result = await db.execute(sql`
        SELECT
          u.id, u.email, u.full_name, u.role, u.is_cco,
          u.client_scope, u.title, u.phone, u.avatar_url,
          u.last_seen_at, u.created_at, u.archived_at,
          COUNT(DISTINCT c.id) as client_count
        FROM users u
        LEFT JOIN clients c
          ON c.assigned_advisor_id = u.id
          AND c.archived_at IS NULL
        WHERE u.tenant_id = ${ctx.tenant.id}
          AND u.archived_at IS NULL
        GROUP BY u.id
        ORDER BY u.created_at ASC
      `)
      return result.rows as any[]
    }),

  /** Invite a new team member — creates user row, sends Clerk invite */
  invite: withPermission('settings.manage_team')
    .input(z.object({
      email:       z.string().email(),
      fullName:    z.string().min(1),
      role:        z.enum(['owner', 'cco', 'advisor', 'operations', 'associate']),
      title:       z.string().optional(),
      isCco:       z.boolean().default(false),
      clientScope: z.enum(['all', 'own', 'assigned']).default('all'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check not already a member
      const existing = await db.execute(sql`
        SELECT id FROM users
        WHERE tenant_id = ${ctx.tenant.id}
          AND email = ${input.email}
          AND archived_at IS NULL
        LIMIT 1
      `)
      if (existing.rows.length > 0) {
        throw new Error('A team member with this email already exists.')
      }

      // If designating as CCO, remove CCO from current holder
      if (input.isCco) {
        await db.execute(sql`
          UPDATE users SET is_cco = false
          WHERE tenant_id = ${ctx.tenant.id} AND is_cco = true
        `)
      }

      // Create user row with a placeholder clerk_user_id
      // They'll get a Clerk invite email and their clerk_user_id
      // will be updated when they first sign in via the webhook
      const placeholderId = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`

      const [newUser] = await db.insert(users).values({
        tenantId:    ctx.tenant.id,
        clerkUserId: placeholderId,
        email:       input.email,
        fullName:    input.fullName,
        role:        input.role,
        isCco:       input.isCco,
        clientScope: input.clientScope,
        title:       input.title,
        permissions: {},
      } as any).returning()

      // Log audit entry
      await db.execute(sql`
        INSERT INTO audit_log (tenant_id, user_id, skill_slug, action, entity_type, entity_id, next_state)
        VALUES (
          ${ctx.tenant.id}, ${ctx.user.id}, 'system', 'user.invited',
          'user', ${newUser.id},
          ${JSON.stringify({ email: input.email, role: input.role })}::jsonb
        )
      `)

      return newUser
    }),

  /** Update a team member's role or settings */
  update: withPermission('settings.manage_team')
    .input(z.object({
      userId:      z.string().uuid(),
      role:        z.enum(['owner', 'cco', 'advisor', 'operations', 'associate']).optional(),
      title:       z.string().optional(),
      isCco:       z.boolean().optional(),
      clientScope: z.enum(['all', 'own', 'assigned']).optional(),
      permissions: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId, ...updates } = input

      // If setting as CCO, clear existing CCO
      if (updates.isCco) {
        await db.execute(sql`
          UPDATE users SET is_cco = false
          WHERE tenant_id = ${ctx.tenant.id} AND is_cco = true AND id != ${userId}
        `)
      }

      const setClauses: string[] = []
      const values: any = {}

      if (updates.role        !== undefined) { setClauses.push(`role = '${updates.role}'`) }
      if (updates.title       !== undefined) { setClauses.push(`title = '${updates.title}'`) }
      if (updates.isCco       !== undefined) { setClauses.push(`is_cco = ${updates.isCco}`) }
      if (updates.clientScope !== undefined) { setClauses.push(`client_scope = '${updates.clientScope}'`) }
      if (updates.permissions !== undefined) {
        setClauses.push(`permissions = '${JSON.stringify(updates.permissions)}'::jsonb`)
      }

      if (setClauses.length === 0) return { success: true }

      await db.execute(sql`
        UPDATE users
        SET ${sql.raw(setClauses.join(', '))}
        WHERE id = ${userId} AND tenant_id = ${ctx.tenant.id}
      `)

      return { success: true }
    }),

  /** Remove (archive) a team member */
  remove: withPermission('settings.manage_team')
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Cannot remove yourself
      if (input.userId === ctx.user.id) {
        throw new Error('You cannot remove yourself.')
      }

      await db.execute(sql`
        UPDATE users
        SET archived_at = NOW()
        WHERE id = ${input.userId} AND tenant_id = ${ctx.tenant.id}
      `)

      return { success: true }
    }),

  /** Get a single user's full profile */
  get: withPermission('settings.view')
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await db.execute(sql`
        SELECT u.*,
          COUNT(DISTINCT c.id) as client_count
        FROM users u
        LEFT JOIN clients c ON c.assigned_advisor_id = u.id AND c.archived_at IS NULL
        WHERE u.id = ${input.userId}
          AND u.tenant_id = ${ctx.tenant.id}
        GROUP BY u.id
        LIMIT 1
      `)
      if (!result.rows.length) throw new Error('User not found')
      return result.rows[0] as any
    }),
})
