export type UserRole = 'subscriber' | 'employee' | 'admin'
export type LetterStatus =
  | 'draft'
  | 'generating'
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'failed'
export type SubscriptionStatus = 'active' | 'pending' | 'canceled' | 'past_due' | 'payment_failed' | 'expired'
export type CommissionStatus = 'pending' | 'paid'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  is_super_user: boolean
  phone: string | null
  company_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
  updated_at: string
}

export interface Letter {
  id: string
  user_id: string
  title: string
  letter_type: string
  status: LetterStatus
  recipient_name: string | null
  recipient_address: string | null
  subject: string | null
  content: string | null
  intake_data: Record<string, any>
  ai_draft_content: string | null
  final_content: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  review_notes: string | null
  rejection_reason: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  sent_at: string | null
  notes: string | null
}

export interface Subscription {
  id: string
  user_id: string
  plan: string
  plan_type: string
  status: SubscriptionStatus
  price: number
  discount: number
  coupon_code: string | null
  employee_id: string | null
  credits_remaining: number
  remaining_letters: number
  current_period_start: string
  current_period_end: string
  stripe_session_id: string | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
  expires_at: string | null
}

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

export interface Commission {
  id: string
  user_id: string
  employee_id: string
  subscription_id: string
  subscription_amount: number
  commission_rate: number
  commission_amount: number
  status: CommissionStatus
  created_at: string
  updated_at: string
  paid_at: string | null
}

export interface LetterAuditTrail {
  id: string
  letter_id: string
  performed_by: string
  action: string
  old_status: string | null
  new_status: string | null
  notes: string | null
  created_at: string
}

export interface SecurityAuditLog {
  id: string
  user_id: string | null
  action: string
  details: Record<string, any> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface SecurityConfig {
  id: string
  key: string
  value: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CouponUsage {
  id: string
  coupon_id: string | null
  user_id: string
  coupon_code: string
  employee_id: string | null
  subscription_id: string | null
  plan_type: string | null
  discount_percent: number
  amount_before: number
  amount_after: number
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & Pick<Profile, 'id' | 'email' | 'role'>
        Update: Partial<Profile>
      }
      letters: {
        Row: Letter
        Insert: Partial<Letter> & Pick<Letter, 'user_id' | 'title' | 'letter_type' | 'status'>
        Update: Partial<Letter>
      }
      subscriptions: {
        Row: Subscription
        Insert: Partial<Subscription> & Pick<Subscription, 'user_id' | 'plan' | 'status' | 'price'>
        Update: Partial<Subscription>
      }
      employee_coupons: {
        Row: EmployeeCoupon
        Insert: Partial<EmployeeCoupon> & Pick<EmployeeCoupon, 'employee_id' | 'code' | 'discount_percent'>
        Update: Partial<EmployeeCoupon>
      }
      commissions: {
        Row: Commission
        Insert: Partial<Commission> & Pick<Commission, 'employee_id' | 'subscription_id' | 'subscription_amount' | 'commission_rate' | 'commission_amount' | 'status'>
        Update: Partial<Commission>
      }
      letter_audit_trail: {
        Row: LetterAuditTrail
        Insert: Partial<LetterAuditTrail> & Pick<LetterAuditTrail, 'letter_id' | 'performed_by' | 'action'>
        Update: Partial<LetterAuditTrail>
      }
      security_audit_logs: {
        Row: SecurityAuditLog
        Insert: Partial<SecurityAuditLog> & Pick<SecurityAuditLog, 'action'>
        Update: Partial<SecurityAuditLog>
      }
      security_config: {
        Row: SecurityConfig
        Insert: Partial<SecurityConfig> & Pick<SecurityConfig, 'key'>
        Update: Partial<SecurityConfig>
      }
      coupon_usage: {
        Row: CouponUsage
        Insert: Partial<CouponUsage> & Pick<CouponUsage, 'user_id' | 'coupon_code' | 'discount_percent' | 'amount_before' | 'amount_after'>
        Update: Partial<CouponUsage>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      letter_status: LetterStatus
      subscription_status: SubscriptionStatus
      commission_status: CommissionStatus
    }
  }
}
