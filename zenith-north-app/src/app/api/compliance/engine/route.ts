/**
 * POST /api/compliance/engine
 *
 * Triggers the compliance engine for all tenants or a specific tenant.
 * In production: called by Inngest cron at 2am UTC daily.
 * In development: call directly to test.
 *
 * Protected by a cron secret — not accessible without it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { runComplianceEngine } from '@/lib/compliance/engine'
import { sql } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  // Validate cron secret
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { tenantId } = body

  // Get tenants to process
  let tenantIds: string[]

  if (tenantId) {
    tenantIds = [tenantId]
  } else {
    // All active tenants
    const result = await db.execute(sql`
      SELECT id FROM tenants WHERE archived_at IS NULL
    `)
    tenantIds = (result.rows as Array<{ id: string }>).map(r => r.id)
  }

  const results = []

  for (const tid of tenantIds) {
    try {
      const result = await runComplianceEngine(tid)
      results.push(result)
    } catch (err) {
      console.error(`[COMPLIANCE ENGINE] Failed for tenant ${tid}:`, err)
      results.push({ tenantId: tid, error: String(err) })
    }
  }

  const totalCreated = results.reduce((sum, r: any) => sum + (r.itemsCreated ?? 0), 0)

  return NextResponse.json({
    status:          'complete',
    tenantsProcessed: tenantIds.length,
    totalItemsCreated: totalCreated,
    results,
  })
}
