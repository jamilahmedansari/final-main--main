// Letter-related types
export interface Letter {
  id: string
  user_id: string
  title: string
  letter_type: string
  status: LetterStatus
  ai_draft_content?: string
  approved_content?: string
  intake_data?: Record<string, unknown>
  rejection_reason?: string
  created_at: string
  updated_at: string
  profiles?: {
    email: string
    full_name?: string
  }
}

export type LetterStatus = 
  | 'draft'
  | 'generating'
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'failed'

// Search params for letters page
export interface LettersSearchParams {
  status?: string
  search?: string
  page?: string
  limit?: string
}

// Profile-related types
export interface Profile {
  id: string
  email: string
  role: 'subscriber' | 'employee' | 'admin'
  full_name?: string
  phone?: string
  company_name?: string
  avatar_url?: string
  is_super_user?: boolean
  created_at: string
  updated_at: string
}

// Subscription-related types
export interface Subscription {
  id: string
  user_id: string
  plan: string
  plan_type: string
  status: SubscriptionStatus
  price: number
  discount?: number
  coupon_code?: string
  credits_remaining: number
  remaining_letters: number
  current_period_start: string
  current_period_end: string
  stripe_session_id?: string
  stripe_customer_id?: string
  created_at: string
  updated_at: string
}

export type SubscriptionStatus = 
  | 'active'
  | 'pending'
  | 'canceled'
  | 'payment_failed'
  | 'expired'

// Employee coupon types
export interface EmployeeCoupon {
  id: string
  employee_id: string
  code: string
  discount_percent: number
  is_active: boolean
  usage_count: number
  created_at: string
  updated_at: string
}

// Commission types
export interface Commission {
  id: string
  employee_id: string
  subscription_id: string
  subscription_amount: number
  commission_rate: number
  commission_amount: number
  status: 'pending' | 'paid' | 'cancelled'
  created_at: string
  updated_at: string
}

// Coupon usage types
export interface CouponUsage {
  id: string
  user_id: string
  coupon_code: string
  employee_id?: string
  subscription_id?: string
  plan_type?: string
  discount_percent: number
  amount_before: number
  amount_after: number
  created_at: string
}

// API Response types
export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

// Plan types
export interface Plan {
  id: string
  name: string
  price: number
  credits: number
  description: string
  features: string[]
  popular?: boolean
}
