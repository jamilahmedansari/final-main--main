export type EmailProvider = 'sendgrid' | 'brevo' | 'resend' | 'smtp' | 'console'

export interface EmailAttachment {
  content: string
  filename: string
  type: string
  disposition?: 'attachment' | 'inline'
}

export interface EmailMessage {
  to: string | string[]
  from?: {
    email: string
    name?: string
  }
  subject: string
  text?: string
  html?: string
  attachments?: EmailAttachment[]
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
  provider: EmailProvider
}

export interface EmailProviderInterface {
  name: EmailProvider
  send(message: EmailMessage): Promise<EmailResult>
  isConfigured(): boolean
}

export interface EmailConfig {
  provider: EmailProvider
  from: {
    email: string
    name: string
  }
  replyTo?: string
}

export type EmailTemplate =
  | 'welcome'
  | 'password-reset'
  | 'password-reset-confirmation'
  | 'letter-approved'
  | 'letter-rejected'
  | 'letter-generated'
  | 'letter-under-review'
  | 'commission-earned'
  | 'commission-paid'
  | 'subscription-confirmation'
  | 'subscription-renewal'
  | 'subscription-cancelled'
  | 'payment-failed'
  | 'account-suspended'
  | 'free-trial-ending'
  | 'onboarding-complete'
  | 'admin-alert'
  | 'security-alert'
  | 'system-maintenance'

export interface TemplateData {
  userName?: string
  letterTitle?: string
  letterLink?: string
  commissionAmount?: number
  subscriptionPlan?: string
  alertMessage?: string
  actionUrl?: string
  loginUrl?: string
  resetUrl?: string
  rejectionReason?: string
  reviewNotes?: string
  pendingReviews?: number
  daysUntilExpiry?: number
  amountDue?: number
  nextBillingDate?: string
  suspensionReason?: string
  trialDaysRemaining?: number
  completedSteps?: number
  totalSteps?: number
  [key: string]: unknown
}
