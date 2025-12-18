/**
 * CSRF Protection Tests
 * Tests comprehensive CSRF protection for admin actions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import {
  generateCSRFToken,
  signCSRFToken,
  verifySignedCSRFToken,
  validateAdminRequest,
  generateAdminCSRF,
  getCSRFSecret
} from '@/lib/security/csrf'

// Mock environment variables
const originalEnv = process.env

describe('CSRF Protection', () => {
  beforeEach(() => {
    process.env = {
      ...originalEnv,
      CSRF_SECRET: 'test-secret-key-that-is-at-least-32-characters-long-for-security'
    }
    jest.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('CSRF Token Generation', () => {
    it('should generate valid CSRF tokens', () => {
      const token = generateCSRFToken()

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBe(64) // 32 bytes * 2 (hex encoding)
    })

    it('should generate unique tokens', () => {
      const token1 = generateCSRFToken()
      const token2 = generateCSRFToken()

      expect(token1).not.toBe(token2)
    })

    it('should create CSRF token with expiration', () => {
      const csrfToken = generateAdminCSRF()

      expect(csrfToken.token).toBeDefined()
      expect(csrfToken.signedToken).toBeDefined()
      expect(csrfToken.expiresAt).toBeGreaterThan(Date.now())
      expect(csrfToken.cookieHeader).toBeDefined()
      expect(csrfToken.cookieHeader).toContain('csrf_token=')
      expect(csrfToken.cookieHeader).toContain('HttpOnly')
      expect(csrfToken.cookieHeader).toContain('Secure')
      expect(csrfToken.cookieHeader).toContain('SameSite=Strict')
    })
  })

  describe('CSRF Token Signing', () => {
    it('should sign and verify tokens correctly', () => {
      const token = generateCSRFToken()
      const secret = 'test-secret-key'

      const signedToken = signCSRFToken(token, secret)
      const verification = verifySignedCSRFToken(signedToken, secret)

      expect(verification.valid).toBe(true)
      expect(verification.error).toBeUndefined()
    })

    it('should reject tokens with invalid signature', () => {
      const token = generateCSRFToken()
      const secret = 'test-secret-key'
      const wrongSecret = 'wrong-secret-key'

      const signedToken = signCSRFToken(token, secret)
      const verification = verifySignedCSRFToken(signedToken, wrongSecret)

      expect(verification.valid).toBe(false)
      expect(verification.error).toContain('Invalid token signature')
    })

    it('should reject expired tokens', () => {
      const token = generateCSRFToken()
      const secret = 'test-secret-key'

      const signedToken = signCSRFToken(token, secret)

      // Mock time to be in the future (beyond expiration)
      const originalDateNow = Date.now
      Date.now = jest.fn(() => originalDateNow() + 25 * 60 * 60 * 1000) // 25 hours later

      const verification = verifySignedCSRFToken(signedToken, secret)

      expect(verification.valid).toBe(false)
      expect(verification.error).toContain('expired')

      Date.now = originalDateNow
    })

    it('should reject malformed tokens', () => {
      const malformedTokens = [
        'invalid-token',
        'too:short',
        'missing:parts:here',
        'a:b:c:d'
      ]

      malformedTokens.forEach(token => {
        const verification = verifySignedCSRFToken(token, 'test-secret')
        expect(verification.valid).toBe(false)
      })
    })
  })

  describe('Admin Request Validation', () => {
    it('should validate requests with correct CSRF token', async () => {
      const csrfData = generateAdminCSRF()

      const mockRequest = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfData.signedToken
        }
      })

      const result = await validateAdminRequest(mockRequest)

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject requests without CSRF token', async () => {
      const mockRequest = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST'
      })

      const result = await validateAdminRequest(mockRequest)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('missing')
    })

    it('should reject requests with invalid CSRF token', async () => {
      const mockRequest = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': 'invalid-token'
        }
      })

      const result = await validateAdminRequest(mockRequest)

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should allow GET requests without CSRF token', async () => {
      const mockRequest = new Request('http://localhost:3000/api/admin/test', {
        method: 'GET'
      })

      const result = await validateAdminRequest(mockRequest)

      expect(result.valid).toBe(true)
    })

    it('should allow HEAD and OPTIONS requests without CSRF token', async () => {
      const methods = ['HEAD', 'OPTIONS']

      for (const method of methods) {
        const mockRequest = new Request('http://localhost:3000/api/admin/test', {
          method
        })

        const result = await validateAdminRequest(mockRequest)
        expect(result.valid).toBe(true)
      }
    })

    it('should skip CSRF for webhook endpoints', async () => {
      const webhookPaths = [
        'http://localhost:3000/api/stripe/webhook',
        'http://localhost:3000/api/cron/daily-reset',
        'http://localhost:3000/api/health',
        'http://localhost:3000/api/auth/reset-password'
      ]

      for (const url of webhookPaths) {
        const mockRequest = new Request(url, {
          method: 'POST'
        })

        const result = await validateAdminRequest(mockRequest)
        expect(result.valid).toBe(true)
      }
    })
  })

  describe('CSRF Secret Management', () => {
    it('should throw error when CSRF secret is not configured', () => {
      delete process.env.CSRF_SECRET

      expect(() => getCSRFSecret()).toThrow('CSRF_SECRET environment variable is not set')
    })

    it('should return configured CSRF secret', () => {
      const secret = getCSRFSecret()
      expect(secret).toBe('test-secret-key-that-is-at-least-32-characters-long-for-security')
    })
  })

  describe('Cookie Management', () => {
    it('should create proper cookie headers', () => {
      const csrfData = generateAdminCSRF()

      expect(csrfData.cookieHeader).toContain('csrf_token=')
      expect(csrfData.cookieHeader).toContain('Path=/')
      expect(csrfData.cookieHeader).toContain('HttpOnly')
      expect(csrfData.cookieHeader).toContain('Secure')
      expect(csrfData.cookieHeader).toContain('SameSite=Strict')
      expect(csrfData.cookieHeader).toContain('Max-Age=')
    })

    it('should include proper expiration in cookie', () => {
      const csrfData = generateAdminCSRF()
      const maxAge = 24 * 60 * 60 // 24 hours in seconds

      expect(csrfData.cookieHeader).toContain(`Max-Age=${maxAge}`)
    })
  })

  describe('Security Edge Cases', () => {
    it('should handle timing attacks safely', async () => {
      const csrfData = generateAdminCSRF()
      const invalidToken = 'a'.repeat(128) // Same length but invalid

      const mockRequest1 = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfData.signedToken
        }
      })

      const mockRequest2 = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': invalidToken
        }
      })

      const startTime = Date.now()
      const result1 = await validateAdminRequest(mockRequest1)
      const time1 = Date.now() - startTime

      const startTime2 = Date.now()
      const result2 = await validateAdminRequest(mockRequest2)
      const time2 = Date.now() - startTime2

      expect(result1.valid).toBe(true)
      expect(result2.valid).toBe(false)

      // Timing should be similar (within reasonable bounds)
      const timeDifference = Math.abs(time1 - time2)
      expect(timeDifference).toBeLessThan(100) // Allow for small variations
    })

    it('should reject CSRF tokens from different secrets', async () => {
      const token1 = generateAdminCSRF()

      // Change the secret
      process.env.CSRF_SECRET = 'different-secret-key-for-testing'

      const mockRequest = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': token1.signedToken
        }
      })

      const result = await validateAdminRequest(mockRequest)
      expect(result.valid).toBe(false)
    })

    it('should prevent token reuse across different sessions', async () => {
      const csrfData1 = generateAdminCSRF()
      const csrfData2 = generateAdminCSRF()

      // Try to use token1 with token2's data
      const mockRequest = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfData1.signedToken
        }
      })

      // Mock request with cookie from different session
      const result = await validateAdminRequest(mockRequest, csrfData2.token)
      expect(result.valid).toBe(false)
    })
  })

  describe('Integration Tests', () => {
    it('should work end-to-end for admin workflow', async () => {
      // Step 1: Get CSRF token
      const csrfData = generateAdminCSRF()

      // Step 2: Use token in admin request
      const mockRequest = new Request('http://localhost:3000/api/letters/123/approve', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfData.signedToken,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          finalContent: 'Approved content',
          reviewNotes: 'Looks good'
        })
      })

      const result = await validateAdminRequest(mockRequest)
      expect(result.valid).toBe(true)

      // Step 3: Verify token is still valid for subsequent requests
      const mockRequest2 = new Request('http://localhost:3000/api/letters/456/reject', {
        method: 'POST',
        headers: {
          'x-csrf-token': csrfData.signedToken,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          rejectionReason: 'Not appropriate'
        })
      })

      const result2 = await validateAdminRequest(mockRequest2)
      expect(result2.valid).toBe(true)
    })

    it('should handle multiple concurrent admin requests', async () => {
      const csrfData = generateAdminCSRF()

      const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
        new Request(`http://localhost:3000/api/letters/${i}/approve`, {
          method: 'POST',
          headers: {
            'x-csrf-token': csrfData.signedToken,
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            finalContent: `Approval for letter ${i}`,
            reviewNotes: 'Automated approval'
          })
        })
      )

      const results = await Promise.all(
        concurrentRequests.map(request => validateAdminRequest(request))
      )

      results.forEach(result => {
        expect(result.valid).toBe(true)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed request headers gracefully', async () => {
      const mockRequest = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': ''
        }
      })

      const result = await validateAdminRequest(mockRequest)
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should handle extremely long CSRF tokens', async () => {
      const extremelyLongToken = 'a'.repeat(10000)

      const mockRequest = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': extremelyLongToken
        }
      })

      const result = await validateAdminRequest(mockRequest)
      expect(result.valid).toBe(false)
    })

    it('should handle Unicode characters in tokens', async () => {
      const unicodeToken = '🔒'.repeat(20) + 'csrf-token-with-emoji'

      const mockRequest = new Request('http://localhost:3000/api/admin/test', {
        method: 'POST',
        headers: {
          'x-csrf-token': unicodeToken
        }
      })

      const result = await validateAdminRequest(mockRequest)
      expect(result.valid).toBe(false)
    })
  })
})