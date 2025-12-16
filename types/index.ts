export type {
  UserRole,
  LetterStatus,
  SubscriptionStatus,
  CommissionStatus,
  Profile,
  Letter,
  Subscription,
  EmployeeCoupon,
  Commission,
  CouponUsage,
  LetterAuditTrail,
  SecurityAuditLog,
  SecurityConfig,
  Database,
} from '@/lib/database.types'

export interface LettersSearchParams {
  status?: string
  search?: string
  page?: string
  limit?: string
}

export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

export interface Plan {
  id: string
  name: string
  price: number
  credits: number
  description: string
  features: string[]
  popular?: boolean
}

export interface LetterWithProfile {
  id: string
  user_id: string
  title: string
  letter_type: string
  status: import('@/lib/database.types').LetterStatus
  ai_draft_content?: string | null
  approved_content?: string | null
  intake_data?: Record<string, unknown>
  rejection_reason?: string | null
  created_at: string
  updated_at: string
  profiles?: {
    email: string
    full_name?: string | null
  } | null
}
