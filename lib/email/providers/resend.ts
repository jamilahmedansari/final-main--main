/**
 * Resend Email Provider
 * Implements email sending using Resend API
 */

import type { EmailMessage, EmailResult, EmailProviderInterface } from '../types'

export class ResendProvider implements EmailProviderInterface {
  name = 'resend' as const
  private apiKey: string
  private baseUrl = 'https://api.resend.com'
  private fromEmail: string
  private fromName: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
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
        error: 'Resend is not configured',
        provider: this.name,
      }
    }

    const from = message.from || { email: this.fromEmail, name: this.fromName }
    const to = Array.isArray(message.to) ? message.to : [message.to]

    try {
      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from.name ? `${from.name} <${from.email}>` : from.email,
          to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          reply_to: message.replyTo,
          attachments: message.attachments?.map(attachment => ({
            filename: attachment.filename,
            content: attachment.content,
            content_type: attachment.type || 'application/octet-stream'
          }))
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${data.message || 'Unknown error'}`

        // Handle specific Resend error responses
        if (response.status === 401) {
          errorMessage = 'Invalid API key or authentication failed'
        } else if (response.status === 403) {
          errorMessage = 'Access forbidden - check your API key permissions'
        } else if (response.status === 422) {
          errorMessage = `Invalid email data: ${data.message || 'Unknown validation error'}`
        } else if (response.status === 429) {
          errorMessage = 'Rate limit exceeded - please try again later'
        }

        return {
          success: false,
          error: errorMessage,
          provider: this.name,
        }
      }

      return {
        success: true,
        messageId: data.id,
        provider: this.name,
      }

    } catch (error) {
      console.error('[Resend] Email sending failed:', error)

      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      if (error instanceof Error) {
        // Handle network errors
        if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Connection refused - check your network connection'
        } else if (error.message.includes('ETIMEDOUT')) {
          errorMessage = 'Request timeout - please try again'
        } else if (error.message.includes('ENOTFOUND')) {
          errorMessage = 'DNS lookup failed - check the API URL'
        }
      }

      return {
        success: false,
        error: errorMessage,
        provider: this.name,
      }
    }
  }

  /**
   * Test Resend API connection and authentication
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.status === 401) {
        return {
          success: false,
          error: 'Invalid API key'
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: API test failed`
        }
      }

      return { success: true }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }

  /**
   * Get Resend account information
   */
  async getAccountInfo(): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/account`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: Failed to get account info`
        }
      }

      const data = await response.json()

      return {
        success: true,
        data
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get account info'
      }
    }
  }

  /**
   * Get available domains in Resend account
   */
  async getDomains(): Promise<{ success: boolean; domains?: unknown[]; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: Failed to get domains`
        }
      }

      const data = await response.json()

      return {
        success: true,
        domains: data.data || []
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get domains'
      }
    }
  }
}

/**
 * Validate Resend API key format
 */
export function validateResendApiKey(apiKey: string): boolean {
  // Resend API keys start with "re_" followed by 32+ characters
  const resendKeyPattern = /^re_[a-zA-Z0-9]{32,}$/
  return resendKeyPattern.test(apiKey)
}

/**
 * Create Resend provider instance with validation
 */
export function createResendProvider(apiKey: string): ResendProvider {
  if (!apiKey) {
    throw new Error('Resend API key is required')
  }

  if (!validateResendApiKey(apiKey)) {
    throw new Error('Invalid Resend API key format. Expected: re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
  }

  return new ResendProvider(apiKey)
}