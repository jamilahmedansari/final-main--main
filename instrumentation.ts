/**
 * Next.js Instrumentation API
 *
 * This file is automatically called when the Next.js server starts.
 * Use it to initialize global services, monitoring, and lifecycle handlers.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run instrumentation in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing server instrumentation...')

    // Initialize graceful shutdown handler
    const { getShutdownManager } = await import('./lib/server/graceful-shutdown')
    const shutdownManager = getShutdownManager()

    console.log('[Instrumentation] Graceful shutdown handler registered')

    // Register cleanup handlers for resources
    shutdownManager.registerHandler('database', async () => {
      console.log('[Shutdown] Closing database connections...')
      // Supabase client handles connection pooling automatically
      // No explicit cleanup needed for Supabase
    })

    shutdownManager.registerHandler('redis', async () => {
      console.log('[Shutdown] Closing Redis connections...')
      // Redis connections are handled by ioredis
      // They will be closed automatically by the graceful shutdown timeout
    })

    console.log('[Instrumentation] Server instrumentation complete')
  }
}
