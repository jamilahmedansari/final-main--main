/**
 * Structured Logging System
 * Provides consistent, structured logging for monitoring and debugging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  module: string
  message: string
  data?: Record<string, unknown>
  error?: {
    message: string
    stack?: string
    code?: string
  }
  duration?: number
  userId?: string
  requestId?: string
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
}

class StructuredLogger {
  private module: string
  private minLevel: LogLevel
  private isDevelopment: boolean

  constructor(module: string, minLevel: LogLevel = 'info') {
    this.module = module
    this.minLevel = minLevel
    this.isDevelopment = process.env.NODE_ENV === 'development'
  }

  /**
   * Create a log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      data,
      error: error
        ? {
            message: error.message,
            stack: this.isDevelopment ? error.stack : undefined,
            code: (error as any).code
          }
        : undefined
    }
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (LOG_LEVELS[entry.level] < LOG_LEVELS[this.minLevel]) {
      return
    }

    const output = {
      ...entry,
      timestamp: entry.timestamp,
      level: entry.level.toUpperCase(),
      module: entry.module
    }

    switch (entry.level) {
      case 'debug':
        console.debug(JSON.stringify(output))
        break
      case 'info':
        console.log(JSON.stringify(output))
        break
      case 'warn':
        console.warn(JSON.stringify(output))
        break
      case 'error':
        console.error(JSON.stringify(output))
        break
      case 'fatal':
        console.error(JSON.stringify(output))
        break
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.output(this.createEntry('debug', message, data))
  }

  /**
   * Log info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.output(this.createEntry('info', message, data))
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: Record<string, unknown>, error?: Error): void {
    this.output(this.createEntry('warn', message, data, error))
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.output(this.createEntry('error', message, data, error))
  }

  /**
   * Log fatal error
   */
  fatal(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.output(this.createEntry('fatal', message, data, error))
  }

  /**
   * Log with duration (for performance tracking)
   */
  timed(
    message: string,
    duration: number,
    data?: Record<string, unknown>,
    level: LogLevel = 'info'
  ): void {
    const entry = this.createEntry(level, message, { ...data, duration })
    this.output(entry)
  }

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): ContextualLogger {
    return new ContextualLogger(this.module, context, this.minLevel)
  }
}

/**
 * Contextual Logger - includes additional context in all logs
 */
class ContextualLogger {
  private logger: StructuredLogger
  private context: Record<string, unknown>

  constructor(module: string, context: Record<string, unknown>, minLevel: LogLevel = 'info') {
    this.logger = new StructuredLogger(module, minLevel)
    this.context = context
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(message, { ...this.context, ...data })
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(message, { ...this.context, ...data })
  }

  warn(message: string, data?: Record<string, unknown>, error?: Error): void {
    this.logger.warn(message, { ...this.context, ...data }, error)
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.logger.error(message, error, { ...this.context, ...data })
  }

  fatal(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.logger.fatal(message, error, { ...this.context, ...data })
  }

  timed(
    message: string,
    duration: number,
    data?: Record<string, unknown>,
    level: LogLevel = 'info'
  ): void {
    this.logger.timed(message, duration, { ...this.context, ...data }, level)
  }
}

/**
 * Create a logger instance
 */
export function createLogger(module: string, minLevel: LogLevel = 'info'): StructuredLogger {
  return new StructuredLogger(module, minLevel)
}

/**
 * Performance timer utility
 */
export class PerformanceTimer {
  private startTime: number
  private logger: StructuredLogger
  private label: string

  constructor(logger: StructuredLogger, label: string) {
    this.logger = logger
    this.label = label
    this.startTime = Date.now()
  }

  /**
   * End the timer and log the duration
   */
  end(data?: Record<string, unknown>, level: LogLevel = 'info'): number {
    const duration = Date.now() - this.startTime
    this.logger.timed(`${this.label} completed`, duration, data, level)
    return duration
  }

  /**
   * Get elapsed time without logging
   */
  elapsed(): number {
    return Date.now() - this.startTime
  }
}

export { StructuredLogger, ContextualLogger }
