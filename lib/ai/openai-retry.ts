/**
 * OpenAI Retry Logic with Exponential Backoff
 * Provides robust retry mechanism for OpenAI API calls
 */

import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import { createHash, randomBytes } from "crypto"

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitter: boolean
  retryableErrors: string[]
  retryableStatusCodes: number[]
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalDurationMs: number
  retryHistory: Array<{
    attempt: number
    delay: number
    error?: string
    duration: number
  }>
}

export interface CircuitBreakerState {
  isOpen: boolean
  failureCount: number
  lastFailureTime: number
  nextAttemptTime: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: [
    'rate_limit_exceeded',
    'insufficient_quota',
    'model_overloaded',
    'openai_error',
    'timeout',
    'connection_error',
    'temporary_failure'
  ],
  retryableStatusCodes: [429, 502, 503, 504]
}

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  monitoringWindowMs: 300000 // 5 minutes
}

class CircuitBreaker {
  private state: CircuitBreakerState = {
    isOpen: false,
    failureCount: 0,
    lastFailureTime: 0,
    nextAttemptTime: 0
  }

  private recentCalls: Array<{ timestamp: number; success: boolean }> = []

  constructor(private config = CIRCUIT_BREAKER_CONFIG) {}

  canExecute(): boolean {
    const now = Date.now()

    // Clean old calls outside monitoring window
    this.recentCalls = this.recentCalls.filter(
      call => now - call.timestamp < this.config.monitoringWindowMs
    )

    // Check if circuit should reset
    if (this.state.isOpen && now >= this.state.nextAttemptTime) {
      this.reset()
    }

    // Calculate failure rate in monitoring window
    const totalCalls = this.recentCalls.length
    const failureRate = totalCalls > 0
      ? this.recentCalls.filter(call => !call.success).length / totalCalls
      : 0

    // Open circuit if failure rate exceeds threshold
    if (!this.state.isOpen && failureRate > 0.5 && totalCalls >= 10) {
      this.open()
    }

    return !this.state.isOpen
  }

  onSuccess(): void {
    this.recentCalls.push({ timestamp: Date.now(), success: true })

    if (this.state.failureCount > 0) {
      this.state.failureCount = Math.max(0, this.state.failureCount - 1)
    }
  }

  onFailure(): void {
    const now = Date.now()
    this.recentCalls.push({ timestamp: now, success: false })

    this.state.failureCount++
    this.state.lastFailureTime = now

    if (this.state.failureCount >= this.config.failureThreshold) {
      this.open()
    }
  }

  private open(): void {
    this.state.isOpen = true
    this.state.nextAttemptTime = Date.now() + this.config.resetTimeoutMs
  }

  private reset(): void {
    this.state = {
      isOpen: false,
      failureCount: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0
    }
  }

  getState() {
    return { ...this.state }
  }
}

export class OpenAIRetryClient {
  private circuitBreaker: CircuitBreaker
  private config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config }
    this.circuitBreaker = new CircuitBreaker()
  }

  /**
   * Generate text with retry logic and circuit breaker
   */
  async generateTextWithRetry(params: {
    prompt: string
    system?: string
    temperature?: number
    maxOutputTokens?: number
    model?: string
  }): Promise<RetryResult<string>> {
    const startTime = Date.now()
    const retryHistory: RetryResult<string>['retryHistory'] = []

    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      return {
        success: false,
        error: new Error('Circuit breaker is open - OpenAI service temporarily unavailable'),
        attempts: 0,
        totalDurationMs: 0,
        retryHistory
      }
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      const attemptStartTime = Date.now()
      let delay = 0

      try {
        console.log(`[OpenAI] Attempt ${attempt + 1}/${this.config.maxRetries + 1}`)

        const { text } = await generateText({
          model: openai(params.model || "gpt-4-turbo"),
          system: params.system || "You are a professional legal assistant.",
          prompt: params.prompt,
          temperature: params.temperature || 0.7,
          maxOutputTokens: params.maxOutputTokens || 2048,
        })

        if (!text) {
          throw new Error("Empty response from OpenAI")
        }

        // Success - update circuit breaker and return
        this.circuitBreaker.onSuccess()

        const duration = Date.now() - attemptStartTime
        retryHistory.push({
          attempt: attempt + 1,
          delay,
          duration
        })

        return {
          success: true,
          data: text,
          attempts: attempt + 1,
          totalDurationMs: Date.now() - startTime,
          retryHistory
        }

      } catch (error: any) {
        lastError = error
        const duration = Date.now() - attemptStartTime

        retryHistory.push({
          attempt: attempt + 1,
          delay,
          error: error.message,
          duration
        })

        console.error(`[OpenAI] Attempt ${attempt + 1} failed:`, {
          error: error.message,
          status: error.status,
          code: error.code,
          duration
        })

        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === this.config.maxRetries) {
          this.circuitBreaker.onFailure()
          break
        }

        // Calculate delay for next attempt
        if (attempt < this.config.maxRetries) {
          delay = this.calculateDelay(attempt)
          console.log(`[OpenAI] Waiting ${delay}ms before retry...`)
          await this.sleep(delay)
        }
      }
    }

    // All retries failed
    this.circuitBreaker.onFailure()

    return {
      success: false,
      error: lastError || new Error('Unknown error'),
      attempts: this.config.maxRetries + 1,
      totalDurationMs: Date.now() - startTime,
      retryHistory
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Check for retryable error codes/messages
    if (error.code && this.config.retryableErrors.includes(error.code)) {
      return true
    }

    // Check for retryable HTTP status codes
    if (error.status && this.config.retryableStatusCodes.includes(error.status)) {
      return true
    }

    // Check error message patterns
    const message = error.message?.toLowerCase() || ''
    const retryablePatterns = [
      'rate limit',
      'timeout',
      'connection',
      'temporary',
      'overloaded',
      'service unavailable'
    ]

    return retryablePatterns.some(pattern => message.includes(pattern))
  }

  /**
   * Calculate exponential backoff delay with optional jitter
   */
  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt)

    // Cap the delay
    delay = Math.min(delay, this.config.maxDelayMs)

    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      const jitterRange = delay * 0.1 // 10% jitter
      delay += Math.random() * jitterRange - jitterRange / 2
    }

    return Math.floor(delay)
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get current circuit breaker state
   */
  getCircuitBreakerState() {
    return this.circuitBreaker.getState()
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker() {
    this.circuitBreaker = new CircuitBreaker()
  }
}

// Singleton instance
export const openAIRetryClient = new OpenAIRetryClient()

/**
 * Convenience function for generating text with retry
 */
export async function generateTextWithRetry(params: {
  prompt: string
  system?: string
  temperature?: number
  maxOutputTokens?: number
  model?: string
}): Promise<{ text: string; attempts: number; duration: number }> {
  const result = await openAIRetryClient.generateTextWithRetry(params)

  if (!result.success || !result.data) {
    throw result.error || new Error('Failed to generate text after retries')
  }

  return {
    text: result.data,
    attempts: result.attempts,
    duration: result.totalDurationMs
  }
}

/**
 * Generate cache key for OpenAI requests
 */
export function generateCacheKey(params: {
  prompt: string
  system?: string
  temperature?: number
  maxOutputTokens?: number
  model?: string
}): string {
  const keyData = {
    prompt: params.prompt,
    system: params.system,
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
    model: params.model
  }

  const keyString = JSON.stringify(keyData)
  return createHash('sha256').update(keyString).digest('hex')
}

/**
 * Check if OpenAI API is healthy
 */
export async function checkOpenAIHealth(): Promise<{
  healthy: boolean
  responseTime?: number
  error?: string
}> {
  try {
    const startTime = Date.now()

    // Simple health check - generate a short completion
    const result = await openAIRetryClient.generateTextWithRetry({
      prompt: "Respond with exactly: OK",
      system: "You are a health check service.",
      temperature: 0,
      maxOutputTokens: 10,
      model: "gpt-4-turbo"
    })

    const responseTime = Date.now() - startTime

    return {
      healthy: result.success && result.data === 'OK',
      responseTime,
      error: result.success ? undefined : result.error?.message
    }
  } catch (error: any) {
    return {
      healthy: false,
      error: error.message
    }
  }
}