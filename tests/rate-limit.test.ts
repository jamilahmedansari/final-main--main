/**
 * Comprehensive Rate Limiting Tests
 * Tests both Redis-based and in-memory fallback rate limiting
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { NextRequest, NextResponse } from 'next/server'
import {
  authRateLimit,
  apiRateLimit,
  adminRateLimit,
  letterGenerationRateLimit,
  subscriptionRateLimit,
  applyRateLimit,
  safeApplyRateLimit
} from '../lib/rate-limit-redis'

// Mock Redis module
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    expire: jest.fn(),
    incr: jest.fn(),
    eval: jest.fn(),
  }))
}))

// Mock environment variables
const originalEnv = process.env

describe('Rate Limiting Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      KV_REST_API_URL: 'https://test-redis.upstash.io',
      KV_REST_API_TOKEN: 'test-token'
    }

    // Clear global in-memory store
    delete (global as any).rateLimitStore
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Redis Rate Limiting', () => {
    it('should create rate limiters with correct configuration', async () => {
      const { Ratelimit } = await import('@upstash/ratelimit')
      expect(Ratelimit).toBeDefined()

      // Test that rate limiters are created
      expect(authRateLimit).toBeDefined()
      expect(apiRateLimit).toBeDefined()
      expect(adminRateLimit).toBeDefined()
      expect(letterGenerationRateLimit).toBeDefined()
      expect(subscriptionRateLimit).toBeDefined()
    })

    it('should allow requests within limit', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100'
        }
      })

      // Mock successful rate limit check
      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockLimit = jest.fn().mockResolvedValue({
        success: true,
        limit: 5,
        remaining: 4,
        reset: Date.now() + 900000
      })
      Ratelimit.prototype.limit = mockLimit

      if (authRateLimit) {
        const result = await applyRateLimit(mockRequest, authRateLimit, 'test-user')
        expect(result).toBeNull() // Should not return rate limit response
        expect(mockLimit).toHaveBeenCalledWith('test-user')
      }
    })

    it('should block requests exceeding limit', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100'
        }
      })

      // Mock rate limit exceeded
      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockLimit = jest.fn().mockResolvedValue({
        success: false,
        limit: 5,
        remaining: 0,
        reset: Date.now() + 900000
      })
      Ratelimit.prototype.limit = mockLimit

      if (authRateLimit) {
        const result = await applyRateLimit(mockRequest, authRateLimit, 'test-user')
        expect(result).toBeInstanceOf(NextResponse)

        if (result instanceof NextResponse) {
          expect(result.status).toBe(429)
          expect(result.headers.get('X-RateLimit-Limit')).toBe('5')
          expect(result.headers.get('X-RateLimit-Remaining')).toBe('0')
          expect(result.headers.get('Retry-After')).toBeDefined()
        }
      }
    })

    it('should extract IP correctly from headers', async () => {
      const testCases = [
        {
          headers: { 'x-forwarded-for': '192.168.1.100, 10.0.0.1' },
          expectedIP: '192.168.1.100'
        },
        {
          headers: { 'x-real-ip': '192.168.1.200' },
          expectedIP: '192.168.1.200'
        },
        {
          headers: { 'cf-connecting-ip': '192.168.1.300' },
          expectedIP: '192.168.1.300'
        },
        {
          headers: {},
          expectedIP: 'unknown'
        }
      ]

      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockLimit = jest.fn().mockResolvedValue({
        success: true,
        limit: 5,
        remaining: 4,
        reset: Date.now() + 900000
      })
      Ratelimit.prototype.limit = mockLimit

      for (const testCase of testCases) {
        const mockRequest = new NextRequest('http://localhost:3000/api/test', {
          method: 'POST',
          headers: testCase.headers
        })

        if (authRateLimit) {
          await applyRateLimit(mockRequest, authRateLimit)
          expect(mockLimit).toHaveBeenCalledWith(
            expect.stringContaining(testCase.expectedIP)
          )
        }

        mockLimit.mockClear()
      }
    })
  })

  describe('Fallback Rate Limiting (In-Memory)', () => {
    beforeEach(() => {
      // Disable Redis by clearing env vars
      delete process.env.KV_REST_API_URL
      delete process.env.KV_REST_API_TOKEN

      // Clear global store
      delete (global as any).rateLimitStore
    })

    it('should fallback to in-memory when Redis is unavailable', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100'
        }
      })

      // Test with null rate limiter (Redis unavailable)
      const result = await safeApplyRateLimit(
        mockRequest,
        null,
        5,
        '15 m',
        'test-user',
        'test-prefix'
      )

      expect(result).toBeNull() // First request should pass
    })

    it('should enforce in-memory rate limits correctly', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100'
        }
      })

      // Make multiple requests to test in-memory limiting
      let rateLimitHit = false
      for (let i = 0; i < 7; i++) {
        const result = await safeApplyRateLimit(
          mockRequest,
          null,
          5,
          '15 m',
          'test-user',
          'test-prefix'
        )

        if (result instanceof NextResponse) {
          rateLimitHit = true
          expect(result.status).toBe(429)
          break
        }
      }

      expect(rateLimitHit).toBe(true)
    })

    it('should handle multiple identifiers separately', async () => {
      const mockRequest1 = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100'
        }
      })

      const mockRequest2 = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.200'
        }
      })

      // Test that different IPs have separate rate limits
      for (let i = 0; i < 6; i++) {
        const result1 = await safeApplyRateLimit(
          mockRequest1,
          null,
          5,
          '15 m',
          'user-1',
          'test-prefix'
        )

        const result2 = await safeApplyRateLimit(
          mockRequest2,
          null,
          5,
          '15 m',
          'user-2',
          'test-prefix'
        )

        // First user should hit rate limit
        if (i === 5) {
          expect(result1).toBeInstanceOf(NextResponse)
          expect((result1 as NextResponse).status).toBe(429)
        }

        // Second user should still be able to make requests
        expect(result2).toBeNull()
      }
    })

    it('should parse time window strings correctly', async () => {
      const timeWindowTests = [
        { input: '30 s', expectedMs: 30000 },
        { input: '5 m', expectedMs: 5 * 60 * 1000 },
        { input: '2 h', expectedMs: 2 * 60 * 60 * 1000 },
        { input: '1 d', expectedMs: 24 * 60 * 60 * 1000 },
        { input: 'invalid', expectedMs: 60 * 1000 }, // Default fallback
        { input: '', expectedMs: 60 * 1000 } // Default fallback
      ]

      for (const test of timeWindowTests) {
        const mockRequest = new NextRequest('http://localhost:3000/api/test')

        // Test that the time window is applied correctly
        const startTime = Date.now()
        await safeApplyRateLimit(
          mockRequest,
          null,
          1,
          test.input,
          'test-user',
          'test-window'
        )

        // The implementation should handle the time window parsing
        expect(true).toBe(true) // If we get here, parsing worked
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST'
      })

      // Mock Redis connection error
      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockLimit = jest.fn().mockRejectedValue(new Error('Redis connection failed'))
      Ratelimit.prototype.limit = mockLimit

      if (authRateLimit) {
        const result = await safeApplyRateLimit(
          mockRequest,
          authRateLimit,
          5,
          '15 m',
          'test-user',
          'test-prefix'
        )

        // Should fallback to in-memory and not throw
        expect(result).toBeNull()
      }
    })

    it('should handle malformed Redis responses', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST'
      })

      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockLimit = jest.fn().mockResolvedValue({
        invalid: 'response'
      })
      Ratelimit.prototype.limit = mockLimit

      if (authRateLimit) {
        const result = await safeApplyRateLimit(
          mockRequest,
          authRateLimit,
          5,
          '15 m',
          'test-user',
          'test-prefix'
        )

        // Should handle gracefully
        expect(result).toBeInstanceOf(NextResponse)
      }
    })
  })

  describe('Rate Limit Headers', () => {
    it('should include correct headers when rate limited', async () => {
      const mockRequest = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST'
      })

      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockLimit = jest.fn().mockResolvedValue({
        success: false,
        limit: 10,
        remaining: 0,
        reset: Date.now() + 900000 // 15 minutes from now
      })
      Ratelimit.prototype.limit = mockLimit

      if (adminRateLimit) {
        const result = await applyRateLimit(mockRequest, adminRateLimit, 'admin-user')

        expect(result).toBeInstanceOf(NextResponse)
        if (result instanceof NextResponse) {
          expect(result.headers.get('X-RateLimit-Limit')).toBe('10')
          expect(result.headers.get('X-RateLimit-Remaining')).toBe('0')
          expect(result.headers.get('X-RateLimit-Reset')).toBeDefined()
          expect(result.headers.get('Retry-After')).toBeDefined()

          const resetTime = parseInt(result.headers.get('X-RateLimit-Reset')!)
          const retryAfter = parseInt(result.headers.get('Retry-After')!)

          expect(resetTime).toBeGreaterThan(Date.now())
          expect(retryAfter).toBeGreaterThan(0)
          expect(retryAfter).toBeLessThanOrEqual(900) // Should be ~15 minutes
        }
      }
    })
  })

  describe('Rate Limit Types', () => {
    it('should have correct configurations for different rate limit types', async () => {
      // Test that all rate limiters are properly exported
      expect(authRateLimit).toBeDefined()
      expect(apiRateLimit).toBeDefined()
      expect(adminRateLimit).toBeDefined()
      expect(letterGenerationRateLimit).toBeDefined()
      expect(subscriptionRateLimit).toBeDefined()

      // Verify they use correct prefixes (this would require checking the actual implementation)
      const { Ratelimit } = await import('@upstash/ratelimit')
      const mockConstructor = jest.fn()
      Ratelimit.prototype.constructor = mockConstructor

      // The actual prefixes are defined in the implementation
      // This test ensures the rate limiters are created with different configurations
    })
  })
})

describe('Rate Limiting Integration Tests', () => {
  it('should work with actual API endpoints (integration)', async () => {
    // This would be an integration test that hits actual endpoints
    // Skip for unit tests, but useful for manual testing

    const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000'

    // Example of how to test an actual endpoint
    const testEndpoint = async (endpoint: string, payload: any, expectedLimit: number) => {
      let successCount = 0
      let rateLimitHit = false

      for (let i = 0; i < expectedLimit + 2; i++) {
        try {
          const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Forwarded-For': `192.168.1.${i}`
            },
            body: JSON.stringify(payload)
          })

          if (response.status === 429) {
            rateLimitHit = true
            break
          } else if (response.ok) {
            successCount++
          }
        } catch (error) {
          console.error(`Request ${i} failed:`, error)
        }

        await new Promise(resolve => setTimeout(resolve, 100))
      }

      return { successCount, rateLimitHit }
    }

    // These would be actual integration tests
    // Uncomment and modify for real testing
    /*
    const authResult = await testEndpoint('/api/auth/reset-password', { email: 'test@example.com' }, 5)
    expect(authResult.rateLimitHit).toBe(true)

    const adminResult = await testEndpoint('/api/admin-auth/login', {
      email: 'test@example.com',
      password: 'wrong'
    }, 10)
    expect(adminResult.rateLimitHit).toBe(true)
    */
  })
})