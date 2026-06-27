/**
 * ZENITH NORTH CLIENT PORTAL — Magic Link Auth
 *
 * Clients access the portal via a time-limited magic link.
 * No password required. Link expires after 7 days.
 * Each workflow step generates a new link specific to that step.
 *
 * Token structure (JWT-like but simpler):
 *   {base64(payload)}.{hmac-sha256(payload, secret)}
 *
 * Payload:
 *   { runId, stepId, clientId, tenantId, expires, stepType }
 *
 * Link format:
 *   https://portal.zenith-north.com/onboarding?token=xxx
 *
 * SECURITY:
 *   - HMAC signature prevents forgery
 *   - Expiry prevents replay attacks
 *   - stepId ties token to a specific workflow step
 *   - Once used, token cannot be reused (stepId completion logged)
 */

import { createHmac } from 'crypto'

export interface PortalTokenPayload {
  runId:     string
  stepId:    string
  clientId:  string
  tenantId:  string
  stepType:  string       // 'risk_profile' | 'sign_agreement' | 'deliver_adv' | etc.
  stepName:  string       // human-readable step name
  firmName:  string       // firm name for display
  expires:   number       // unix timestamp
}

const SECRET = process.env.PORTAL_SECRET ?? 'change-me-in-production'

export function generatePortalToken(payload: PortalTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig     = createHmac('sha256', SECRET).update(encoded).digest('hex')
  return `${encoded}.${sig}`
}

export function validatePortalToken(token: string): PortalTokenPayload | null {
  try {
    const [encoded, sig] = token.split('.')
    if (!encoded || !sig) return null

    // Verify signature
    const expected = createHmac('sha256', SECRET).update(encoded).digest('hex')
    if (expected !== sig) return null

    // Decode payload
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as PortalTokenPayload

    // Check expiry
    if (Date.now() > payload.expires) return null

    return payload
  } catch {
    return null
  }
}

export function generatePortalLink(
  payload: Omit<PortalTokenPayload, 'expires'>,
  expiryDays = 7
): string {
  const fullPayload: PortalTokenPayload = {
    ...payload,
    expires: Date.now() + expiryDays * 24 * 60 * 60 * 1000,
  }

  const token = generatePortalToken(fullPayload)
  const baseUrl = process.env.PORTAL_URL ?? 'https://portal.zenith-north.com'
  return `${baseUrl}/onboarding?token=${token}`
}
