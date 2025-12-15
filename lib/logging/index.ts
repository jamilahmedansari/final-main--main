export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: unknown
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function getMinLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

function shouldLog(level: LogLevel): boolean {
  const minLevel = getMinLogLevel()
  return LOG_LEVELS[level] >= LOG_LEVELS[minLevel]
}

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return ''
  }

  const formatted = Object.entries(context)
    .map(([key, value]) => {
      if (value instanceof Error) {
        return `${key}=${value.message}`
      }
      if (typeof value === 'object') {
        try {
          return `${key}=${JSON.stringify(value)}`
        } catch {
          return `${key}=[Object]`
        }
      }
      return `${key}=${value}`
    })
    .join(' ')

  return ` | ${formatted}`
}

function formatLogEntry(entry: LogEntry): string {
  const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`
  const contextStr = formatContext(entry.context)
  return `${prefix} ${entry.message}${contextStr}`
}

function createLogEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  }
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return
  }

  const entry = createLogEntry(level, message, context)

  if (process.env.LOG_FORMAT === 'json') {
    const jsonOutput = JSON.stringify({
      ...entry,
      context: entry.context,
    })

    switch (level) {
      case 'error':
        console.error(jsonOutput)
        break
      case 'warn':
        console.warn(jsonOutput)
        break
      default:
        console.log(jsonOutput)
    }
  } else {
    const formatted = formatLogEntry(entry)

    switch (level) {
      case 'error':
        console.error(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'debug':
        console.debug(formatted)
        break
      default:
        console.log(formatted)
    }
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),

  child: (baseContext: LogContext) => ({
    debug: (message: string, context?: LogContext) =>
      log('debug', message, { ...baseContext, ...context }),
    info: (message: string, context?: LogContext) =>
      log('info', message, { ...baseContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      log('warn', message, { ...baseContext, ...context }),
    error: (message: string, context?: LogContext) =>
      log('error', message, { ...baseContext, ...context }),
  }),

  request: (method: string, path: string, context?: LogContext) =>
    log('info', `${method} ${path}`, context),

  response: (method: string, path: string, statusCode: number, duration: number, context?: LogContext) =>
    log('info', `${method} ${path} ${statusCode} ${duration}ms`, context),
}

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId })
}
