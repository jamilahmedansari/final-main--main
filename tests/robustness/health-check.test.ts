/**
 * Health Check System Tests
 * Tests comprehensive health monitoring for all system components
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { healthChecker, HealthChecker } from '@/lib/monitoring/health-check'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn()
}))

// Mock the OpenAI health check
jest.mock('@/lib/ai/openai-retry', () => ({
  checkOpenAIHealth: jest.fn()
}))

describe('Health Check System', () => {
  let healthCheckService: HealthChecker
  let mockCreateClient: jest.Mock
  let mockCheckOpenAIHealth: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    healthCheckService = new HealthChecker()
    mockCreateClient = require('@/lib/supabase/server').createClient
    mockCheckOpenAIHealth = require('@/lib/ai/openai-retry').checkOpenAIHealth
  })

  describe('Database Health Check', () => {
    it('should report healthy database when connection succeeds', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [{ id: 'test' }],
              error: null
            })
          })
        })
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const health = await healthChecker.checkHealth()

      expect(health.services.database.status).toBe('healthy')
      expect(health.services.database.responseTime).toBeGreaterThan(0)
      expect(health.services.database.error).toBeUndefined()
    })

    it('should report unhealthy database on connection failure', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: null,
              error: new Error('Connection failed')
            })
          })
        })
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const health = await healthChecker.checkHealth()

      expect(health.services.database.status).toBe('unhealthy')
      expect(health.services.database.error).toContain('Connection failed')
    })

    it('should report unhealthy database on exception', async () => {
      mockCreateClient.mockRejectedValue(new Error('Database not available'))

      const health = await healthChecker.checkHealth()

      expect(health.services.database.status).toBe('unhealthy')
      expect(health.services.database.error).toContain('Database not available')
    })
  })

  describe('OpenAI Health Check', () => {
    it('should report healthy OpenAI when service responds correctly', async () => {
      mockCheckOpenAIHealth.mockResolvedValue({
        healthy: true,
        responseTime: 250
      })

      const health = await healthChecker.checkHealth()

      expect(health.services.openai.status).toBe('healthy')
      expect(health.services.openai.responseTime).toBe(250)
      expect(health.services.openai.error).toBeUndefined()
    })

    it('should report unhealthy OpenAI when service fails', async () => {
      mockCheckOpenAIHealth.mockResolvedValue({
        healthy: false,
        responseTime: 5000,
        error: 'Service unavailable'
      })

      const health = await healthChecker.checkHealth()

      expect(health.services.openai.status).toBe('unhealthy')
      expect(health.services.openai.error).toContain('Service unavailable')
    })

    it('should report unhealthy OpenAI on check failure', async () => {
      mockCheckOpenAIHealth.mockRejectedValue(new Error('Network error'))

      const health = await healthChecker.checkHealth()

      expect(health.services.openai.status).toBe('unhealthy')
      expect(health.services.openai.error).toContain('Network error')
    })
  })

  describe('Supabase Auth Health Check', () => {
    it('should report healthy auth when service responds', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' }
          })
        }
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const health = await healthChecker.checkHealth()

      expect(health.services.supabaseAuth.status).toBe('healthy')
      expect(health.services.supabaseAuth.responseTime).toBeGreaterThan(0)
    })

    it('should report unhealthy auth on unexpected error', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockRejectedValue(new Error('Auth service down'))
        }
      }

      mockCreateClient.mockResolvedValue(mockSupabase)

      const health = await healthChecker.checkHealth()

      expect(health.services.supabaseAuth.status).toBe('unhealthy')
      expect(health.services.supabaseAuth.error).toContain('Auth service down')
    })
  })

  describe('Email Service Health Check', () => {
    it('should report healthy email service when properly configured', async () => {
      process.env.EMAIL_PROVIDER = 'sendgrid'
      process.env.SENDGRID_API_KEY = 'SG.test_key'

      const health = await healthChecker.checkHealth()

      expect(health.services.emailService.status).toBe('healthy')
      expect(health.services.emailService.details?.provider).toBe('sendgrid')
    })

    it('should report degraded email service when not configured', async () => {
      delete process.env.EMAIL_PROVIDER
      delete process.env.SENDGRID_API_KEY

      const health = await healthChecker.checkHealth()

      expect(health.services.emailService.status).toBe('degraded')
      expect(health.services.emailService.error).toContain('not configured')
    })

    it('should report healthy for console provider', async () => {
      process.env.EMAIL_PROVIDER = 'console'

      const health = await healthChecker.checkHealth()

      expect(health.services.emailService.status).toBe('healthy')
      expect(health.services.emailService.details?.provider).toBe('console')
      expect(health.services.emailService.details?.mode).toBe('development')
    })
  })

  describe('Rate Limiting Health Check', () => {
    it('should report healthy rate limiting when Redis is configured', async () => {
      process.env.KV_REST_API_URL = 'https://test-redis.upstash.io'
      process.env.KV_REST_API_TOKEN = 'test_token'

      const health = await healthChecker.checkHealth()

      expect(health.services.rateLimiting.status).toBe('healthy')
      expect(health.services.rateLimiting.details?.hasRedis).toBe(true)
    })

    it('should report degraded rate limiting when Redis is not configured', async () => {
      delete process.env.KV_REST_API_URL
      delete process.env.KV_REST_API_TOKEN

      const health = await healthChecker.checkHealth()

      expect(health.services.rateLimiting.status).toBe('degraded')
      expect(health.services.rateLimiting.error).toContain('not configured')
    })

    it('should report unhealthy rate limiting when Redis URL is invalid', async () => {
      process.env.KV_REST_API_URL = 'invalid-url'
      process.env.KV_REST_API_TOKEN = 'test_token'

      const health = await healthChecker.checkHealth()

      expect(health.services.rateLimiting.status).toBe('unhealthy')
      expect(health.services.rateLimiting.error).toContain('Invalid Redis URL')
    })
  })

  describe('Overall Health Status', () => {
    it('should report healthy when all services are healthy', async () => {
      // Mock all services as healthy
      mockCheckOpenAIHealth.mockResolvedValue({ healthy: true, responseTime: 100 })

      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' }
          })
        }
      }

      mockCreateClient.mockResolvedValue(mockSupabase)
      process.env.EMAIL_PROVIDER = 'console'
      process.env.KV_REST_API_URL = 'https://test-redis.upstash.io'
      process.env.KV_REST_API_TOKEN = 'test_token'

      const health = await healthChecker.checkHealth()

      expect(health.status).toBe('healthy')
    })

    it('should report unhealthy when critical services fail', async () => {
      // Mock database as unhealthy (critical)
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockRejectedValue(new Error('DB connection failed'))
          })
        }),
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' }
          })
        }
      }

      mockCreateClient.mockResolvedValue(mockSupabase)
      mockCheckOpenAIHealth.mockResolvedValue({ healthy: true, responseTime: 100 })

      const health = await healthChecker.checkHealth()

      expect(health.status).toBe('unhealthy')
    })

    it('should report degraded when non-critical services fail', async () => {
      // Mock database and auth as healthy, but email service missing
      const mockSupabase = {
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' }
          })
        }
      }

      mockCreateClient.mockResolvedValue(mockSupabase)
      mockCheckOpenAIHealth.mockResolvedValue({ healthy: true, responseTime: 100 })

      // Clear email config (degraded service)
      delete process.env.EMAIL_PROVIDER
      delete process.env.KV_REST_API_URL

      const health = await healthChecker.checkHealth()

      expect(health.status).toBe('degraded')
    })
  })

  describe('Health Metrics', () => {
    it('should include response time metrics', async () => {
      const startTime = Date.now()

      mockCreateClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' }
          })
        }
      })

      mockCheckOpenAIHealth.mockResolvedValue({ healthy: true, responseTime: 100 })

      const health = await healthChecker.checkHealth()

      expect(health.metrics.responseTime).toBeGreaterThan(0)
      expect(health.metrics.responseTime).toBeLessThan(5000) // Should complete quickly
      expect(health.metrics.uptime).toBeGreaterThan(0)
      expect(health.metrics.timestamp).toBeDefined()
    })

    it('should include memory usage metrics', async () => {
      mockCreateClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' }
          })
        }
      })

      mockCheckOpenAIHealth.mockResolvedValue({ healthy: true, responseTime: 100 })

      const health = await healthChecker.checkHealth()

      expect(health.metrics.memoryUsage).toBeDefined()
      expect(health.metrics.memoryUsage.rss).toBeGreaterThan(0)
      expect(health.metrics.memoryUsage.heapUsed).toBeGreaterThan(0)
      expect(health.metrics.memoryUsage.heapTotal).toBeGreaterThan(0)
    })
  })

  describe('Ready and Live Checks', () => {
    it('should return true for ready check when system is healthy', async () => {
      mockCreateClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      })

      const isReady = await healthChecker.isReady()
      expect(isReady).toBe(true)
    })

    it('should return true for ready check when system is degraded', async () => {
      mockCreateClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      })

      const isReady = await healthChecker.isReady()
      expect(isReady).toBe(true)
    })

    it('should return true for live check with basic connectivity', async () => {
      mockCreateClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      })

      const isLive = await healthChecker.isLive()
      expect(isLive).toBe(true)
    })

    it('should return false for live check when database is down', async () => {
      mockCreateClient.mockRejectedValue(new Error('Database connection failed'))

      const isLive = await healthChecker.isLive()
      expect(isLive).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle individual service failures gracefully', async () => {
      // Mock one service to fail catastrophically
      mockCheckOpenAIHealth.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      mockCreateClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' }
          })
        }
      })

      const health = await healthChecker.checkHealth()

      // Should still complete with other services
      expect(health.services.database.status).toBe('healthy')
      expect(health.services.supabaseAuth.status).toBe('healthy')
      expect(health.services.openai.status).toBe('unhealthy')
      expect(health.services.openai.error).toContain('Unexpected error')
    })

    it('should handle Promise.allSettled results correctly', async () => {
      // Mixed success and failure scenarios
      mockCheckOpenAIHealth.mockRejectedValue(new Error('OpenAI down'))
      mockCreateClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        auth: jest.fn().mockImplementation(() => {
          throw new Error('Auth service error')
        })
      })

      const health = await healthChecker.checkHealth()

      expect(health.services.database.status).toBe('healthy')
      expect(health.services.openai.status).toBe('unhealthy')
      expect(health.services.supabaseAuth.status).toBe('unhealthy')
      expect(health.services.emailService.status).toBe('healthy') // Default state
      expect(health.services.rateLimiting.status).toBe('healthy') // Default state
    })
  })

  describe('Concurrent Health Checks', () => {
    it('should handle concurrent health check requests', async () => {
      mockCreateClient.mockResolvedValue({
        from: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'No session' }
          })
        }
      })

      mockCheckOpenAIHealth.mockResolvedValue({ healthy: true, responseTime: 100 })

      // Make multiple concurrent health checks
      const concurrentChecks = Array.from({ length: 5 }, () =>
        healthChecker.checkHealth()
      )

      const results = await Promise.all(concurrentChecks)

      results.forEach(health => {
        expect(health.status).toBe('healthy')
        expect(health.services.database.status).toBe('healthy')
        expect(health.services.openai.status).toBe('healthy')
      })

      // Should not cause excessive database calls
      expect(mockCreateClient).toHaveBeenCalledTimes(5) // One per check
    })
  })
})