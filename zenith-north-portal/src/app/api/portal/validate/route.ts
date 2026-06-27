/**
 * GET /api/portal/validate?token=xxx
 * Validates a portal magic link token and returns step data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validatePortalToken } from '@/lib/token'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json(
      { error: 'No access token provided.' },
      { status: 400 }
    )
  }

  const payload = validatePortalToken(token)

  if (!payload) {
    return NextResponse.json(
      { error: 'This link has expired or is invalid. Please request a new link from your adviser.' },
      { status: 401 }
    )
  }

  // Fetch step details from the main app API
  // In production: call the Zenith North API with a service-to-service token
  // For now: return the payload data directly
  return NextResponse.json({
    runId:      payload.runId,
    stepId:     payload.stepId,
    clientId:   payload.clientId,
    tenantId:   payload.tenantId,
    stepType:   payload.stepType,
    stepName:   payload.stepName,
    firmName:   payload.firmName,
    // These would come from the main API in production:
    totalSteps:     7,
    completedSteps: 2,
    stepNumber:     3,
    documentName:   payload.stepType === 'sign_agreement'
      ? 'Investment Advisory Agreement'
      : payload.stepType === 'deliver_adv'
      ? 'Form ADV Part 2'
      : undefined,
  })
}
