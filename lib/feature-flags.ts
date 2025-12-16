/**
 * Feature Flags System
 *
 * Enables safe feature rollouts, A/B testing, and instant rollbacks.
 *
 * @example
 * // Check if feature is enabled for current user
 * const enabled = await isFeatureEnabled('new_dashboard_ui', user.id, user.role)
 *
 * @example
 * // Use in component
 * if (await isFeatureEnabled('auto_save_forms', user.id)) {
 *   return <AutoSaveLetterForm />
 * }
 */

import { createClient } from "@/lib/supabase/server"

export type FeatureFlag = {
  id: string
  name: string
  description: string | null
  enabled: boolean
  rollout_percentage: number
  enabled_for_users: string[]
  enabled_for_roles: string[]
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

/**
 * Check if a feature flag is enabled for a specific user
 *
 * @param flagName - Name of the feature flag
 * @param userId - Optional user ID (for percentage rollout)
 * @param userRole - Optional user role (subscriber, employee, admin)
 * @returns Promise<boolean> - Whether the feature is enabled
 */
export async function isFeatureEnabled(
  flagName: string,
  userId?: string,
  userRole?: string
): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('is_feature_enabled', {
      p_flag_name: flagName,
      p_user_id: userId || null,
      p_user_role: userRole || null
    })

    if (error) {
      console.error(`[FeatureFlags] Error checking ${flagName}:`, error)
      return false // Fail closed - default to disabled on error
    }

    return data as boolean
  } catch (error) {
    console.error(`[FeatureFlags] Exception checking ${flagName}:`, error)
    return false
  }
}

/**
 * Get all feature flags (admin only)
 */
export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('feature_flags')
    .select('*')
    .order('name')

  if (error) {
    console.error('[FeatureFlags] Error fetching flags:', error)
    return []
  }

  return data as FeatureFlag[]
}

/**
 * Update feature flag (admin only)
 */
export async function updateFeatureFlag(
  flagName: string,
  updates: Partial<Pick<FeatureFlag, 'enabled' | 'rollout_percentage' | 'description' | 'metadata'>>
): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('feature_flags')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('name', flagName)

  if (error) {
    console.error(`[FeatureFlags] Error updating ${flagName}:`, error)
    return false
  }

  return true
}

/**
 * Gradually increment rollout percentage (canary deployment)
 *
 * @example
 * // Roll out to 10% more users
 * await incrementRollout('new_feature', 10)
 */
export async function incrementRollout(
  flagName: string,
  increment: number = 10
): Promise<number | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('increment_rollout', {
    p_flag_name: flagName,
    p_increment: increment
  })

  if (error) {
    console.error(`[FeatureFlags] Error incrementing rollout for ${flagName}:`, error)
    return null
  }

  return data as number
}

/**
 * Enable feature for specific users (testing, early access)
 */
export async function enableForUsers(
  flagName: string,
  userIds: string[]
): Promise<boolean> {
  const supabase = await createClient()

  // Get current flag
  const { data: flag } = await supabase
    .from('feature_flags')
    .select('enabled_for_users')
    .eq('name', flagName)
    .single()

  if (!flag) return false

  // Merge with existing users (deduplicate)
  const existingUsers = flag.enabled_for_users || []
  const updatedUsers = Array.from(new Set([...existingUsers, ...userIds]))

  const { error } = await supabase
    .from('feature_flags')
    .update({ enabled_for_users: updatedUsers, updated_at: new Date().toISOString() })
    .eq('name', flagName)

  if (error) {
    console.error(`[FeatureFlags] Error enabling for users:`, error)
    return false
  }

  return true
}

/**
 * Disable feature for specific users
 */
export async function disableForUsers(
  flagName: string,
  userIds: string[]
): Promise<boolean> {
  const supabase = await createClient()

  const { data: flag } = await supabase
    .from('feature_flags')
    .select('enabled_for_users')
    .eq('name', flagName)
    .single()

  if (!flag) return false

  const updatedUsers = (flag.enabled_for_users || []).filter(
    (id: string) => !userIds.includes(id)
  )

  const { error } = await supabase
    .from('feature_flags')
    .update({ enabled_for_users: updatedUsers, updated_at: new Date().toISOString() })
    .eq('name', flagName)

  if (error) {
    console.error(`[FeatureFlags] Error disabling for users:`, error)
    return false
  }

  return true
}

// Convenience functions for common feature checks

export async function useSmartQueuePriority(): Promise<boolean> {
  return isFeatureEnabled('smart_queue_priority')
}

export async function useDynamicPricing(userId?: string): Promise<boolean> {
  return isFeatureEnabled('dynamic_pricing', userId)
}

export async function useAutoSaveForms(userId?: string): Promise<boolean> {
  return isFeatureEnabled('auto_save_forms', userId)
}
