import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminCredentials, createAdminSession } from '@/lib/auth/admin-session'
import { isAdminAuthConfigured } from '@/lib/admin/config-validator'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 10, "15 m")
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Check if admin authentication is properly configured
    if (!isAdminAuthConfigured()) {
      console.error('[AdminAuth] Admin authentication not configured')
      return NextResponse.json(
        { error: 'Admin authentication is not properly configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { email, password, portalKey } = body

    if (!email || !password || !portalKey) {
      return NextResponse.json(
        { error: 'Email, password, and portal key are required' },
        { status: 400 }
      )
    }

    // Verify credentials and portal key
    const result = await verifyAdminCredentials(email, password, portalKey)

    if (!result.success) {
      // Log failed login attempt
      console.warn('[AdminAuth] Failed login attempt:', {
        email,
        timestamp: new Date().toISOString(),
        error: result.error
      })

      return NextResponse.json(
        { error: result.error || 'Authentication failed' },
        { status: 401 }
      )
    }

    // Create admin session
    await createAdminSession(result.userId!, email)

    // Log successful login
    console.log('[AdminAuth] Successful admin login:', {
      email,
      userId: result.userId,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Admin authentication successful'
    })

  } catch (error) {
    console.error('[AdminAuth] Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
