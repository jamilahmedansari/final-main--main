/**
 * Root Middleware
 *
 * This file activates Next.js middleware for all routes.
 * It exports the updateSession function from lib/supabase/middleware.ts
 * which handles:
 * - Supabase session refresh
 * - Request ID tracing
 * - Route protection (admin, employee, subscriber)
 * - Performance monitoring
 */

export { updateSession as middleware } from '@/lib/supabase/middleware'

/**
 * Configure which routes middleware should run on
 *
 * Match all routes except:
 * - Static files (_next/static)
 * - Images (_next/image)
 * - Favicon
 * - Public assets
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
