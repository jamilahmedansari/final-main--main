import { NextRequest, NextResponse } from 'next/server'
import { processEmailQueue } from '@/lib/email/queue'

/**
 * Cron endpoint for processing pending emails in the queue
 *
 * This endpoint should be called periodically (every 5-15 minutes) by a cron service.
 *
 * Supported cron services:
 * - Vercel Cron: Add to vercel.json
 * - External cron: Use services like cron-job.org, EasyCron, or AWS EventBridge
 *
 * Authentication:
 * - Protected by CRON_SECRET environment variable
 * - Pass secret as ?secret=YOUR_CRON_SECRET or Authorization: Bearer YOUR_CRON_SECRET
 *
 * @example Vercel Cron configuration (vercel.json):
 * ```json
 * {
 *   "crons": [{
 *     "path": "/api/cron/process-email-queue",
 *     "schedule": "star/10 star star star star"
 *   }]
 * }
 * ```
 * (Replace "star" with asterisk in actual config)
 *
 * @example External cron with curl:
 * curl -X POST https://yourdomain.com/api/cron/process-email-queue \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization')
    const searchParams = request.nextUrl.searchParams
    const providedSecret = authHeader?.replace('Bearer ', '') || searchParams.get('secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      console.error('[ProcessEmailQueue] CRON_SECRET not configured')
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      )
    }

    if (providedSecret !== expectedSecret) {
      console.error('[ProcessEmailQueue] Invalid cron secret')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[ProcessEmailQueue] Starting email queue processing...')

    // Process the email queue
    const result = await processEmailQueue()

    console.log('[ProcessEmailQueue] Processing complete:', {
      processed: result.processed,
      failed: result.failed,
      remaining: result.remaining,
    })

    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      remaining: result.remaining,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[ProcessEmailQueue] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process email queue',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint for manual triggering or health checks
 * Requires the same authentication as POST
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const searchParams = request.nextUrl.searchParams
    const providedSecret = searchParams.get('secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'Cron not configured' },
        { status: 500 }
      )
    }

    if (providedSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Return queue status without processing
    return NextResponse.json({
      status: 'ready',
      endpoint: '/api/cron/process-email-queue',
      method: 'POST',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
