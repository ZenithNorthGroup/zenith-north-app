/**
 * ZENITH NORTH — tRPC Context
 *
 * Built once per request. Contains:
 *   - Authenticated user (from Clerk)
 *   - Resolved tenant
 *   - DB instance with tenant RLS set
 *   - Audit context for writing logs
 */

import { auth, currentUser } from '@clerk/nextjs/server'
import { TRPCError } from '@trpc/server'
import { db, withTenant } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { users, tenants } from '@/lib/db/schema'
import type { AuditContext } from '@/lib/audit'
import { headers } from 'next/headers'

export interface Context {
  // Auth
  clerkUserId:  string | null
  // Resolved from DB
  user:         typeof users.$inferSelect | null
  tenant:       typeof tenants.$inferSelect | null
  // Helpers
  db:           typeof db
  auditCtx:     AuditContext
}

export async function createContext(): Promise<Context> {
  const { userId: clerkUserId } = await auth()
  const headersList = await headers()

  const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headersList.get('x-real-ip')
    || undefined
  const userAgent = headersList.get('user-agent') || undefined

  // Unauthenticated — return minimal context
  if (!clerkUserId) {
    return {
      clerkUserId: null,
      user:        null,
      tenant:      null,
      db,
      auditCtx:    { tenantId: '', ipAddress, userAgent },
    }
  }

  // Resolve user + tenant from DB
  const user = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  })

  if (!user) {
    return {
      clerkUserId,
      user:    null,
      tenant:  null,
      db,
      auditCtx: { tenantId: '', userId: undefined, ipAddress, userAgent },
    }
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, user.tenantId),
  })

  // Set RLS session variable for this request
  if (tenant) {
    await db.execute(
      // Sets app.tenant_id for the duration of this connection
      // RLS policies use current_setting('app.tenant_id')
      `SELECT set_config('app.tenant_id', '${tenant.id}', false)`
    )
  }

  return {
    clerkUserId,
    user,
    tenant,
    db,
    auditCtx: {
      tenantId:  tenant?.id ?? '',
      userId:    user.id,
      ipAddress,
      userAgent,
    },
  }
}
