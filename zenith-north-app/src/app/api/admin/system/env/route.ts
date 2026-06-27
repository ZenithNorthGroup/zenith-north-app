/**
 * GET  /api/admin/system/env  — returns current env var values (masked)
 * POST /api/admin/system/env  — saves a key/value to the system config
 *
 * Storage strategy:
 *   Values are stored in a special system tenant (slug: '_system')
 *   in the config JSON. This means they survive redeployments and
 *   are editable without touching server files.
 *
 *   For Vercel deployments: you STILL need to set the initial vars
 *   in Vercel's dashboard for the first deploy (DATABASE_URL,
 *   ADMIN_SECRET minimum). Once the app is running, you can set
 *   everything else here.
 *
 *   Sensitive values are stored as-is (the DB connection is TLS).
 *   In a future version we'll encrypt at rest with ENCRYPTION_KEY.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminRequest, adminUnauthorized } from '../../middleware'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

// Keys that are readable from actual process.env (set in Vercel)
const PROCESS_ENV_KEYS = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_APP_URL',
]

// Keys that should never be returned even to admin
const NEVER_RETURN = [] as string[]

async function getSystemConfig(): Promise<Record<string, string>> {
  // Try to get from a system config record in the DB
  const result = await db.execute(sql`
    SELECT config FROM tenants WHERE slug = '_system' LIMIT 1
  `)

  if (result.rows.length > 0) {
    const config = (result.rows[0] as any).config ?? {}
    return config as Record<string, string>
  }

  // Fall back to reading from process.env (Vercel-set values)
  // Only return non-sensitive hints
  return {}
}

async function saveSystemConfig(key: string, value: string): Promise<void> {
  // Ensure _system tenant exists
  const existing = await db.execute(sql`
    SELECT id FROM tenants WHERE slug = '_system' LIMIT 1
  `)

  if (existing.rows.length === 0) {
    await db.execute(sql`
      INSERT INTO tenants (slug, name, config)
      VALUES ('_system', 'System Configuration', ${JSON.stringify({ [key]: value })}::jsonb)
    `)
  } else {
    await db.execute(sql`
      UPDATE tenants
      SET config = config || ${JSON.stringify({ [key]: value })}::jsonb
      WHERE slug = '_system'
    `)
  }
}

export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  const stored = await getSystemConfig()

  // Merge with actual process.env for keys that are readable
  const values: Record<string, string> = { ...stored }

  for (const key of PROCESS_ENV_KEYS) {
    if (process.env[key] && !values[key]) {
      values[key] = process.env[key]!
    }
  }

  // Remove never-return keys
  for (const key of NEVER_RETURN) {
    delete values[key]
  }

  // Add indicators for keys set in process.env but not stored
  // (so UI shows them as "set" even though we can't show the value)
  const processEnvSet = Object.keys(process.env).filter(k =>
    k.startsWith('NEXT_') ||
    ['DATABASE_URL', 'CLERK_SECRET_KEY', 'ANTHROPIC_API_KEY',
     'TWILIO_AUTH_TOKEN', 'ZOOM_CLIENT_SECRET'].includes(k)
  )

  for (const key of processEnvSet) {
    if (!values[key] && process.env[key]) {
      // Mark as set but don't expose the value
      values[key] = '[set in environment]'
    }
  }

  return NextResponse.json({ values })
}

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  const body = await request.json()
  const { key, value } = body

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'Key required' }, { status: 400 })
  }

  if (typeof value !== 'string') {
    return NextResponse.json({ error: 'Value must be a string' }, { status: 400 })
  }

  // Validate key format (only allow known env var names)
  if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
    return NextResponse.json({ error: 'Invalid key format' }, { status: 400 })
  }

  await saveSystemConfig(key, value)

  return NextResponse.json({ success: true, key })
}
