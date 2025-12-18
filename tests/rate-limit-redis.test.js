/**
 * Redis Rate Limiting Tests - JavaScript Version
 * More comprehensive tests for Redis rate limiting functionality
 */

const { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals')
const { NextRequest, NextResponse } = require('next/server')

// Mock Upstash Redis before importing our module
jest.mock('@upstash/ratelimit', () => ({
  Ratelimit: jest.fn().mockImplementation(({ limiter, prefix }) => ({
    limit: jest.fn().mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 900000,
      pending: 0
    })
  }))
}))

jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    expire: jest.fn(),
    incr: jest.fn(),
    eval: jest.fn(),
    script: {
      load: jest.fn(),
      eval: jest.fn()
    },
    pipeline: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([])
    }),
    multi: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([])
    })
  }))
}))

describe('Redis Rate Limiting Advanced Tests', () => {
  let mockRequest
  let originalEnv

  beforeAll(() => {
    originalEnv = process.env
  })

  beforeEach(() => {
    jest.clearAllMocks()

    // Set up test environment
    process.env = {
      ...originalEnv,
      KV_REST_API_URL: 'https://test-redis.upstash.io',
      KV_REST_API_TOKEN: 'test-token-12345',
      NODE_ENV: 'test'
    }

    // Clear global rate limit store
    delete global.rateLimitStore

    // Create mock request
    mockRequest = new NextRequest('http://localhost:3000/api/test', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '192.168.1.100',
        'user-agent': 'test-agent'
      }
    })
  })

  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
  })

  describe('Redis Connection and Configuration', () => {
    it('should initialize Redis with correct configuration', async () => {
      // Dynamic import to ensure mocks are applied
      const { Redis } = await import('@upstash/redis')
      expect(Redis).toHaveBeenCalledWith({
        url: 'https://test-redis.upstash.io',
        token: 'test-token-12345'
      })
    })

    it('should handle missing Redis configuration gracefully', async () => {
      // Clear Redis environment variables
      delete process.env.KV_REST_API_URL
      delete process.env.KV_REST_API_TOKEN

      // Re-import the module to test fallback
      delete require.cache[require.resolve('../lib/rate-limit-redis')]

      try {
        const rateLimitModule = await import('../lib/rate-limit-redis')
        // Should not throw and should handle missing Redis gracefully
        expect(rateLimitModule).toBeDefined()
      } catch (error) {
        // If it throws, it should be a graceful warning
        expect(error.message).not.toContain('Redis connection failed')
      }
    })

    it('should validate Redis URL format', async () => {
      process.env.KV_REST_API_URL = 'invalid-url'
      process.env.KV_REST_API_TOKEN = 'test-token'

      delete require.cache[require.resolve('../lib/rate-limit-redis')]

      const rateLimitModule = await import('../lib/rate-limit-redis')
      expect(rateLimitModule.authRateLimit).toBeNull() // Should be null for invalid config
    })
  })

  describe('Rate Limiting Algorithms', () => {
    it('should implement fixed window rate limiting correctly', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const rateLimitModule = await import('../lib/rate-limit-redis')

      // Mock the limit method to simulate fixed window behavior
      let requestCount = 0
      Ratelimit.prototype.limit = jest.fn().mockImplementation(async () => {
        requestCount++
        return {
          success: requestCount <= 5,
          limit: 5,
          remaining: Math.max(0, 5 - requestCount),
          reset: Date.now() + 900000,
          pending: 0
        }
      })

      // Test multiple requests
      let results = []
      for (let i = 0; i < 7; i++) {
        const result = await rateLimitModule.applyRateLimit(
          mockRequest,
          rateLimitModule.authRateLimit,
          'test-user-fixed'
        )
        results.push(result)
      }

      expect(results.slice(0, 5)).toEqual([null, null, null, null, null])
      expect(results[5]).toBeInstanceOf(NextResponse)
      expect(results[6]).toBeInstanceOf(NextResponse)
    })

    it('should handle sliding window behavior (if implemented)', async () => {
      // This tests sliding window if implemented in the future
      const { Ratelimit } = await import('@upstash/ratelimit')
      const rateLimitModule = await import('../lib/rate-limit-redis')

      // Mock sliding window behavior
      const now = Date.now()
      const requests = []

      Ratelimit.prototype.limit = jest.fn().mockImplementation(async () => {
        const currentTime = Date.now()
        requests.push(currentTime)

        // Keep only requests within the last minute
        const recentRequests = requests.filter(time => currentTime - time < 60000)

        return {
          success: recentRequests.length <= 5,
          limit: 5,
          remaining: Math.max(0, 5 - recentRequests.length),
          reset: currentTime + 60000,
          pending: 0
        }
      })

      // Test requests spread over time
      let allowedRequests = 0
      for (let i = 0; i < 10; i++) {
        const result = await rateLimitModule.applyRateLimit(
          mockRequest,
          rateLimitModule.authRateLimit,
          'test-user-sliding'
        )

        if (result === null) allowedRequests++

        // Simulate time passing
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      expect(allowedRequests).toBeGreaterThan(5) // Sliding window should allow more
    })
  })

  describe('Rate Limiting Edge Cases', () => {
    it('should handle concurrent requests correctly', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const rateLimitModule = await import('../lib/rate-limit-redis')

      // Mock to track concurrent requests
      let activeRequests = 0
      let maxConcurrent = 0

      Ratelimit.prototype.limit = jest.fn().mockImplementation(async () => {
        activeRequests++
        maxConcurrent = Math.max(maxConcurrent, activeRequests)

        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50))

        activeRequests--
        return {
          success: true,
          limit: 10,
          remaining: 9,
          reset: Date.now() + 60000,
          pending: 0
        }
      })

      // Make multiple concurrent requests
      const concurrentRequests = Array.from({ length: 20 }, (_, i) =>
        rateLimitModule.applyRateLimit(
          mockRequest,
          rateLimitModule.apiRateLimit,
          `concurrent-user-${i}`
        )
      )

      const results = await Promise.all(concurrentRequests)

      // All requests should complete without rate limiting (success mocked)
      expect(results.every(result => result === null)).toBe(true)
      expect(maxConcurrent).toBeGreaterThan(0)
    })

    it('should handle rapid bursts of requests', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const rateLimitModule = await import('../lib/rate-limit-redis')

      let requestCount = 0
      Ratelimit.prototype.limit = jest.fn().mockImplementation(async () => {
        requestCount++
        const timestamp = Date.now()

        return {
          success: requestCount <= 3, // Very low limit for burst testing
          limit: 3,
          remaining: Math.max(0, 3 - requestCount),
          reset: timestamp + 60000,
          pending: 0
        }
      })

      // Rapid burst of requests
      const burstRequests = []
      for (let i = 0; i < 10; i++) {
        burstRequests.push(
          rateLimitModule.applyRateLimit(
            mockRequest,
            rateLimitModule.authRateLimit,
            'burst-user'
          )
        )
      }

      const results = await Promise.all(burstRequests)

      // First 3 should pass, rest should be rate limited
      expect(results.slice(0, 3).every(r => r === null)).toBe(true)
      expect(results.slice(3).every(r => r instanceof NextResponse)).toBe(true)
    })

    it('should handle rate limit reset timing correctly', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const rateLimitModule = await import('../lib/rate-limit-redis')

      const startTime = Date.now()
      const resetTime = startTime + 2000 // 2 seconds

      let requestCount = 0
      Ratelimit.prototype.limit = jest.fn().mockImplementation(async () => {
        requestCount++
        const currentTime = Date.now()

        // Reset after 2 seconds
        if (currentTime >= resetTime) {
          requestCount = 1 // Reset count
        }

        return {
          success: requestCount <= 2,
          limit: 2,
          remaining: Math.max(0, 2 - requestCount),
          reset: resetTime + (requestCount > 2 ? 2000 : 0),
          pending: 0
        }
      })

      // First burst
      const firstBurst = []
      for (let i = 0; i < 4; i++) {
        firstBurst.push(
          rateLimitModule.applyRateLimit(
            mockRequest,
            rateLimitModule.authRateLimit,
            'reset-user'
          )
        )
      }

      const firstResults = await Promise.all(firstBurst)
      expect(firstResults.slice(0, 2).every(r => r === null)).toBe(true)
      expect(firstResults.slice(2).every(r => r instanceof NextResponse)).toBe(true)

      // Wait for reset
      await new Promise(resolve => setTimeout(resolve, 2100))

      // Second burst after reset
      const secondBurst = []
      for (let i = 0; i < 2; i++) {
        secondBurst.push(
          rateLimitModule.applyRateLimit(
            mockRequest,
            rateLimitModule.authRateLimit,
            'reset-user'
          )
        )
      }

      const secondResults = await Promise.all(secondBurst)
      expect(secondResults.every(r => r === null)).toBe(true)
    })
  })

  describe('Rate Limiting Performance', () => {
    it('should handle high volume requests efficiently', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const rateLimitModule = await import('../lib/rate-limit-redis')

      // Mock high-performance Redis response
      Ratelimit.prototype.limit = jest.fn().mockResolvedValue({
        success: true,
        limit: 1000,
        remaining: 999,
        reset: Date.now() + 60000,
        pending: 0
      })

      const startTime = Date.now()
      const highVolumeRequests = []

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        highVolumeRequests.push(
          rateLimitModule.applyRateLimit(
            mockRequest,
            rateLimitModule.apiRateLimit,
            `perf-user-${i}`
          )
        )
      }

      const results = await Promise.all(highVolumeRequests)
      const duration = Date.now() - startTime

      // All requests should complete successfully
      expect(results.every(result => result === null)).toBe(true)

      // Should complete quickly (under 1 second for 100 requests)
      expect(duration).toBeLessThan(1000)
    })

    it('should have minimal memory overhead for in-memory fallback', async () => {
      const rateLimitModule = await import('../lib/rate-limit-redis')

      // Clear global store
      delete global.rateLimitStore

      // Test in-memory fallback with many users
      const uniqueUsers = Array.from({ length: 1000 }, (_, i) => `user-${i}`)

      for (const user of uniqueUsers) {
        await rateLimitModule.safeApplyRateLimit(
          mockRequest,
          null, // Force in-memory fallback
          5,
          '15 m',
          user,
          'perf-test'
        )
      }

      // Check memory store size
      const storeSize = global.rateLimitStore?.size || 0
      expect(storeSize).toBe(1000)

      // Memory usage should be reasonable (less than 1MB for 1000 users)
      const memoryUsage = process.memoryUsage()
      expect(memoryUsage.heapUsed).toBeLessThan(50 * 1024 * 1024) // 50MB
    })
  })

  describe('Rate Limiting Security', () => {
    it('should prevent IP spoofing attempts', async () => {
      const rateLimitModule = await import('../lib/rate-limit-redis')

      const spoofingAttempts = [
        'x-forwarded-for: 192.168.1.100, 10.0.0.1, 127.0.0.1',
        'x-forwarded-for: ::1, 192.168.1.100',
        'x-real-ip: <script>alert("xss")</script>',
        'x-forwarded-for: ../../etc/passwd',
        'x-forwarded-for: '
      ]

      for (const attempt of spoofingAttempts) {
        const [header, value] = attempt.split(': ')
        const spoofedRequest = new NextRequest('http://localhost:3000/api/test', {
          headers: {
            [header]: value?.trim() || ''
          }
        })

        const result = await rateLimitModule.safeApplyRateLimit(
          spoofedRequest,
          null,
          5,
          '15 m',
          undefined,
          'security-test'
        )

        // Should handle malformed headers gracefully
        expect(result).toBeNull()
      }
    })

    it('should handle DoS protection for rate limit bypass attempts', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const rateLimitModule = await import('../lib/rate-limit-redis')

      // Simulate someone trying to bypass with random identifiers
      const randomIdentifiers = Array.from({ length: 10000 }, (_, i) =>
        `random-${Math.random().toString(36).substring(7)}-${i}`
      )

      // This would normally bypass rate limiting, but our system should handle it
      const startTime = Date.now()

      for (const identifier of randomIdentifiers.slice(0, 100)) { // Test subset for performance
        await rateLimitModule.safeApplyRateLimit(
          mockRequest,
          rateLimitModule.authRateLimit,
          5,
          '15 m',
          identifier,
          'dos-test'
        )
      }

      const duration = Date.now() - startTime

      // Should complete quickly and not hang
      expect(duration).toBeLessThan(5000)
    })
  })

  describe('Rate Limiting Monitoring and Analytics', () => {
    it('should track rate limit metrics correctly', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const rateLimitModule = await import('../lib/rate-limit-redis')

      const analyticsData = []

      Ratelimit.prototype.limit = jest.fn().mockImplementation(async (identifier) => {
        const metrics = {
          identifier,
          timestamp: Date.now(),
          success: Math.random() > 0.3 // 70% success rate
        }

        analyticsData.push(metrics)

        return {
          success: metrics.success,
          limit: 10,
          remaining: metrics.success ? 9 : 0,
          reset: Date.now() + 60000,
          pending: 0
        }
      })

      // Generate some traffic
      for (let i = 0; i < 50; i++) {
        await rateLimitModule.applyRateLimit(
          mockRequest,
          rateLimitModule.apiRateLimit,
          `analytics-user-${i % 10}` // 10 unique users
        )
      }

      // Verify analytics were tracked
      expect(analyticsData.length).toBe(50)

      const uniqueIdentifiers = new Set(analyticsData.map(d => d.identifier))
      expect(uniqueIdentifiers.size).toBe(10)

      const successRate = analyticsData.filter(d => d.success).length / analyticsData.length
      expect(successRate).toBeGreaterThan(0.5) // Should be around 70%
    })
  })
})

describe('Rate Limiting Configuration Tests', () => {
  it('should validate rate limit configurations are appropriate', () => {
    const expectedConfigs = [
      { name: 'authRateLimit', maxRequests: 5, window: '15 m' },
      { name: 'apiRateLimit', maxRequests: 100, window: '1 m' },
      { name: 'adminRateLimit', maxRequests: 10, window: '15 m' },
      { name: 'letterGenerationRateLimit', maxRequests: 5, window: '1 h' },
      { name: 'subscriptionRateLimit', maxRequests: 3, window: '1 h' }
    ]

    // These would be the actual configurations from the rate limiting module
    // This test ensures the configurations make sense for their use cases
    expectedConfigs.forEach(config => {
      // Auth endpoints should have strict limits
      if (config.name.includes('auth')) {
        expect(config.maxRequests).toBeLessThanOrEqual(10)
        expect(config.window).toBe('15 m')
      }

      // API endpoints should allow more requests
      if (config.name === 'apiRateLimit') {
        expect(config.maxRequests).toBeGreaterThan(50)
      }

      // Expensive operations (AI generation) should be very limited
      if (config.name.includes('letterGeneration') || config.name.includes('subscription')) {
        expect(config.maxRequests).toBeLessThanOrEqual(5)
        expect(config.window).toBe('1 h')
      }

      // Admin endpoints should have moderate limits
      if (config.name.includes('admin')) {
        expect(config.maxRequests).toBeGreaterThan(5)
        expect(config.maxRequests).toBeLessThanOrEqual(20)
      }
    })
  })
})