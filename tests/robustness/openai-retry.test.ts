/**
 * OpenAI Retry Logic Tests
 * Tests comprehensive retry logic with exponential backoff and circuit breaker
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import {
  OpenAIRetryClient,
  generateTextWithRetry,
  checkOpenAIHealth,
  generateCacheKey
} from '@/lib/ai/openai-retry'

// Mock the AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn()
}))

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn()
}))

describe('OpenAI Retry Logic', () => {
  let retryClient: OpenAIRetryClient
  let mockGenerateText: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    retryClient = new OpenAIRetryClient()
    mockGenerateText = require('ai').generateText
  })

  describe('Basic Retry Logic', () => {
    it('should succeed on first attempt', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Generated content'
      })

      const result = await retryClient.generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system'
      })

      expect(result.success).toBe(true)
      expect(result.data).toBe('Generated content')
      expect(result.attempts).toBe(1)
      expect(mockGenerateText).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      mockGenerateText
        .mockRejectedValueOnce(new Error('rate_limit_exceeded'))
        .mockRejectedValueOnce(new Error('temporary_failure'))
        .mockResolvedValueOnce({ text: 'Generated content' })

      const result = await retryClient.generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system'
      })

      expect(result.success).toBe(true)
      expect(result.data).toBe('Generated content')
      expect(result.attempts).toBe(3)
      expect(mockGenerateText).toHaveBeenCalledTimes(3)
      expect(result.retryHistory).toHaveLength(3)
    })

    it('should not retry on non-retryable errors', async () => {
      const nonRetryableError = new Error('invalid_request')
      nonRetryableError.code = 'invalid_request'

      mockGenerateText.mockRejectedValueOnce(nonRetryableError)

      const result = await retryClient.generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe(nonRetryableError)
      expect(result.attempts).toBe(1)
      expect(mockGenerateText).toHaveBeenCalledTimes(1)
    })

    it('should fail after max retries', async () => {
      const retryableError = new Error('rate_limit_exceeded')
      retryableError.code = 'rate_limit_exceeded'

      mockGenerateText.mockRejectedValue(retryableError)

      const result = await retryClient.generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system'
      })

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(4) // 1 initial + 3 retries
      expect(mockGenerateText).toHaveBeenCalledTimes(4)
    })
  })

  describe('Exponential Backoff', () => {
    it('should use exponential backoff delays', async () => {
      const delays: number[] = []
      const originalSetTimeout = global.setTimeout

      global.setTimeout = jest.fn().mockImplementation((callback, delay) => {
        delays.push(delay)
        callback()
        return 1 as any
      })

      mockGenerateText
        .mockRejectedValueOnce(new Error('rate_limit_exceeded'))
        .mockRejectedValueOnce(new Error('rate_limit_exceeded'))
        .mockResolvedValueOnce({ text: 'Generated content' })

      await retryClient.generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system'
      })

      // Should have delays for retry attempts (not the first attempt)
      expect(delays).toHaveLength(2)

      // Exponential backoff: 1000ms, 2000ms (with potential jitter)
      expect(delays[0]).toBeGreaterThanOrEqual(900) // Allow for jitter
      expect(delays[0]).toBeLessThanOrEqual(1100)
      expect(delays[1]).toBeGreaterThanOrEqual(1800) // Allow for jitter
      expect(delays[1]).toBeLessThanOrEqual(2200)

      global.setTimeout = originalSetTimeout
    })

    it('should respect maximum delay limit', async () => {
      const customClient = new OpenAIRetryClient({
        baseDelayMs: 10000,
        maxDelayMs: 15000,
        backoffMultiplier: 3
      })

      const delays: number[] = []
      const originalSetTimeout = global.setTimeout

      global.setTimeout = jest.fn().mockImplementation((callback, delay) => {
        delays.push(delay)
        callback()
        return 1 as any
      })

      mockGenerateText
        .mockRejectedValueOnce(new Error('rate_limit_exceeded'))
        .mockRejectedValueOnce(new Error('rate_limit_exceeded'))
        .mockResolvedValueOnce({ text: 'Generated content' })

      await customClient.generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system'
      })

      expect(delays[0]).toBe(10000) // Base delay
      expect(delays[1]).toBeLessThanOrEqual(15000) // Capped at max delay

      global.setTimeout = originalSetTimeout
    })
  })

  describe('Circuit Breaker', () => {
    it('should open circuit after failure threshold', async () => {
      // Configure circuit breaker to open quickly
      const testClient = new OpenAIRetryClient()

      // Force circuit breaker open by causing multiple failures
      mockGenerateText.mockRejectedValue(new Error('persistent_failure'))

      // Make enough requests to trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        await testClient.generateTextWithRetry({
          prompt: `Test prompt ${i}`,
          system: 'Test system'
        })
      }

      // Circuit should now be open
      const result = await testClient.generateTextWithRetry({
        prompt: 'Should fail due to open circuit',
        system: 'Test system'
      })

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Circuit breaker is open')
      expect(result.attempts).toBe(0)
    })

    it('should close circuit after reset timeout', async () => {
      const testClient = new OpenAIRetryClient()

      // Force circuit open
      mockGenerateText.mockRejectedValue(new Error('persistent_failure'))

      for (let i = 0; i < 10; i++) {
        await testClient.generateTextWithRetry({
          prompt: `Test prompt ${i}`,
          system: 'Test system'
        })
      }

      // Circuit should be open
      const openResult = await testClient.generateTextWithRetry({
        prompt: 'Should fail',
        system: 'Test system'
      })
      expect(openResult.success).toBe(false)

      // Mock time passing
      const originalDateNow = Date.now
      Date.now = jest.fn(() => originalDateNow() + 65000) // 65 seconds later

      // Reset the mock to succeed now
      mockGenerateText.mockResolvedValue({ text: 'Success after reset' })

      // Circuit should be closed
      const closedResult = await testClient.generateTextWithRetry({
        prompt: 'Should succeed',
        system: 'Test system'
      })
      expect(closedResult.success).toBe(true)

      Date.now = originalDateNow
    })

    it('should provide circuit breaker state', () => {
      const state = retryClient.getCircuitBreakerState()

      expect(state).toHaveProperty('isOpen')
      expect(state).toHaveProperty('failureCount')
      expect(state).toHaveProperty('lastFailureTime')
      expect(state).toHaveProperty('nextAttemptTime')
    })

    it('should allow manual circuit breaker reset', async () => {
      // Force circuit open
      mockGenerateText.mockRejectedValue(new Error('persistent_failure'))

      for (let i = 0; i < 10; i++) {
        await retryClient.generateTextWithRetry({
          prompt: `Test prompt ${i}`,
          system: 'Test system'
        })
      }

      // Circuit should be open
      const stateBefore = retryClient.getCircuitBreakerState()
      expect(stateBefore.isOpen).toBe(true)

      // Reset circuit breaker
      retryClient.resetCircuitBreaker()

      // Circuit should be closed
      const stateAfter = retryClient.getCircuitBreakerState()
      expect(stateAfter.isOpen).toBe(false)
      expect(stateAfter.failureCount).toBe(0)
    })
  })

  describe('Error Classification', () => {
    it('should classify retryable HTTP status codes', async () => {
      const retryableStatusCodes = [429, 502, 503, 504]

      for (const statusCode of retryableStatusCodes) {
        jest.clearAllMocks()

        const error = new Error('HTTP Error')
        error.status = statusCode

        mockGenerateText
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce({ text: 'Success' })

        const result = await retryClient.generateTextWithRetry({
          prompt: 'Test prompt',
          system: 'Test system'
        })

        expect(result.success).toBe(true)
        expect(result.attempts).toBe(2)
      }
    })

    it('should classify retryable error codes', async () => {
      const retryableCodes = [
        'rate_limit_exceeded',
        'model_overloaded',
        'temporary_failure'
      ]

      for (const errorCode of retryableCodes) {
        jest.clearAllMocks()

        const error = new Error('API Error')
        error.code = errorCode

        mockGenerateText
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce({ text: 'Success' })

        const result = await retryClient.generateTextWithRetry({
          prompt: 'Test prompt',
          system: 'Test system'
        })

        expect(result.success).toBe(true)
        expect(result.attempts).toBe(2)
      }
    })

    it('should classify retryable error messages', async () => {
      const retryableMessages = [
        'rate limit exceeded',
        'connection timeout',
        'temporary service unavailable',
        'server overloaded'
      ]

      for (const message of retryableMessages) {
        jest.clearAllMocks()

        const error = new Error(message)

        mockGenerateText
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce({ text: 'Success' })

        const result = await retryClient.generateTextWithRetry({
          prompt: 'Test prompt',
          system: 'Test system'
        })

        expect(result.success).toBe(true)
        expect(result.attempts).toBe(2)
      }
    })

    it('should not retry non-retryable errors', async () => {
      const nonRetryableErrors = [
        { code: 'invalid_request', status: 400 },
        { code: 'authentication_error', status: 401 },
        { code: 'permission_denied', status: 403 },
        { code: 'not_found', status: 404 }
      ]

      for (const errorConfig of nonRetryableErrors) {
        jest.clearAllMocks()

        const error = new Error('Non-retryable error')
        error.code = errorConfig.code
        error.status = errorConfig.status

        mockGenerateText.mockRejectedValueOnce(error)

        const result = await retryClient.generateTextWithRetry({
          prompt: 'Test prompt',
          system: 'Test system'
        })

        expect(result.success).toBe(false)
        expect(result.attempts).toBe(1)
      }
    })
  })

  describe('Convenience Functions', () => {
    it('should provide simplified generateTextWithRetry function', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Generated content'
      })

      const result = await generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system',
        temperature: 0.5,
        maxOutputTokens: 1000
      })

      expect(result.text).toBe('Generated content')
      expect(result.attempts).toBe(1)
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should throw error on failure in convenience function', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('Persistent failure'))

      await expect(
        generateTextWithRetry({
          prompt: 'Test prompt',
          system: 'Test system'
        })
      ).rejects.toThrow('Failed to generate text after retries')
    })
  })

  describe('Health Check', () => {
    it('should check OpenAI service health', async () => {
      // Mock healthy response
      mockGenerateText.mockResolvedValueOnce({ text: 'OK' })

      const healthResult = await checkOpenAIHealth()

      expect(healthResult.healthy).toBe(true)
      expect(healthResult.responseTime).toBeGreaterThan(0)
      expect(healthResult.error).toBeUndefined()
    })

    it('should detect unhealthy OpenAI service', async () => {
      // Mock unhealthy response
      mockGenerateText.mockRejectedValueOnce(new Error('Service unavailable'))

      const healthResult = await checkOpenAIHealth()

      expect(healthResult.healthy).toBe(false)
      expect(healthResult.error).toBeDefined()
    })

    it('should detect incorrect response from OpenAI', async () => {
      // Mock incorrect response
      mockGenerateText.mockResolvedValueOnce({ text: 'WRONG_RESPONSE' })

      const healthResult = await checkOpenAIHealth()

      expect(healthResult.healthy).toBe(false)
    })
  })

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys', () => {
      const params = {
        prompt: 'Test prompt',
        system: 'Test system',
        temperature: 0.7,
        maxOutputTokens: 2048,
        model: 'gpt-4-turbo'
      }

      const key1 = generateCacheKey(params)
      const key2 = generateCacheKey(params)

      expect(key1).toBe(key2)
      expect(key1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex
    })

    it('should generate different keys for different parameters', () => {
      const params1 = {
        prompt: 'Test prompt',
        system: 'Test system',
        temperature: 0.7
      }

      const params2 = {
        prompt: 'Test prompt',
        system: 'Test system',
        temperature: 0.8
      }

      const key1 = generateCacheKey(params1)
      const key2 = generateCacheKey(params2)

      expect(key1).not.toBe(key2)
    })

    it('should handle undefined parameters', () => {
      const params1 = {
        prompt: 'Test prompt',
        system: undefined,
        temperature: 0.7
      }

      const params2 = {
        prompt: 'Test prompt',
        system: 'Test system',
        temperature: 0.7
      }

      const key1 = generateCacheKey(params1)
      const key2 = generateCacheKey(params2)

      expect(key1).not.toBe(key2)
    })
  })

  describe('Retry History', () => {
    it('should track retry history accurately', async () => {
      mockGenerateText
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValueOnce({ text: 'Success' })

      const result = await retryClient.generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system'
      })

      expect(result.retryHistory).toHaveLength(3)

      expect(result.retryHistory[0]).toEqual({
        attempt: 1,
        delay: 0,
        error: 'First failure',
        duration: expect.any(Number)
      })

      expect(result.retryHistory[1]).toEqual({
        attempt: 2,
        delay: expect.any(Number),
        error: 'Second failure',
        duration: expect.any(Number)
      })

      expect(result.retryHistory[2]).toEqual({
        attempt: 3,
        delay: expect.any(Number),
        duration: expect.any(Number)
      })
    })

    it('should include total duration in result', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: 'Success'
      })

      const result = await retryClient.generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system'
      })

      expect(result.totalDurationMs).toBeGreaterThan(0)
      expect(result.totalDurationMs).toBeLessThan(5000) // Should complete quickly
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty text responses', async () => {
      mockGenerateText.mockResolvedValueOnce({ text: '' })

      const result = await retryClient.generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system'
      })

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Empty response')
    })

    it('should handle null text responses', async () => {
      mockGenerateText.mockResolvedValueOnce({ text: null as any })

      const result = await retryClient.generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system'
      })

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Empty response')
    })

    it('should handle custom retry configurations', async () => {
      const customClient = new OpenAIRetryClient({
        maxRetries: 1,
        baseDelayMs: 500,
        maxDelayMs: 2000,
        backoffMultiplier: 1.5,
        jitter: false
      })

      mockGenerateText
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({ text: 'Success' })

      const result = await customClient.generateTextWithRetry({
        prompt: 'Test prompt',
        system: 'Test system'
      })

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(2)
      expect(result.retryHistory[1].delay).toBe(500) // No jitter, exact base delay
    })
  })
})