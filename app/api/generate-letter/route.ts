import { createClient } from "@/lib/supabase/server"
import { type NextRequest, NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import { letterGenerationRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { validateLetterGenerationRequest } from '@/lib/validation/letter-schema'
import { generateTextWithRetry, checkOpenAIHealth } from '@/lib/ai/openai-retry'

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, letterGenerationRateLimit, 5, "1 h")
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await createClient()

    // 1. Auth Check
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Role Check
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()

    if (profile?.role !== "subscriber") {
      return NextResponse.json({ error: "Only subscribers can generate letters" }, { status: 403 })
    }

    // 3. Check Free Trial eligibility using total_letters_generated
    // This fixes the abuse where users could delete letters and regenerate
    const { data: profileData } = await supabase
      .from("profiles")
      .select("total_letters_generated")
      .eq("id", user.id)
      .single()

    const totalGenerated = profileData?.total_letters_generated || 0
    const { data: allowance } = await supabase.rpc("check_letter_allowance", { u_id: user.id })
    const isSuperUser = allowance?.is_super || false

    // Free trial = 0 total generated letters AND no active paid allowance (implied)
    // Actually, if they have allowance, they are not on free trial logic, they use allowance.
    // If they have NO allowance, and 0 generated, they get free trial.
    const hasAllowance = allowance?.has_allowance && (allowance?.remaining || 0) > 0
    
    const isFreeTrial = totalGenerated === 0 && !hasAllowance && !isSuperUser

    if (!isFreeTrial && !hasAllowance && !isSuperUser) {
        return NextResponse.json(
          {
            error: "No letter credits remaining. Please upgrade your plan.",
            needsSubscription: true,
          },
          { status: 403 },
        )
    }

    const body = await request.json()
    const { letterType, intakeData } = body

    // Comprehensive input validation and sanitization
    const validation = validateLetterGenerationRequest(letterType, intakeData)
    if (!validation.valid) {
      console.error("[GenerateLetter] Validation failed:", validation.errors)
      return NextResponse.json(
        {
          error: "Invalid input data",
          details: validation.errors
        },
        { status: 400 }
      )
    }

    // Use sanitized data
    const sanitizedLetterType = letterType
    const sanitizedIntakeData = validation.data!

    if (!process.env.OPENAI_API_KEY) {
      console.error("[GenerateLetter] Missing OPENAI_API_KEY")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // CRITICAL FIX: Deduct allowance BEFORE generation to prevent race condition
    // Skip deduction for free trial or super user
    if (!isFreeTrial && !isSuperUser) {
        const { data: canDeduct, error: deductError } = await supabase.rpc("deduct_letter_allowance", {
          u_id: user.id,
        })

        if (deductError || !canDeduct) {
          return NextResponse.json(
            {
              error: "No letter allowances remaining (or race condition prevented overage).",
              needsSubscription: true,
            },
            { status: 403 },
          )
        }
    }

    // 4. Create letter record with 'generating' status
    const { data: newLetter, error: insertError } = await supabase
      .from("letters")
      .insert({
        user_id: user.id,
        letter_type: sanitizedLetterType,
        title: `${sanitizedLetterType} - ${new Date().toLocaleDateString()}`,
        intake_data: sanitizedIntakeData,
        status: "generating",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("[GenerateLetter] Database insert error:", insertError)
      // Refund if we deducted
      if (!isFreeTrial && !isSuperUser) {
         await supabase.rpc("add_letter_allowances", { u_id: user.id, amount: 1 })
      }
      return NextResponse.json({ error: "Failed to create letter record" }, { status: 500 })
    }

    try {
      // 5. Generate letter using AI SDK with OpenAI (with retry logic)
      const prompt = buildPrompt(sanitizedLetterType, sanitizedIntakeData)

      console.log('[GenerateLetter] Starting AI generation with retry logic')
      const generationStartTime = Date.now()

      const { text: generatedContent, attempts, duration } = await generateTextWithRetry({
        prompt,
        system: "You are a professional legal attorney drafting formal legal letters. Always produce professional, legally sound content with proper formatting.",
        temperature: 0.7,
        maxOutputTokens: 2048,
        model: "gpt-4-turbo"
      })

      const generationTime = Date.now() - generationStartTime
      console.log(`[GenerateLetter] AI generation completed:`, {
        attempts,
        duration,
        generationTime,
        contentLength: generatedContent.length
      })

      if (!generatedContent) {
        throw new Error("AI returned empty content")
      }

      // 6. Update letter with generated content and move to pending_review
      const { error: updateError } = await supabase
        .from("letters")
        .update({
          ai_draft_content: generatedContent,
          status: "pending_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", newLetter.id)

      if (updateError) {
        throw updateError // Will be caught below
      }

      // 7. Increment total_letters_generated (Fix for abuse)
      await supabase.rpc('increment_total_letters', { p_user_id: user.id })

      // 8. Log audit trail for letter creation
      await supabase.rpc('log_letter_audit', {
        p_letter_id: newLetter.id,
        p_action: 'created',
        p_old_status: 'generating',
        p_new_status: 'pending_review',
        p_notes: 'Letter generated successfully by AI'
      })

      return NextResponse.json(
        {
          success: true,
          letterId: newLetter.id,
          status: "pending_review",
          isFreeTrial,
          aiDraft: generatedContent,
        },
        { status: 200 },
      )
    } catch (generationError: any) {
      console.error("[GenerateLetter] Generation failed:", generationError)
      
      // Update letter status to failed
      await supabase
        .from("letters")
        .update({ 
          status: "failed",
          updated_at: new Date().toISOString()
        })
        .eq("id", newLetter.id)
      
      // REFUND if we deducted
      if (!isFreeTrial && !isSuperUser) {
         await supabase.rpc("add_letter_allowances", { u_id: user.id, amount: 1 })
         // Also log refund? add_letter_allowances already logs checks.
      }

      // Log audit trail for failure
      await supabase.rpc('log_letter_audit', {
        p_letter_id: newLetter.id,
        p_action: 'generation_failed',
        p_old_status: 'generating',
        p_new_status: 'failed',
        p_notes: `Generation failed: ${generationError.message}`
      })
      
      return NextResponse.json(
        { error: generationError.message || "AI generation failed" },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("[GenerateLetter] Letter generation error:", error)
    return NextResponse.json({ error: error.message || "Failed to generate letter" }, { status: 500 })
  }
}

function buildPrompt(letterType: string, intakeData: Record<string, unknown>) {
  const fields = (key: string) => {
    const value = intakeData[key]
    if (value === undefined || value === null || value === '') return ''
    const fieldName = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).replace(/_/g, ' ')
    return `${fieldName}: ${String(value)}`
  }

  const amountField = intakeData["amountDemanded"] ?
    `Amount Demanded: $${Number(intakeData["amountDemanded"]).toLocaleString()}` : ""

  const deadlineField = intakeData["deadlineDate"] ?
    `Deadline: ${intakeData["deadlineDate"]}` : ""

  const incidentDateField = intakeData["incidentDate"] ?
    `Incident Date: ${intakeData["incidentDate"]}` : ""

  const basePrompt = [
    `Draft a professional ${letterType} letter with the following details:`,
    "",
    "Sender Information:",
    fields("senderName"),
    fields("senderAddress"),
    fields("senderEmail"),
    fields("senderPhone"),
    "",
    "Recipient Information:",
    fields("recipientName"),
    fields("recipientAddress"),
    fields("recipientEmail"),
    fields("recipientPhone"),
    "",
    "Case Details:",
    fields("issueDescription"),
    fields("desiredOutcome"),
    amountField,
    deadlineField,
    incidentDateField,
    fields("additionalDetails"),
    "",
    "Requirements:",
    "- Write a professional, legally sound letter (300-500 words)",
    "- Include proper date and formal letter format",
    "- Present facts clearly and objectively",
    "- State clear demands with specific deadlines (if applicable)",
    "- Maintain professional legal tone throughout",
    "- Include proper salutations and closing",
    "- Format as a complete letter with all standard elements",
    "- Avoid any legal advice beyond standard letter writing",
    "",
    "Important: Only return the letter content itself, no explanations or commentary."
  ]

  // Filter out empty lines and join
  return basePrompt.filter(Boolean).join("\n")
}
