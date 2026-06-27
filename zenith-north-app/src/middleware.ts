import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Routes that require authentication
const isDashboardRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/clients(.*)',
  '/workflows(.*)',
  '/tasks(.*)',
  '/calendar(.*)',
  '/messages(.*)',
  '/compliance(.*)',
  '/documents(.*)',
  '/audit(.*)',
  '/builder(.*)',
  '/ai(.*)',
  '/reports(.*)',
  '/api/trpc(.*)',
])

// Client portal routes — different auth flow (magic link)
const isPortalRoute = createRouteMatcher(['/portal(.*)'])

export default clerkMiddleware((auth, request) => {
  if (isDashboardRoute(request)) {
    auth().protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
