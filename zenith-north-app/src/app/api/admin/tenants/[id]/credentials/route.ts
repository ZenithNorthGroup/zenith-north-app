/**
 * GET  /api/admin/tenants/[id]/credentials — list credentials (masked)
 * POST /api/admin/tenants/[id]/credentials — save credentials (encrypted)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateAdminRequest, adminUnauthorized } from '../../../middleware'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import {
  CREDENTIAL_FIELDS,
  prepareCredentialsForSave,
  isEncrypted,
  type CredentialKey,
} from '@/lib/credentials'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  const { id } = params

  const result = await db.execute(sql`
    SELECT id, slug, config FROM tenants WHERE id = ${id} LIMIT 1
  `)
  if (!result.rows.length) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const row    = result.rows[0] as any
  const config = row.config as Record<string, any>
  const slug   = row.slug as string

  // Return masked view of all credentials
  const masked: Record<string, { isSet: boolean; maskedValue: string }> = {}

  for (const [key, def] of Object.entries(CREDENTIAL_FIELDS)) {
    const rawValue = config[key]
    const isSet    = !!rawValue

    let maskedValue = ''
    if (isSet && def.sensitive) {
      maskedValue = '••••••••' + (
        isEncrypted(rawValue)
          ? rawValue.split(':')[2]?.slice(-8) ?? '????'
          : String(rawValue).slice(-4)
      )
    } else if (isSet) {
      maskedValue = String(rawValue)
    }

    masked[key] = { isSet, maskedValue }
  }

  // Add read-only journal address
  masked['emailJournalAddress'] = {
    isSet: true,
    maskedValue: `ingest-${slug}@mail.zenith-north.com`,
  }

  return NextResponse.json(masked)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  const { id } = params
  const body   = await request.json()
  const { credentials } = body

  if (!credentials || typeof credentials !== 'object') {
    return NextResponse.json({ error: 'credentials object required' }, { status: 400 })
  }

  // Encrypt sensitive fields
  const prepared = prepareCredentialsForSave(
    credentials as Partial<Record<CredentialKey, string>>
  )

  if (Object.keys(prepared).length === 0) {
    return NextResponse.json({ success: true, saved: 0 })
  }

  await db.execute(sql`
    UPDATE tenants
    SET config = config || ${JSON.stringify(prepared)}::jsonb
    WHERE id = ${id}
  `)

  return NextResponse.json({ success: true, saved: Object.keys(prepared).length })
}
