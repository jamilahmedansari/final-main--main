import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logging/structured-logger'

const logger = createLogger('ErrorHandler')

/**
 * Custom application error
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string = 'INTERNAL_ERROR',
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Unauthorized', details?: Record<string, unknown>) {
    super(401, message, 'AUTHENTICATION_ERROR', details)
    this.name = 'AuthenticationError'
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Forbidden', details?: Record<string, unknown>) {
    super(403, message, 'AUTHORIZATION_ERROR', details)
    this.name = 'AuthorizationError'
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, details?: Record<string, unknown>) {
    super(404, `${resource} not found`, 'NOT_FOUND', details)
    this.name = 'NotFoundError'
  }
}

/**
 * Conflict error
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(409, message, 'CONFLICT', details)
    this.name = 'ConflictError'
  }
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', retryAfter?: number) {
    super(429, message, 'RATE_LIMIT_EXCEEDED', { retryAfter })
    this.name = 'RateLimitError'
  }
}

/**
 * Service unavailable error
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service temporarily unavailable', details?: Record<string, unknown>) {
    super(503, message, 'SERVICE_UNAVAILABLE', details)
    this.name = 'ServiceUnavailableError'
  }
}

/**
 * Error response format
 */
export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  timestamp: string
  requestId?: string
}

/**
 * Handle and format errors for API responses
 */
export function handleError(error: unknown, requestId?: string): NextResponse<ErrorResponse> {
  let appError: AppError

  if (error instanceof AppError) {
    appError = error
  } else if (error instanceof Error) {
    logger.error('Unhandled error', error)
    appError = new AppError(500, 'Internal server error', 'INTERNAL_ERROR')
  } else {
    logger.error('Unknown error type', undefined, { error })
    appError = new AppError(500, 'Internal server error', 'INTERNAL_ERROR')
  }

  const response: ErrorResponse = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details
    },
    timestamp: new Date().toISOString(),
    requestId
  }

  return NextResponse.json(response, { status: appError.statusCode })
}

/**
 * Create error response
 */
export function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): NextResponse<ErrorResponse> {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString(),
    requestId
  }

  return NextResponse.json(response, { status: statusCode })
}

/**
 * Validate required fields
 */
export function validateRequired(
  data: Record<string, unknown>,
  fields: string[]
): { valid: boolean; error?: ValidationError } {
  const missing = fields.filter((field) => !data[field])

  if (missing.length > 0) {
    return {
      valid: false,
      error: new ValidationError('Missing required fields', { missing })
    }
  }

  return { valid: true }
}

/**
 * Async error wrapper for API routes
 */
export function asyncHandler(
  handler: (request: Request) => Promise<NextResponse>
) {
  return async (request: Request) => {
    try {
      return await handler(request)
    } catch (error) {
      return handleError(error)
    }
  }
}

/**
 * Error boundary component helper
 */
export class ErrorBoundary {
  static async wrap<T>(
    fn: () => Promise<T>,
    context: string
  ): Promise<{ success: boolean; data?: T; error?: AppError }> {
    try {
      const data = await fn()
      return { success: true, data }
    } catch (error) {
      if (error instanceof AppError) {
        logger.error(`${context} failed`, new Error(error.message), {
          code: error.code,
          statusCode: error.statusCode
        })
        return { success: false, error }
      }

      const appError = new AppError(500, 'Internal server error', 'INTERNAL_ERROR')
      logger.error(`${context} failed with unexpected error`, error as Error)
      return { success: false, error: appError }
    }
  }
}
