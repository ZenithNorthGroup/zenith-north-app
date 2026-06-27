import { NextRequest, NextResponse } from 'next/server'
import { validateAdminRequest, adminUnauthorized } from '../middleware'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  const { searchParams } = request.nextUrl
  const tenantId = searchParams.get('tenantId')
  const source   = searchParams.get('source')
  const limit    = Number(searchParams.get('limit') ?? 100)

  // Errors are stored in audit log with action like 'error.*'
  // Also includes failed webhook deliveries stored in metadata
  const errors = await db.execute(sql`
    SELECT
      al.id,
      al.tenant_id,
      t.name as tenant_name,
      al.action as source,
      COALESCE(al.metadata->>'severity', 'error') as severity,
      COALESCE(al.metadata->>'message', al.action) as message,
      al.metadata->>'stack' as stack,
      al.metadata,
      al.metadata->>'resolvedAt' as resolved_at,
      al.created_at
    FROM audit_log al
    LEFT JOIN tenants t ON t.id = al.tenant_id
    WHERE al.action LIKE 'error.%'
      OR al.action LIKE '%.failed'
      OR al.action LIKE '%.error'
      ${tenantId ? sql`AND al.tenant_id = ${tenantId}` : sql``}
      ${source ? sql`AND al.action LIKE ${'%' + source + '%'}` : sql``}
    ORDER BY al.created_at DESC
    LIMIT ${limit}
  `)

  const formatted = (errors.rows as any[]).map(row => ({
    id:          row.id,
    tenantId:    row.tenant_id,
    tenantName:  row.tenant_name,
    source:      row.source.replace('error.', '').replace('.failed', '').replace('.error', ''),
    severity:    row.severity,
    message:     row.message,
    stack:       row.stack,
    metadata:    row.metadata,
    resolvedAt:  row.resolved_at,
    createdAt:   row.created_at,
  }))

  return NextResponse.json(formatted)
}
