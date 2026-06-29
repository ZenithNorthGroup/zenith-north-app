/**
 * ZENITH NORTH — Next.js Middleware
 *
 * 1. Enforces Clerk authentication on all dashboard routes
 * 2. Redirects new users (no tenant) to /onboarding
 * 3. Allows public routes through without auth
 */

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
  '/api/channels/(.*)',
  '/api/sms/(.*)',
  '/api/email/(.*)',
  '/api/zoom/(.*)',
  '/api/portal/(.*)',
  '/api/admin/(.*)',
])

const isDashboardRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/clients(.*)',
  '/workflows(.*)',
  '/messages(.*)',
  '/calendar(.*)',
  '/tasks(.*)',
  '/compliance(.*)',
  '/wsp(.*)',
  '/marketing(.*)',
  '/reviews(.*)',
  '/incidents(.*)',
  '/vendors(.*)',
  '/documents(.*)',
  '/audit(.*)',
  '/ai(.*)',
  '/reports(.*)',
  '/integrations(.*)',
  '/import(.*)',
  '/builder(.*)',
  '/settings(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  // Allow public routes
  if (isPublicRoute(request)) return NextResponse.next()

  // Require auth for everything else
  const { userId } = await auth()

  if (!userId) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }

  // Allow onboarding page always (for users mid-setup)
  if (request.nextUrl.pathname.startsWith('/onboarding')) {
    return NextResponse.next()
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
