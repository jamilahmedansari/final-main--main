export type EmailProvider = 'sendgrid' | 'resend' | 'smtp' | 'console'

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
  | 'letter-approved'
  | 'letter-rejected'
  | 'commission-earned'
  | 'subscription-confirmation'
  | 'subscription-renewal'
  | 'admin-alert'

export interface TemplateData {
  userName?: string
  letterTitle?: string
  letterLink?: string
  commissionAmount?: number
  subscriptionPlan?: string
  alertMessage?: string
  actionUrl?: string
  [key: string]: unknown
}
