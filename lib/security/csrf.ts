/**
 * CSRF Protection Utilities
 * Provides comprehensive CSRF protection for admin actions
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto'

// CSRF Configuration
const CSRF_TOKEN_LENGTH = 32
const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_EXPIRY = 60 * 60 * 24 * 1000 // 24 hours

export interface CSRFToken {
  token: string
  expiresAt: number
}

export interface CSRFValidationResult {
  valid: boolean
  error?: string
}

/**
 * Generate a new CSRF token
 */
export function generateCSRFToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex')
}

/**
 * Create a CSRF token with expiration
 */
export function createCSRFToken(): CSRFToken {
  return {
    token: generateCSRFToken(),
    expiresAt: Date.now() + CSRF_EXPIRY
  }
}

/**
 * Generate a signed CSRF token for secure storage
 */
export function signCSRFToken(token: string, secret: string): string {
  const timestamp = Date.now().toString()
  const data = `${token}:${timestamp}`
  const signature = createHash('sha256').update(`${data}:${secret}`).digest('hex')
  return `${data}:${signature}`
}

/**
 * Verify a signed CSRF token
 */
export function verifySignedCSRFToken(signedToken: string, secret: string): CSRFValidationResult {
  try {
    const parts = signedToken.split(':')
    if (parts.length !== 3) {
      return { valid: false, error: 'Invalid token format' }
    }

    const [token, timestamp, signature] = parts

    // Verify timestamp is not too old
    const tokenTime = parseInt(timestamp)
    if (Date.now() - tokenTime > CSRF_EXPIRY) {
      return { valid: false, error: 'Token expired' }
    }

    // Verify signature
    const expectedSignature = createHash('sha256')
      .update(`${token}:${timestamp}:${secret}`)
      .digest('hex')

    if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'))) {
      return { valid: false, error: 'Invalid token signature' }
    }

    return { valid: true }
  } catch (error) {
    return { valid: false, error: 'Token verification failed' }
  }
}

/**
 * Validate CSRF token from request
 */
export function validateCSRFToken(
  request: Request,
  token: string,
  secret: string
): CSRFValidationResult {
  // Get token from header or body
  const headerToken = request.headers.get(CSRF_HEADER_NAME)

  if (!headerToken && !token) {
    return { valid: false, error: 'CSRF token missing' }
  }

  const providedToken = headerToken || token

  if (!providedToken) {
    return { valid: false, error: 'CSRF token not provided' }
  }

  return verifySignedCSRFToken(providedToken, secret)
}

/**
 * Set CSRF token cookie
 */
export function setCSRFCookie(response: Response, token: CSRFToken): void {
  const cookieValue = `${token.token}:${token.expiresAt}`

  // Note: In Next.js, you'd use response.cookies.set()
  // This is a utility function for other frameworks
  response.headers.set('Set-Cookie', [
    `${CSRF_COOKIE_NAME}=${cookieValue}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${Math.floor(CSRF_EXPIRY / 1000)}`
  ].join('; '))
}

/**
 * Get CSRF token from cookie
 */
export function getCSRFCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=')
    acc[key] = value
    return acc
  }, {} as Record<string, string>)

  return cookies[CSRF_COOKIE_NAME] || null
}

/**
 * Generate CSRF token for API response
 */
export function generateCSRFResponse(secret: string): {
  token: string
  signedToken: string
  expiresAt: number
} {
  const tokenData = createCSRFToken()
  const signedToken = signCSRFToken(tokenData.token, secret)

  return {
    token: tokenData.token,
    signedToken,
    expiresAt: tokenData.expiresAt
  }
}

/**
 * Middleware for CSRF protection
 */
export function createCSRFMiddleware(secret: string) {
  return async (request: Request, token?: string): Promise<CSRFValidationResult> => {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    const method = request.method.toUpperCase()
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return { valid: true }
    }

    // For POST, PUT, DELETE, PATCH requests, validate CSRF
    return validateCSRFToken(request, token || '', secret)
  }
}

/**
 * Check if request should be protected by CSRF
 */
export function requiresCSRFProtection(request: Request): boolean {
  const method = request.method.toUpperCase()
  const url = new URL(request.url)

  // Protect state-changing methods
  const protectedMethods = ['POST', 'PUT', 'DELETE', 'PATCH']

  // Skip CSRF for API endpoints that are typically called from external services
  const skippedPaths = [
    '/api/stripe/webhook',
    '/api/cron/',
    '/api/health',
    '/api/auth/reset-password' // Password reset via email link
  ]

  return protectedMethods.includes(method) &&
         !skippedPaths.some(path => url.pathname.startsWith(path))
}

/**
 * Get CSRF secret from environment
 */
export function getCSRFSecret(): string {
  const secret = process.env.CSRF_SECRET
  if (!secret) {
    throw new Error('CSRF_SECRET environment variable is not set')
  }
  return secret
}

/**
 * Validate request for admin endpoints with CSRF protection
 */
export async function validateAdminRequest(
  request: Request,
  token?: string
): Promise<CSRFValidationResult> {
  // Skip CSRF for non-protected methods
  if (!requiresCSRFProtection(request)) {
    return { valid: true }
  }

  try {
    const secret = getCSRFSecret()
    const middleware = createCSRFMiddleware(secret)
    return await middleware(request, token)
  } catch (error) {
    return {
      valid: false,
      error: 'CSRF configuration error'
    }
  }
}

/**
 * Generate CSRF tokens for admin session
 */
export function generateAdminCSRF(): {
  token: string
  signedToken: string
  expiresAt: number
  cookieHeader: string
} {
  try {
    const secret = getCSRFSecret()
    const tokenData = generateCSRFResponse(secret)

    // Create cookie header for setting the token
    const cookieValue = `${tokenData.token}:${tokenData.expiresAt}`
    const cookieHeader = [
      `${CSRF_COOKIE_NAME}=${cookieValue}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      `Max-Age=${Math.floor(CSRF_EXPIRY / 1000)}`
    ].join('; ')

    return {
      ...tokenData,
      cookieHeader
    }
  } catch (error) {
    throw new Error('Failed to generate CSRF token')
  }
}