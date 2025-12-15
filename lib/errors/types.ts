export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'CONFIGURATION_ERROR'
  | 'PAYMENT_ERROR'
  | 'AI_GENERATION_ERROR'

export interface AppErrorOptions {
  code: ErrorCode
  message: string
  statusCode?: number
  details?: Record<string, unknown>
  cause?: Error
  isOperational?: boolean
}

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details?: Record<string, unknown>
  public readonly isOperational: boolean
  public readonly timestamp: string

  constructor(options: AppErrorOptions) {
    super(options.message)
    this.name = 'AppError'
    this.code = options.code
    this.statusCode = options.statusCode || this.getDefaultStatusCode(options.code)
    this.details = options.details
    this.isOperational = options.isOperational ?? true
    this.timestamp = new Date().toISOString()

    if (options.cause) {
      this.cause = options.cause
    }

    Error.captureStackTrace(this, this.constructor)
  }

  private getDefaultStatusCode(code: ErrorCode): number {
    const statusCodes: Record<ErrorCode, number> = {
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      VALIDATION_ERROR: 400,
      RATE_LIMITED: 429,
      INTERNAL_ERROR: 500,
      SERVICE_UNAVAILABLE: 503,
      DATABASE_ERROR: 500,
      EXTERNAL_SERVICE_ERROR: 502,
      CONFIGURATION_ERROR: 500,
      PAYMENT_ERROR: 402,
      AI_GENERATION_ERROR: 500,
    }
    return statusCodes[code]
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    }
  }

  toResponse() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    }
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function createError(code: ErrorCode, message: string, details?: Record<string, unknown>): AppError {
  return new AppError({ code, message, details })
}

export const Errors = {
  unauthorized: (message = 'Authentication required') =>
    new AppError({ code: 'UNAUTHORIZED', message }),

  forbidden: (message = 'Access denied') =>
    new AppError({ code: 'FORBIDDEN', message }),

  notFound: (resource = 'Resource') =>
    new AppError({ code: 'NOT_FOUND', message: `${resource} not found` }),

  validation: (message: string, details?: Record<string, unknown>) =>
    new AppError({ code: 'VALIDATION_ERROR', message, details }),

  rateLimited: (message = 'Too many requests. Please try again later.') =>
    new AppError({ code: 'RATE_LIMITED', message }),

  internal: (message = 'An unexpected error occurred', cause?: Error) =>
    new AppError({ code: 'INTERNAL_ERROR', message, cause, isOperational: false }),

  database: (message = 'Database operation failed', cause?: Error) =>
    new AppError({ code: 'DATABASE_ERROR', message, cause }),

  externalService: (service: string, message?: string, cause?: Error) =>
    new AppError({
      code: 'EXTERNAL_SERVICE_ERROR',
      message: message || `${service} service is unavailable`,
      details: { service },
      cause,
    }),

  configuration: (message: string) =>
    new AppError({ code: 'CONFIGURATION_ERROR', message }),

  payment: (message: string, details?: Record<string, unknown>) =>
    new AppError({ code: 'PAYMENT_ERROR', message, details }),

  aiGeneration: (message = 'AI generation failed', cause?: Error) =>
    new AppError({ code: 'AI_GENERATION_ERROR', message, cause }),
}
