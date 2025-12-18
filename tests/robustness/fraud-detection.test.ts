/**
 * Fraud Detection System Tests
 * Tests comprehensive coupon fraud detection
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { CouponFraudDetector } from '@/lib/fraud-detection/coupon-fraud'
import { validateCouponWithFraudDetection } from '@/lib/fraud-detection/coupon-fraud'

// Mock the Supabase client
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn()
          })),
          gte: jest.fn(() => ({
            order: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        })),
        gte: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    rpc: jest.fn(() => Promise.resolve({ data: null, error: null }))
  }))
}))

describe('Coupon Fraud Detection', () => {
  let fraudDetector: CouponFraudDetector

  beforeEach(() => {
    fraudDetector = new CouponFraudDetector()
    jest.clearAllMocks()
  })

  describe('Usage Pattern Analysis', () => {
    it('should analyze normal usage patterns correctly', async () => {
      const mockUsageData = [
        {
          ip_address: '192.168.1.100',
          user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          user_id: 'user1',
          subscription_id: 'sub1'
        }
      ]

      // Mock the Supabase responses
      const mockSupabase = await import('@/lib/supabase/server')
      const mockClient = (mockSupabase.createClient as jest.Mock)()
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { code: 'TEST123' }, error: null })
            })
          }),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockUsageData, error: null })
          })
        })
      })

      const result = await fraudDetector.detectFraud('TEST123', '192.168.1.100', 'Mozilla/5.0', 'user1')

      expect(result.isFraudulent).toBe(false)
      expect(result.riskScore).toBeLessThan(25)
      expect(result.action).toBe('allow')
    })

    it('should detect high velocity usage patterns', async () => {
      // Create mock data for high velocity
      const highVelocityData = Array.from({ length: 15 }, (_, i) => ({
        ip_address: '192.168.1.100',
        user_agent: `Mozilla/5.0 (Test Bot ${i})`,
        user_id: `user${i}`,
        created_at: new Date(Date.now() - i * 60000).toISOString()
      }))

      const mockSupabase = await import('@/lib/supabase/server')
      const mockClient = (mockSupabase.createClient as jest.Mock)()
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { code: 'TEST123' }, error: null })
            }),
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: highVelocityData, error: null })
            })
          }),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: highVelocityData, error: null })
          })
        })
      })

      const result = await fraudDetector.detectFraud('TEST123', '192.168.1.100', 'Mozilla/5.0', 'user1')

      expect(result.riskScore).toBeGreaterThan(50)
      expect(result.action).toBe('flag') // or 'block' depending on thresholds
      expect(result.reasons.some(r => r.includes('velocity'))).toBe(true)
    })

    it('should detect multiple user agents from same IP', async () => {
      const multipleUserAgentsData = [
        { user_agent: 'Mozilla/5.0 (Windows)', ip_address: '192.168.1.100' },
        { user_agent: 'Mozilla/5.0 (Mac)', ip_address: '192.168.1.100' },
        { user_agent: 'Mozilla/5.0 (Linux)', ip_address: '192.168.1.100' },
        { user_agent: 'curl/7.68.0', ip_address: '192.168.1.100' },
        { user_agent: 'Python/3.9', ip_address: '192.168.1.100' }
      ]

      const mockSupabase = await import('@/lib/supabase/server')
      const mockClient = (mockSupabase.createClient as jest.Mock)()
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { code: 'TEST123' }, error: null })
            }),
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: multipleUserAgentsData, error: null })
            })
          }),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: multipleUserAgentsData, error: null })
          })
        })
      })

      const result = await fraudDetector.detectFraud('TEST123', '192.168.1.100', 'TestBot/1.0', 'user1')

      expect(result.riskScore).toBeGreaterThan(25)
      expect(result.reasons.some(r => r.includes('user agents'))).toBe(true)
    })

    it('should detect suspicious timing patterns', async () => {
      // Create data with very close timestamps (bot-like behavior)
      const suspiciousTimingData = Array.from({ length: 10 }, (_, i) => ({
        ip_address: '192.168.1.100',
        user_agent: 'Mozilla/5.0',
        user_id: 'user1',
        created_at: new Date(Date.now() - i * 100).toISOString() // 100ms between requests
      }))

      const mockSupabase = await import('@/lib/supabase/server')
      const mockClient = (mockSupabase.createClient as jest.Mock)()
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { code: 'TEST123' }, error: null })
            }),
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: suspiciousTimingData, error: null })
            })
          }),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: suspiciousTimingData, error: null })
          })
        })
      })

      const result = await fraudDetector.detectFraud('TEST123', '192.168.1.100', 'Mozilla/5.0', 'user1')

      expect(result.riskScore).toBeGreaterThan(25)
      expect(result.reasons.some(r => r.includes('requests too close'))).toBe(true)
    })
  })

  describe('Risk Score Calculation', () => {
    it('should calculate risk scores correctly based on patterns', async () => {
      // Mock multiple suspicious patterns
      const suspiciousData = Array.from({ length: 12 }, (_, i) => ({
        ip_address: '192.168.1.100',
        user_agent: `Bot ${i % 5}`,
        user_id: `user${i % 3}`,
        subscription_id: i % 2 ? 'sub1' : null,
        created_at: new Date(Date.now() - i * 200).toISOString()
      }))

      const mockSupabase = await import('@/lib/supabase/server')
      const mockClient = (mockSupabase.createClient as jest.Mock)()
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { code: 'TEST123' }, error: null })
            }),
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: suspiciousData, error: null })
            })
          }),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: suspiciousData, error: null })
          })
        })
      })

      const result = await fraudDetector.detectFraud('TEST123', '192.168.1.100', 'Bot/1.0', 'user1')

      // Should detect multiple issues:
      // - High velocity (>10 requests)
      // - Multiple user agents
      // - Fast timing
      expect(result.riskScore).toBeGreaterThan(75)
      expect(result.action).toBe('block')
      expect(result.reasons.length).toBeGreaterThan(2)
    })
  })

  describe('Fraud Detection Integration', () => {
    it('should validate coupons with fraud detection', async () => {
      const mockRequest = new Request('http://localhost:3000/api/create-checkout', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Mozilla/5.0 (Test Browser)'
        }
      })

      const mockSupabase = await import('@/lib/supabase/server')
      const mockClient = (mockSupabase.createClient as jest.Mock)()
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'coupon123',
                  code: 'VALID123',
                  discount_percent: 20,
                  employee_id: 'emp123',
                  is_active: true
                },
                error: null
              })
            })
          })
        }),
        insert: jest.fn().mockResolvedValue({ data: null, error: null })
      })

      const result = await validateCouponWithFraudDetection('VALID123', mockRequest, 'user123')

      expect(result.isValid).toBe(true)
      expect(result.fraudResult).toBeDefined()
      expect(result.fraudResult?.action).toBe('allow')
    })

    it('should block fraudulent coupon usage', async () => {
      const mockRequest = new Request('http://localhost:3000/api/create-checkout', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Bot/1.0'
        }
      })

      const mockSupabase = await import('@/lib/supabase/server')
      const mockClient = (mockSupabase.createClient as jest.Mock)()
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'coupon123',
                  code: 'VALID123',
                  discount_percent: 20,
                  employee_id: 'emp123',
                  is_active: true
                },
                error: null
              })
            })
          })
        })
      })

      // Mock high velocity data
      const highVelocityData = Array.from({ length: 20 }, (_, i) => ({
        ip_address: '192.168.1.100',
        user_agent: `Bot ${i}`,
        created_at: new Date(Date.now() - i * 1000).toISOString()
      }))

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'coupon123',
                  code: 'VALID123',
                  discount_percent: 20,
                  employee_id: 'emp123',
                  is_active: true
                },
                error: null
              })
            }),
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: highVelocityData, error: null })
            })
          }),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: highVelocityData, error: null })
          })
        })
      })

      const result = await validateCouponWithFraudDetection('VALID123', mockRequest, 'user123')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('suspicious activity')
      expect(result.fraudResult?.action).toBe('block')
    })

    it('should handle database errors gracefully', async () => {
      const mockRequest = new Request('http://localhost:3000/api/create-checkout', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Mozilla/5.0'
        }
      })

      const mockSupabase = await import('@/lib/supabase/server')
      const mockClient = (mockSupabase.createClient as jest.Mock)()
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('Database connection failed')
              })
            })
          })
        })
      })

      const result = await validateCouponWithFraudDetection('INVALID123', mockRequest, 'user123')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid coupon code')
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing request headers', async () => {
      const mockRequest = new Request('http://localhost:3000/api/create-checkout')
      // No headers provided

      const result = await validateCouponWithFraudDetection('TEST123', mockRequest, 'user123')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid coupon code')
    })

    it('should handle malformed IP addresses', async () => {
      const mockRequest = new Request('http://localhost:3000/api/create-checkout', {
        headers: {
          'x-forwarded-for': 'not.an.ip.address',
          'user-agent': 'Mozilla/5.0'
        }
      })

      const result = await validateCouponWithFraudDetection('TEST123', mockRequest, 'user123')

      expect(result).toBeDefined()
      // Should not crash, but may return invalid due to missing coupon
    })

    it('should handle empty user agents', async () => {
      const mockRequest = new Request('http://localhost:3000/api/create-checkout', {
        headers: {
          'x-forwarded-for': '192.168.1.100'
          // No user-agent header
        }
      })

      const result = await validateCouponWithFraudDetection('TEST123', mockRequest, 'user123')

      expect(result).toBeDefined()
      // Should handle gracefully with 'unknown' user agent
    })

    it('should handle concurrent requests correctly', async () => {
      const mockRequest = new Request('http://localhost:3000/api/create-checkout', {
        headers: {
          'x-forwarded-for': '192.168.1.100',
          'user-agent': 'Mozilla/5.0'
        }
      })

      const mockSupabase = await import('@/lib/supabase/server')
      const mockClient = (mockSupabase.createClient as jest.Mock)()
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'coupon123',
                  code: 'CONCURRENT123',
                  discount_percent: 20,
                  employee_id: 'emp123',
                  is_active: true
                },
                error: null
              })
            }),
            gte: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null })
            })
          }),
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null })
          })
        })
      })

      // Make multiple concurrent requests
      const concurrentRequests = Array.from({ length: 5 }, (_, i) =>
        validateCouponWithFraudDetection('CONCURRENT123', mockRequest, `user${i}`)
      )

      const results = await Promise.all(concurrentRequests)

      results.forEach(result => {
        expect(result).toBeDefined()
        expect(result.isValid).toBe(true)
      })
    })
  })
})