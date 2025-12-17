import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { AuthorizationError, handleError, ValidationError } from '@/lib/errors/error-handler'
import { getEmailQueue } from '@/lib/email/queue'

/**
 * GET /api/admin/email-queue
 * Get email queue statistics and recent items
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return handleError(new AuthorizationError('Unauthorized'))
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return handleError(new AuthorizationError('Admin access required'))
    }

    // Get queue statistics
    const emailQueue = getEmailQueue()
    const stats = await emailQueue.getStats()

    // Get recent queue items
    const { data: recentItems, error: itemsError } = await supabase
      .from('email_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (itemsError) {
      console.error('[EmailQueueAPI] Error fetching queue items:', itemsError)
    }

    return NextResponse.json({
      success: true,
      stats,
      recentItems: recentItems || [],
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return handleError(error)
  }
}

/**
 * POST /api/admin/email-queue/retry
 * Retry failed emails
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return handleError(new AuthorizationError('Unauthorized'))
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return handleError(new AuthorizationError('Admin access required'))
    }

    const body = await request.json()
    const { action, emailId } = body

    if (!action) {
      return handleError(new ValidationError('Missing required field: action'))
    }

    if (action === 'retry-failed') {
      // Retry all failed emails
      const { error } = await supabase
        .from('email_queue')
        .update({
          status: 'pending',
          attempts: 0,
          next_retry_at: new Date().toISOString(),
          error: null
        })
        .eq('status', 'failed')

      if (error) {
        console.error('[EmailQueueAPI] Error retrying failed emails:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'All failed emails have been queued for retry'
      })
    } else if (action === 'retry-single' && emailId) {
      // Retry a single email
      const { error } = await supabase
        .from('email_queue')
        .update({
          status: 'pending',
          attempts: 0,
          next_retry_at: new Date().toISOString(),
          error: null
        })
        .eq('id', emailId)

      if (error) {
        console.error('[EmailQueueAPI] Error retrying email:', error)
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Email has been queued for retry'
      })
    } else if (action === 'process-queue') {
      // Process pending emails immediately
      const emailQueue = getEmailQueue()
      await emailQueue.processPending()

      return NextResponse.json({
        success: true,
        message: 'Email queue processing initiated'
      })
    } else {
      return handleError(new ValidationError('Invalid action'))
    }
  } catch (error) {
    return handleError(error)
  }
}
