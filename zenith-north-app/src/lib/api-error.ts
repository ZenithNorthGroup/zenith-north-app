/**
 * ZENITH NORTH — API Error Handler
 * Wraps route handlers with consistent error handling and logging.
 */

import { NextRequest, NextResponse } from 'next/server'

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type RouteHandler = (
  request: NextRequest,
  context?: any
) => Promise<NextResponse>

/**
 * Wraps a route handler with error handling.
 * Usage: export const POST = withErrorHandling(async (req) => { ... })
 */
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: any) => {
    try {
      return await handler(request, context)
    } catch (error) {
      // Known API errors
      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.statusCode }
        )
      }

      // Database errors
      if (error instanceof Error) {
        const msg = error.message

        if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
          return NextResponse.json(
            { error: 'A record with this value already exists.' },
            { status: 409 }
          )
        }

        if (msg.includes('foreign key')) {
          return NextResponse.json(
            { error: 'Referenced record does not exist.' },
            { status: 400 }
          )
        }

        if (msg.includes('not found') || msg.includes('No rows')) {
          return NextResponse.json(
            { error: 'Record not found.' },
            { status: 404 }
          )
        }
      }

      // Unknown error — log and return 500
      console.error('[API Error]', {
        url:     request.url,
        method:  request.method,
        error:   error instanceof Error ? error.message : String(error),
        stack:   error instanceof Error ? error.stack : undefined,
      })

      return NextResponse.json(
        { error: 'An unexpected error occurred. Please try again.' },
        { status: 500 }
      )
    }
  }
}

/**
 * Rate limiting store (in-memory, resets on cold start).
 * For production, use Upstash Redis via @upstash/ratelimit.
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt }
}

export function rateLimitResponse(resetAt: number): NextResponse {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000)
  return NextResponse.json(
    { error: 'Rate limit exceeded. Please slow down.' },
    {
      status: 429,
      headers: {
        'Retry-After':       String(retryAfter),
        'X-RateLimit-Reset': String(resetAt),
      }
    }
  )
}
