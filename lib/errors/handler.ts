import { NextResponse } from 'next/server'
import { AppError, isAppError } from './types'
import { logger } from '@/lib/logging'

export interface ErrorResponseBody {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
    requestId?: string
  }
}

export function handleApiError(
  error: unknown,
  context?: { endpoint?: string; userId?: string; requestId?: string }
): NextResponse<ErrorResponseBody> {
  const requestId = context?.requestId || generateRequestId()

  if (isAppError(error)) {
    if (!error.isOperational) {
      logger.error('Non-operational error', {
        error: error.message,
        code: error.code,
        stack: error.stack,
        ...context,
        requestId,
      })
    } else {
      logger.warn('Operational error', {
        error: error.message,
        code: error.code,
        ...context,
        requestId,
      })
    }

    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      { status: error.statusCode }
    )
  }

  const unknownError = error as Error
  logger.error('Unhandled error', {
    error: unknownError.message || 'Unknown error',
    stack: unknownError.stack,
    ...context,
    requestId,
  })

  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId,
      },
    },
    { status: 500 }
  )
}

export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`
}

export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context?: { endpoint?: string; userId?: string }
): Promise<T | NextResponse<ErrorResponseBody>> {
  const requestId = generateRequestId()

  try {
    return await fn()
  } catch (error) {
    return handleApiError(error, { ...context, requestId })
  }
}

export function asyncHandler<T extends (...args: Parameters<T>) => Promise<NextResponse>>(
  handler: T,
  context?: { endpoint?: string }
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args)
    } catch (error) {
      return handleApiError(error, context)
    }
  }) as T
}
