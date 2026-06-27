import { NextRequest, NextResponse } from 'next/server'
import { validateAdminRequest, adminUnauthorized } from '../middleware'

export async function POST(request: NextRequest) {
  if (!validateAdminRequest(request)) return adminUnauthorized()

  const body = await request.json().catch(() => ({}))

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/compliance/engine`,
    {
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'x-cron-secret':  process.env.CRON_SECRET ?? '',
      },
      body: JSON.stringify({ tenantId: body.tenantId }),
    }
  )

  const result = await response.json()
  return NextResponse.json(result)
}
