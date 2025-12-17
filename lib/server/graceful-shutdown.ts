/**
 * Graceful Shutdown Handler
 * Handles cleanup and shutdown procedures for production deployments
 */

interface ShutdownHandler {
  name: string
  handler: () => Promise<void>
  timeout?: number
}

class GracefulShutdownManager {
  private handlers: ShutdownHandler[] = []
  private isShuttingDown = false
  private shutdownTimeout = 30000 // 30 seconds default

  constructor() {
    // Register signal handlers
    process.on('SIGTERM', () => this.shutdown('SIGTERM'))
    process.on('SIGINT', () => this.shutdown('SIGINT'))
    process.on('SIGHUP', () => this.shutdown('SIGHUP'))
  }

  /**
   * Register a shutdown handler
   */
  register(name: string, handler: () => Promise<void>, timeout?: number): void {
    this.handlers.push({ name, handler, timeout })
    console.log(`[GracefulShutdown] Registered handler: ${name}`)
  }

  /**
   * Execute shutdown sequence
   */
  private async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      console.log(`[GracefulShutdown] Shutdown already in progress, ignoring ${signal}`)
      return
    }

    this.isShuttingDown = true
    console.log(`[GracefulShutdown] Received ${signal}, starting graceful shutdown...`)

    // Create a timeout to force exit if shutdown takes too long
    const forceExitTimer = setTimeout(() => {
      console.error('[GracefulShutdown] Shutdown timeout exceeded, forcing exit')
      process.exit(1)
    }, this.shutdownTimeout)

    try {
      // Execute all handlers in sequence
      for (const handler of this.handlers) {
        try {
          console.log(`[GracefulShutdown] Executing handler: ${handler.name}`)
          const timeout = handler.timeout || 10000

          // Execute with timeout
          await Promise.race([
            handler.handler(),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error(`Handler ${handler.name} timeout`)),
                timeout
              )
            )
          ])

          console.log(`[GracefulShutdown] Handler completed: ${handler.name}`)
        } catch (error) {
          console.error(`[GracefulShutdown] Handler failed: ${handler.name}`, error)
        }
      }

      clearTimeout(forceExitTimer)
      console.log('[GracefulShutdown] Shutdown completed successfully')
      process.exit(0)
    } catch (error) {
      console.error('[GracefulShutdown] Unexpected error during shutdown:', error)
      clearTimeout(forceExitTimer)
      process.exit(1)
    }
  }

  /**
   * Set the overall shutdown timeout
   */
  setShutdownTimeout(ms: number): void {
    this.shutdownTimeout = ms
  }
}

let shutdownManager: GracefulShutdownManager | null = null

export function getShutdownManager(): GracefulShutdownManager {
  if (!shutdownManager) {
    shutdownManager = new GracefulShutdownManager()
  }
  return shutdownManager
}

export { GracefulShutdownManager }
