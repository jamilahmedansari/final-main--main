import { logger } from '@/lib/logging'

export interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (error: unknown, attempt: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  shouldRetry: () => true,
  onRetry: () => {},
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const delay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1)
  const jitter = Math.random() * 0.1 * delay
  return Math.min(delay + jitter, options.maxDelayMs)
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options }

  let lastError: unknown
  let attempt = 0

  while (attempt < opts.maxAttempts) {
    attempt++

    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt >= opts.maxAttempts) {
        break
      }

      if (!opts.shouldRetry(error, attempt)) {
        break
      }

      const delay = calculateDelay(attempt, opts)
      logger.warn(`Retry attempt ${attempt}/${opts.maxAttempts}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        nextRetryIn: `${delay}ms`,
      })

      opts.onRetry(error, attempt)
      await sleep(delay)
    }
  }

  throw lastError
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    const retryablePatterns = [
      'timeout',
      'econnreset',
      'econnrefused',
      'socket hang up',
      'network',
      'temporarily unavailable',
      '503',
      '502',
      '504',
      'rate limit',
      'too many requests',
    ]

    return retryablePatterns.some(pattern => message.includes(pattern))
  }

  return false
}

export function createRetryable<T extends (...args: Parameters<T>) => Promise<ReturnType<T>>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: Parameters<T>) => {
    return retry(() => fn(...args), options)
  }) as T
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  options: RetryOptions & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 30000, ...retryOptions } = options

  return retry(
    () => withTimeout(fn, timeoutMs),
    retryOptions
  )
}
