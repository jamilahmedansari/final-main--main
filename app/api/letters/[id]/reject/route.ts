import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, getAdminSession } from '@/lib/auth/admin-session'
import { sendTemplateEmail } from '@/lib/email/service'
import { validateAdminRequest, generateAdminCSRF } from '@/lib/security/csrf'
import { sanitizeString } from '@/lib/security/input-sanitizer'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const authError = await requireAdminAuth()
    if (authError) return authError

    // CSRF Protection for admin actions
    const csrfResult = await validateAdminRequest(request)
    if (!csrfResult.valid) {
      return NextResponse.json(
        { error: 'CSRF validation failed', details: csrfResult.error },
        { status: 403 }
      )
    }

    const { id } = await params
    const supabase = await createClient()
    const adminSession = await getAdminSession()

    const body = await request.json()
    const { rejectionReason, reviewNotes } = body

    if (!rejectionReason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    // Validate and sanitize input
    const sanitizedRejectionReason = sanitizeString(rejectionReason, 1000) // 1k char limit
    const sanitizedReviewNotes = reviewNotes ? sanitizeString(reviewNotes, 2000) : null

    if (!sanitizedRejectionReason) {
      return NextResponse.json({ error: 'Invalid rejection reason provided' }, { status: 400 })
    }

    const { data: letter } = await supabase
      .from('letters')
      .select('status, user_id, title')
      .eq('id', id)
      .single()

    const { error: updateError } = await supabase
      .from('letters')
      .update({
        status: 'rejected',
        rejection_reason: sanitizedRejectionReason,
        review_notes: sanitizedReviewNotes,
        reviewed_by: adminSession?.userId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    await supabase.rpc('log_letter_audit', {
      p_letter_id: id,
      p_action: 'rejected',
      p_old_status: letter?.status || 'unknown',
      p_new_status: 'rejected',
      p_notes: `Rejection reason: ${sanitizedRejectionReason}`
    })

    // Send rejection notification email (non-blocking)
    if (letter?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', letter.user_id)
        .single()

      if (profile?.email) {
        // Send email asynchronously - don't wait for it
        sendTemplateEmail('letter-rejected', profile.email, {
          userName: profile.full_name || 'there',
          letterTitle: letter.title || 'Your letter',
          rejectionReason: rejectionReason,
          actionUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard/letters/${id}`,
        }).catch(error => {
          console.error('[Reject] Failed to send rejection email:', error)
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Letter rejection error:', error)
    return NextResponse.json(
      { error: 'Failed to reject letter' },
      { status: 500 }
    )
  }
}
