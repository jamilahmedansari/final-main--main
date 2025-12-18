import { NextRequest, NextResponse } from 'next/server'
import { runEmailServiceTests, testProviderConfiguration } from '@/lib/email/test'

/**
 * API endpoint to test email service integration
 * This is a development/testing endpoint - should be removed in production
 */

export async function GET(request: NextRequest) {
  // Only allow in development or with special query parameter
  const isDev = process.env.NODE_ENV === 'development'
  const hasTestParam = request.nextUrl.searchParams.get('test') === 'true'

  if (!isDev && !hasTestParam) {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode or with ?test=true' },
      { status: 403 }
    )
  }

  try {
    // Capture console output
    const originalLog = console.log
    const logs: string[] = []

    console.log = (...args: any[]) => {
      logs.push(args.join(' '))
      originalLog(...args)
    }

    // Run the tests
    await runEmailServiceTests()

    // Restore console.log
    console.log = originalLog

    return NextResponse.json({
      success: true,
      message: 'Email service tests completed',
      logs: logs,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[TestEmail] Error:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { testType = 'full' } = body

    // Only allow in development or with special query parameter
    const isDev = process.env.NODE_ENV === 'development'
    if (!isDev) {
      return NextResponse.json(
        { error: 'This endpoint is only available in development mode' },
        { status: 403 }
      )
    }

    if (testType === 'config') {
      // Capture console output
      const originalLog = console.log
      const logs: string[] = []

      console.log = (...args: any[]) => {
        logs.push(args.join(' '))
        originalLog(...args)
      }

      await testProviderConfiguration()

      // Restore console.log
      console.log = originalLog

      return NextResponse.json({
        success: true,
        message: 'Email configuration test completed',
        logs: logs,
        timestamp: new Date().toISOString()
      })
    }

    // Default: run full tests
    return NextResponse.json({
      success: false,
      error: 'Please use GET method to run full tests',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[TestEmail] POST Error:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}