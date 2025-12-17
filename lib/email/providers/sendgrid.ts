import sgMail from '@sendgrid/mail'
import type { EmailMessage, EmailResult, EmailProviderInterface } from '../types'

export class SendGridProvider implements EmailProviderInterface {
  name = 'sendgrid' as const
  private apiKey: string | undefined
  private fromEmail: string
  private fromName: string

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY
    this.fromEmail = process.env.EMAIL_FROM || process.env.SENDGRID_FROM || ''
    this.fromName = process.env.EMAIL_FROM_NAME || 'Talk-To-My-Lawyer'

    if (this.apiKey) {
      sgMail.setApiKey(this.apiKey)
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.fromEmail
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'SendGrid is not configured',
        provider: this.name,
      }
    }

    try {
      const from = message.from || { email: this.fromEmail, name: this.fromName }

      const sgMessage: sgMail.MailDataRequired = {
        to: message.to,
        from: { email: from.email, name: from.name || this.fromName },
        subject: message.subject,
        text: message.text,
        html: message.html,
        replyTo: message.replyTo,
        cc: message.cc,
        bcc: message.bcc,
      }

      if (message.attachments?.length) {
        sgMessage.attachments = message.attachments.map(att => ({
          content: att.content,
          filename: att.filename,
          type: att.type,
          disposition: att.disposition || 'attachment',
        }))
      }

      const [response] = await sgMail.send(sgMessage)

      return {
        success: true,
        messageId: response.headers['x-message-id'],
        provider: this.name,
      }
    } catch (error: unknown) {
      const sgError = error as { response?: { body?: { errors?: Array<{ message?: string }> } }; message?: string }
      const errorMessage = sgError.response?.body?.errors
        ?.map(e => e.message)
        .filter(Boolean)
        .join('; ') || sgError.message || 'Unknown SendGrid error'

      console.error('[EmailService] SendGrid error:', errorMessage)

      return {
        success: false,
        error: errorMessage,
        provider: this.name,
      }
    }
  }
}
