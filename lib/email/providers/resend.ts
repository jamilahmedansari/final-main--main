/**
 * Resend Email Provider
 * Implements email sending using Resend API
 */

interface ResendEmailData {
  from: string
  to: string[]
  subject: string
  html?: string
  text?: string
  attachments?: Array<{
    filename: string
    content: Buffer | string
    contentType?: string
  }>
}

interface ResendResponse {
  id: string
  from: string
  to: string[]
  created_at: string
}

export class ResendProvider {
  private apiKey: string
  private baseUrl = 'https://api.resend.com'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async sendEmail(emailData: ResendEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailData.from,
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
          attachments: emailData.attachments?.map(attachment => ({
            filename: attachment.filename,
            content: Buffer.isBuffer(attachment.content)
              ? attachment.content.toString('base64')
              : attachment.content,
            content_type: attachment.contentType || 'application/octet-stream'
          }))
        }),
      })

      const data: ResendResponse = await response.json()

      if (!response.ok) {
        // Handle specific Resend error responses
        if (response.status === 401) {
          return {
            success: false,
            error: 'Invalid API key or authentication failed'
          }
        } else if (response.status === 403) {
          return {
            success: false,
            error: 'Access forbidden - check your API key permissions'
          }
        } else if (response.status === 422) {
          return {
            success: false,
            error: `Invalid email data: ${data.id || 'Unknown validation error'}`
          }
        } else if (response.status === 429) {
          return {
            success: false,
            error: 'Rate limit exceeded - please try again later'
          }
        } else {
          return {
            success: false,
            error: `HTTP ${response.status}: ${data.id || 'Unknown error'}`
          }
        }
      }

      return {
        success: true,
        messageId: data.id
      }

    } catch (error) {
      console.error('[Resend] Email sending failed:', error)

      if (error instanceof Error) {
        // Handle network errors
        if (error.message.includes('ECONNREFUSED')) {
          return {
            success: false,
            error: 'Connection refused - check your network connection'
          }
        } else if (error.message.includes('ETIMEDOUT')) {
          return {
            success: false,
            error: 'Request timeout - please try again'
          }
        } else if (error.message.includes('ENOTFOUND')) {
          return {
            success: false,
            error: 'DNS lookup failed - check the API URL'
          }
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
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
  async getAccountInfo(): Promise<{ success: boolean; data?: any; error?: string }> {
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
  async getDomains(): Promise<{ success: boolean; domains?: any[]; error?: string }> {
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