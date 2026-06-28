/**
 * ZENITH NORTH — tRPC Setup
 * Procedures, middleware, and router factory
 */

import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import type { Context } from './context'
import { resolvePermissions, type Permission } from '@/lib/auth/permissions'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

// ── Base auth middleware ───────────────────────────────────

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.clerkUserId || !ctx.user || !ctx.tenant) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in.',
    })
  }

  // Resolve full permission set for this user
  const customRoles = (ctx.tenant.config as any)?.customRoles ?? []
  const permissions = resolvePermissions(
    ctx.user.role,
    (ctx.user.permissions as string[] | null) ?? [],
    customRoles,
  )

  return next({
    ctx: {
      ...ctx,
      clerkUserId: ctx.clerkUserId,
      user:        ctx.user,
      tenant:      ctx.tenant,
      permissions, // now available in every procedure
    },
  })
})

// ── Permission-aware middleware factory ───────────────────

/**
 * Creates a middleware that requires one or more permissions.
 * Usage: t.procedure.use(requirePermission('compliance.resolve'))
 *
 * Owner always passes — they have all permissions.
 */
function requirePermission(...required: Permission[]) {
  return enforceAuth.unstable_pipe(({ ctx, next }) => {
    // Owner bypasses all permission checks
    if (ctx.user.role === 'owner') return next({ ctx })

    const missing = required.filter(p => !ctx.permissions.has(p))
    if (missing.length > 0) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Missing permission: ${missing[0]}`,
      })
    }

    return next({ ctx })
  })
}

// ── Admin/CCO enforcement ─────────────────────────────────

const enforceAdminRole = enforceAuth.unstable_pipe(({ ctx, next }) => {
  if (!['owner', 'cco'].includes(ctx.user.role) && !ctx.permissions.has('compliance.resolve')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This action requires admin or CCO permissions.',
    })
  }
  return next({ ctx })
})

// ── Procedure exports ─────────────────────────────────────

export const router             = t.router
export const publicProcedure    = t.procedure
export const protectedProcedure = t.procedure.use(enforceAuth)
export const adminProcedure     = t.procedure.use(enforceAdminRole)
export const createCallerFactory = t.createCallerFactory

/**
 * Permission-gated procedure factory.
 *
 * Usage in routers:
 *   withPermission('clients.edit').mutation(...)
 *   withPermission('compliance.resolve').mutation(...)
 *   withPermission('audit.export').query(...)
 */
export function withPermission(...perms: Permission[]) {
  return t.procedure.use(requirePermission(...perms))
}
