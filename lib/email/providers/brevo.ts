import type { EmailMessage, EmailResult, EmailProviderInterface } from '../types'

type BrevoRecipient = { email: string; name?: string }

type BrevoSendEmailPayload = {
  sender: BrevoRecipient
  to: BrevoRecipient[]
  cc?: BrevoRecipient[]
  bcc?: BrevoRecipient[]
  replyTo?: BrevoRecipient
  subject: string
  textContent?: string
  htmlContent?: string
  attachment?: Array<{ name: string; content: string }>
}

type BrevoSendEmailResponse = {
  messageId?: string | string[]
}

export class BrevoProvider implements EmailProviderInterface {
  name = 'brevo' as const

  private apiKey: string | undefined
  private fromEmail: string
  private fromName: string

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY
    this.fromEmail = process.env.EMAIL_FROM || ''
    this.fromName = process.env.EMAIL_FROM_NAME || 'Talk-To-My-Lawyer'
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.fromEmail
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Brevo is not configured',
        provider: this.name,
      }
    }

    const from = message.from || { email: this.fromEmail, name: this.fromName }

    const to = (Array.isArray(message.to) ? message.to : [message.to]).map((email) => ({ email }))
    const cc = message.cc ? (Array.isArray(message.cc) ? message.cc : [message.cc]).map((email) => ({ email })) : undefined
    const bcc = message.bcc ? (Array.isArray(message.bcc) ? message.bcc : [message.bcc]).map((email) => ({ email })) : undefined

    const payload: BrevoSendEmailPayload = {
      sender: {
        email: from.email,
        name: from.name || this.fromName,
      },
      to,
      subject: message.subject,
    }

    if (message.text) payload.textContent = message.text
    if (message.html) payload.htmlContent = message.html

    if (cc?.length) payload.cc = cc
    if (bcc?.length) payload.bcc = bcc
    if (message.replyTo) payload.replyTo = { email: message.replyTo }

    if (message.attachments?.length) {
      payload.attachment = message.attachments.map((att) => ({
        name: att.filename,
        content: att.content,
      }))
    }

    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.apiKey!,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const errorMessage = text ? `Brevo error: ${text}` : `Brevo error: HTTP ${res.status}`
        console.error('[EmailService] Brevo error:', `HTTP ${res.status}`)
        return {
          success: false,
          error: errorMessage,
          provider: this.name,
        }
      }

      const data = (await res.json().catch(() => ({}))) as BrevoSendEmailResponse
      const messageId = Array.isArray(data.messageId) ? data.messageId[0] : data.messageId

      return {
        success: true,
        ...(messageId ? { messageId } : {}),
        provider: this.name,
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Brevo error'
      console.error('[EmailService] Brevo error:', errorMessage)
      return {
        success: false,
        error: errorMessage,
        provider: this.name,
      }
    }
  }
}
