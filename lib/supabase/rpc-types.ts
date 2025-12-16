/**
 * Type-Safe RPC Function Calls
 *
 * This module provides type-safe wrappers around Supabase RPC functions
 * to prevent parameter mismatch errors at compile time.
 *
 * @example
 * // ✅ Type-safe - catches errors at compile time
 * const result = await rpc(supabase, 'check_letter_allowance', { u_id: userId })
 *
 * // ❌ Compile error - parameter name mismatch
 * const result = await rpc(supabase, 'check_letter_allowance', { user_uuid: userId })
 */

import { SupabaseClient } from "@supabase/supabase-js"

/**
 * Type definitions for all RPC functions in the database
 */
export type RPCFunctions = {
  // Letter allowance system
  check_letter_allowance: {
    params: { u_id: string }
    returns: {
      has_allowance: boolean
      remaining: number
      plan_name: string
      is_super: boolean
    }
  }

  deduct_letter_allowance: {
    params: { u_id: string }
    returns: boolean
  }

  // Coupon system
  validate_coupon: {
    params: { code: string }
    returns: {
      valid: boolean
      employee_id?: string
      discount_percentage?: number
    }
  }

  // Audit logging
  log_letter_audit: {
    params: {
      p_letter_id: string
      p_action: string
      p_old_status?: string
      p_new_status?: string
      p_notes?: string
    }
    returns: void
  }

  // Commission system
  get_commission_summary: {
    params: { employee_uuid: string }
    returns: {
      total_referrals: number
      active_subscriptions: number
      total_commission: number
      pending_commission: number
    }
  }

  // Security functions
  detect_suspicious_activity: {
    params: { u_id: string }
    returns: boolean
  }

  log_security_event: {
    params: {
      p_event_type: string
      p_user_id?: string
      p_details?: Record<string, any>
    }
    returns: void
  }

  // Feature flags
  is_feature_enabled: {
    params: {
      p_flag_name: string
      p_user_id?: string | null
      p_user_role?: string | null
    }
    returns: boolean
  }

  increment_rollout: {
    params: {
      p_flag_name: string
      p_increment?: number
    }
    returns: number
  }

  // Smart queue priority
  calculate_letter_priority: {
    params: { p_letter_id: string }
    returns: number
  }

  get_next_letter_for_review: {
    params: {}
    returns: {
      letter_id: string
      priority_score: number
      wait_hours: number
      user_plan: string
      is_first_letter: boolean
    }[]
  }
}

/**
 * Type-safe RPC function caller
 *
 * @param supabase - Supabase client instance
 * @param functionName - Name of the RPC function
 * @param params - Function parameters (type-checked)
 * @returns Promise with typed return value
 * @throws Error if RPC call fails
 */
export async function rpc<T extends keyof RPCFunctions>(
  supabase: SupabaseClient,
  functionName: T,
  params: RPCFunctions[T]['params']
): Promise<RPCFunctions[T]['returns']> {
  const { data, error } = await supabase.rpc(functionName, params as any)

  if (error) {
    console.error(`[RPC] ${functionName} failed:`, error)
    throw new Error(`RPC ${functionName} failed: ${error.message}`)
  }

  return data as RPCFunctions[T]['returns']
}

/**
 * Convenience wrappers for commonly used RPC functions
 */

export async function checkLetterAllowance(
  supabase: SupabaseClient,
  userId: string
) {
  return rpc(supabase, 'check_letter_allowance', { u_id: userId })
}

export async function deductLetterAllowance(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  return rpc(supabase, 'deduct_letter_allowance', { u_id: userId })
}

export async function validateCoupon(
  supabase: SupabaseClient,
  code: string
) {
  return rpc(supabase, 'validate_coupon', { code })
}

export async function logLetterAudit(
  supabase: SupabaseClient,
  params: {
    letterId: string
    action: string
    oldStatus?: string
    newStatus?: string
    notes?: string
  }
) {
  return rpc(supabase, 'log_letter_audit', {
    p_letter_id: params.letterId,
    p_action: params.action,
    p_old_status: params.oldStatus,
    p_new_status: params.newStatus,
    p_notes: params.notes
  })
}

export async function getCommissionSummary(
  supabase: SupabaseClient,
  employeeId: string
) {
  return rpc(supabase, 'get_commission_summary', { employee_uuid: employeeId })
}

export async function calculateLetterPriority(
  supabase: SupabaseClient,
  letterId: string
): Promise<number> {
  return rpc(supabase, 'calculate_letter_priority', { p_letter_id: letterId })
}

export async function getNextLetterForReview(supabase: SupabaseClient) {
  const results = await rpc(supabase, 'get_next_letter_for_review', {})
  return results[0] || null
}

export async function detectSuspiciousActivity(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  return rpc(supabase, 'detect_suspicious_activity', { u_id: userId })
}

export async function logSecurityEvent(
  supabase: SupabaseClient,
  params: {
    eventType: string
    userId?: string
    details?: Record<string, any>
  }
) {
  return rpc(supabase, 'log_security_event', {
    p_event_type: params.eventType,
    p_user_id: params.userId,
    p_details: params.details
  })
}
