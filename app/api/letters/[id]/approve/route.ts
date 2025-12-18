import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth, getAdminSession } from '@/lib/auth/admin-session'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { sendTemplateEmail } from '@/lib/email/service'
import { validateAdminRequest, generateAdminCSRF } from '@/lib/security/csrf'
import { sanitizeString } from '@/lib/security/input-sanitizer'

// GET endpoint to provide CSRF token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin authentication
    const authError = await requireAdminAuth()
    if (authError) return authError

    try {
      const csrfData = generateAdminCSRF()

      const response = NextResponse.json({
        csrfToken: csrfData.signedToken,
        expiresAt: csrfData.expiresAt
      })

      // Set CSRF cookie
      response.headers.set('Set-Cookie', csrfData.cookieHeader)

      return response
    } catch (csrfError) {
      console.error('[Approve] CSRF generation error:', csrfError)
      return NextResponse.json(
        { error: 'Failed to generate CSRF token' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[Approve] CSRF token endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 10, "15 m")
    if (rateLimitResponse) {
      return rateLimitResponse
    }

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
    const { finalContent, reviewNotes } = body

    if (!finalContent) {
      return NextResponse.json({ error: 'Final content is required for approval' }, { status: 400 })
    }

    // Validate and sanitize input
    const sanitizedFinalContent = sanitizeString(finalContent, 10000) // 10k char limit
    const sanitizedReviewNotes = reviewNotes ? sanitizeString(reviewNotes, 2000) : null

    if (!sanitizedFinalContent) {
      return NextResponse.json({ error: 'Invalid final content provided' }, { status: 400 })
    }

    const { data: letter } = await supabase
      .from('letters')
      .select('status, user_id, title')
      .eq('id', id)
      .single()

    const { error: updateError } = await supabase
      .from('letters')
      .update({
        status: 'approved',
        final_content: sanitizedFinalContent,
        review_notes: sanitizedReviewNotes,
        reviewed_by: adminSession?.userId,
        reviewed_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    await supabase.rpc('log_letter_audit', {
      p_letter_id: id,
      p_action: 'approved',
      p_old_status: letter?.status || 'unknown',
      p_new_status: 'approved',
      p_notes: sanitizedReviewNotes || 'Letter approved by admin'
    })

    // Send approval notification email (non-blocking)
    if (letter?.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', letter.user_id)
        .single()

      if (profile?.email) {
        // Send email asynchronously - don't wait for it
        sendTemplateEmail('letter-approved', profile.email, {
          userName: profile.full_name || 'there',
          letterTitle: letter.title || 'Your letter',
          letterLink: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dashboard/letters/${id}`,
        }).catch(error => {
          console.error('[Approve] Failed to send approval email:', error)
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Letter approval error:', error)
    return NextResponse.json(
      { error: 'Failed to approve letter' },
      { status: 500 }
    )
  }
}
