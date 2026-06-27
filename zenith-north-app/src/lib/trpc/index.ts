/**
 * ZENITH NORTH — tRPC Setup
 * Procedures, middleware, and router factory
 */

import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'
import type { Context } from './context'

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? error.cause.flatten()
            : null,
      },
    }
  },
})

// ── Middleware ────────────────────────────────────────────

/**
 * Enforces authentication.
 * All dashboard routes use protectedProcedure.
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.clerkUserId || !ctx.user || !ctx.tenant) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to perform this action.',
    })
  }
  return next({
    ctx: {
      ...ctx,
      // Narrow types — these are now guaranteed non-null
      clerkUserId: ctx.clerkUserId,
      user:        ctx.user,
      tenant:      ctx.tenant,
    },
  })
})

/**
 * Enforces admin or CCO role.
 * Used for approval steps, compliance config changes.
 */
const enforceAdminRole = enforceAuth.unstable_pipe(({ ctx, next }) => {
  if (!['owner', 'admin', 'cco'].includes(ctx.user.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This action requires admin or CCO permissions.',
    })
  }
  return next({ ctx })
})

// ── Procedure types ───────────────────────────────────────

export const router          = t.router
export const publicProcedure  = t.procedure
export const protectedProcedure = t.procedure.use(enforceAuth)
export const adminProcedure   = t.procedure.use(enforceAdminRole)
export const createCallerFactory = t.createCallerFactory
