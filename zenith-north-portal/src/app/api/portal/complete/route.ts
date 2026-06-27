/**
 * POST /api/portal/complete
 * Called when a client completes a portal step.
 * Validates token, then calls back to the main Zenith North API
 * to advance the workflow step.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validatePortalToken } from '@/lib/token'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { token, stepData } = body

  if (!token || !stepData) {
    return NextResponse.json({ error: 'Missing token or data' }, { status: 400 })
  }

  // Validate the token
  const payload = validatePortalToken(token)
  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid or expired token.' },
      { status: 401 }
    )
  }

  // Call back to the main Zenith North API to advance the workflow step
  // Service-to-service call authenticated with a shared secret
  const mainApiUrl = process.env.MAIN_API_URL ?? 'https://api.zenith-north.com'
  const serviceSecret = process.env.SERVICE_SECRET ?? 'change-me'

  try {
    const response = await fetch(`${mainApiUrl}/api/portal/step-complete`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'X-Service-Token': serviceSecret,
      },
      body: JSON.stringify({
        runId:    payload.runId,
        stepId:   payload.stepId,
        clientId: payload.clientId,
        tenantId: payload.tenantId,
        stepType: payload.stepType,
        actorType: 'client',
        data: {
          ...stepData,
          completedAt: new Date().toISOString(),
          portalToken: token.slice(0, 8) + '...',  // log token prefix for audit
          userAgent:   request.headers.get('user-agent'),
          ipAddress:   request.headers.get('x-forwarded-for'),
        },
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return NextResponse.json(
        { error: err.error ?? 'Failed to record completion.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[PORTAL] Failed to call main API:', err)

    // In development, return success anyway so we can test the UI
    if (process.env.NODE_ENV === 'development') {
      console.log('[PORTAL DEV] Mocking successful completion for step:', payload.stepType)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { error: 'Unable to record completion. Please try again.' },
      { status: 500 }
    )
  }
}
