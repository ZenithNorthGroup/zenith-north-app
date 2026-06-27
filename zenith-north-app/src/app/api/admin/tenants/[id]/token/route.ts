import { NextRequest, NextResponse } from 'next/server'
import { validateAdminRequest, adminUnauthorized } from '../../../middleware'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  const token = 'zn_live_' + randomBytes(32).toString('hex')

  await db.execute(sql`
    UPDATE tenants
    SET config = config || ${JSON.stringify({ integrationToken: token })}::jsonb
    WHERE id = ${params.id} AND archived_at IS NULL
  `)

  return NextResponse.json({ token })
}
