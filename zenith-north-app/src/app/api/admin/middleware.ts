/**
 * ZENITH NORTH — Admin API
 *
 * Protected endpoints called by the admin panel.
 * Every request requires X-Admin-Secret header.
 *
 * Routes:
 *   GET  /api/admin/tenants              — list all tenants with stats
 *   GET  /api/admin/tenants/[id]         — single tenant detail
 *   PATCH /api/admin/tenants/[id]/config — update tenant config
 *   POST /api/admin/tenants/[id]/token   — regenerate API token
 *   POST /api/admin/run-engine           — trigger compliance engine
 *   GET  /api/admin/errors               — list error log entries
 *   POST /api/admin/errors/[id]/resolve  — mark error resolved
 *   GET  /api/admin/health               — system health check
 *   GET  /api/admin/webhooks             — webhook delivery log
 */

import { NextRequest, NextResponse } from 'next/server'

export function validateAdminRequest(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret')
  return secret === process.env.ADMIN_SECRET
}

export function adminUnauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
