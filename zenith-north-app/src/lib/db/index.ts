/**
 * ZENITH NORTH — Database Connection
 * Drizzle ORM + PostgreSQL (Neon / Supabase)
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// ── Connection ────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL!

// Neon requires SSL. For local dev without SSL, set
// PGSSLMODE=disable in your .env.local
const queryClient = postgres(connectionString, {
  max: 10,                // connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
})

export const db = drizzle(queryClient, {
  schema,
  logger: process.env.NODE_ENV === 'development',
})

export type DB = typeof db

// ── Tenant context helper ────────────────────────────────
// Sets the RLS session variable so Postgres enforces isolation

export async function withTenant<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Set session variable — RLS policies use this
  await queryClient`SELECT set_config('app.tenant_id', ${tenantId}, true)`
  return fn()
}

// ── Re-export schema ─────────────────────────────────────

export * from './schema'
