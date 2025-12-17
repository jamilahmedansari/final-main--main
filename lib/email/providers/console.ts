import type { EmailMessage, EmailResult, EmailProviderInterface } from '../types'

export class ConsoleProvider implements EmailProviderInterface {
  name = 'console' as const

  isConfigured(): boolean {
    return true
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    const timestamp = new Date().toISOString()
    const messageId = `console-${Date.now()}-${Math.random().toString(36).substring(7)}`

    console.log('\n========== EMAIL (Console Provider) ==========')
    console.log(`Timestamp: ${timestamp}`)
    console.log(`Message ID: ${messageId}`)
    console.log(`To: ${Array.isArray(message.to) ? message.to.join(', ') : message.to}`)
    console.log(`From: ${message.from?.name || 'Talk-To-My-Lawyer'} <${message.from?.email || 'noreply@talk-to-my-lawyer.com'}>`)
    console.log(`Subject: ${message.subject}`)

    if (message.cc) {
      console.log(`CC: ${Array.isArray(message.cc) ? message.cc.join(', ') : message.cc}`)
    }

    if (message.bcc) {
      console.log(`BCC: ${Array.isArray(message.bcc) ? message.bcc.join(', ') : message.bcc}`)
    }

    if (message.replyTo) {
      console.log(`Reply-To: ${message.replyTo}`)
    }

    console.log('\n--- Text Content ---')
    console.log(message.text || '(no text content)')

    if (message.html) {
      console.log('\n--- HTML Content (truncated) ---')
      console.log(message.html.substring(0, 500) + (message.html.length > 500 ? '...' : ''))
    }

    if (message.attachments?.length) {
      console.log('\n--- Attachments ---')
      message.attachments.forEach((att, index) => {
        console.log(`  ${index + 1}. ${att.filename} (${att.type}, ${Math.round(att.content.length / 1024)}KB)`)
      })
    }

    console.log('================================================\n')

    return {
      success: true,
      messageId,
      provider: this.name,
    }
  }
}
