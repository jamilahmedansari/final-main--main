import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { EmailMessage } from './types'
import { getEmailService } from './service'

// Database row type matching the actual schema (snake_case)
interface EmailQueueRow {
  id: string
  to: string
  subject: string
  html: string | null
  text: string | null
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  max_retries: number
  next_retry_at: string | null
  error: string | null
  created_at: string
  sent_at: string | null
  updated_at: string
}

export interface EmailQueueItem {
  id?: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  maxRetries: number
  nextRetryAt?: string
  error?: string
  createdAt?: string
  sentAt?: string
}

/**
 * Email Queue Service
 * Provides reliable email delivery with retry logic and persistence
 */
export class EmailQueue {
  private supabase: SupabaseClient
  private tableName = 'email_queue' as const

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }

  /**
   * Add an email to the queue
   */
  async enqueue(message: EmailMessage, maxRetries: number = 3): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .insert({
          to: Array.isArray(message.to) ? message.to.join(',') : message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          status: 'pending',
          attempts: 0,
          maxRetries,
          nextRetryAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        })
        .select('id')
        .single()

      if (error) {
        console.error('[EmailQueue] Failed to enqueue email:', error)
        throw error
      }

      console.log('[EmailQueue] Email queued:', { id: data?.id, to: message.to })
      return data?.id || ''
    } catch (error) {
      console.error('[EmailQueue] Error enqueueing email:', error)
      throw error
    }
  }

  /**
   * Process pending emails in the queue
   */
  async processPending(): Promise<void> {
    try {
      const { data: items, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('status', 'pending')
        .lte('nextRetryAt', new Date().toISOString())
        .limit(10) // Process 10 at a time

      if (error) {
        console.error('[EmailQueue] Failed to fetch pending emails:', error)
        return
      }

      if (!items || items.length === 0) {
        console.log('[EmailQueue] No pending emails to process')
        return
      }

      console.log(`[EmailQueue] Processing ${items.length} pending emails`)

      for (const item of items) {
        await this.processItem(item)
      }
    } catch (error) {
      console.error('[EmailQueue] Error processing queue:', error)
    }
  }

  /**
   * Process a single queue item
   */
  private async processItem(item: EmailQueueItem): Promise<void> {
    try {
      const emailService = getEmailService()
      const message: EmailMessage = {
        to: item.to,
        subject: item.subject,
        html: item.html,
        text: item.text
      }

      const result = await emailService.send(message)

      if (result.success) {
        // Mark as sent
        await this.supabase
          .from(this.tableName)
          .update({
            status: 'sent',
            sentAt: new Date().toISOString()
          })
          .eq('id', item.id)

        console.log('[EmailQueue] Email sent successfully:', { id: item.id })
      } else {
        // Handle retry
        await this.handleRetry(item, result.error)
      }
    } catch (error) {
      console.error('[EmailQueue] Error processing item:', { id: item.id, error })
      await this.handleRetry(item, String(error))
    }
  }

  /**
   * Handle retry logic for failed emails
   */
  private async handleRetry(item: EmailQueueItem, error?: string): Promise<void> {
    const newAttempts = (item.attempts || 0) + 1
    const maxRetries = item.maxRetries || 3

    if (newAttempts >= maxRetries) {
      // Mark as failed
      await this.supabase
        .from(this.tableName)
        .update({
          status: 'failed',
          attempts: newAttempts,
          error: error || 'Max retries exceeded'
        })
        .eq('id', item.id)

      console.error('[EmailQueue] Email failed after max retries:', {
        id: item.id,
        attempts: newAttempts,
        error
      })
    } else {
      // Schedule next retry with exponential backoff
      const backoffMs = Math.pow(2, newAttempts - 1) * 5 * 60 * 1000 // 5min, 10min, 20min
      const nextRetryAt = new Date(Date.now() + backoffMs).toISOString()

      await this.supabase
        .from(this.tableName)
        .update({
          attempts: newAttempts,
          nextRetryAt,
          error: error || 'Retry scheduled'
        })
        .eq('id', item.id)

      console.log('[EmailQueue] Email retry scheduled:', {
        id: item.id,
        attempt: newAttempts,
        nextRetryAt
      })
    }
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number
    sent: number
    failed: number
    total: number
  }> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('status')

      if (error) {
        console.error('[EmailQueue] Failed to fetch stats:', error)
        return { pending: 0, sent: 0, failed: 0, total: 0 }
      }

      const stats = {
        pending: data?.filter((item) => item.status === 'pending').length || 0,
        sent: data?.filter((item) => item.status === 'sent').length || 0,
        failed: data?.filter((item) => item.status === 'failed').length || 0,
        total: data?.length || 0
      }

      return stats
    } catch (error) {
      console.error('[EmailQueue] Error getting stats:', error)
      return { pending: 0, sent: 0, failed: 0, total: 0 }
    }
  }
}

let queueInstance: EmailQueue | null = null

export function getEmailQueue(): EmailQueue {
  if (!queueInstance) {
    queueInstance = new EmailQueue()
  }
  return queueInstance
}

/**
 * Process email queue and return results
 * Used by cron endpoint
 */
export async function processEmailQueue(): Promise<{
  processed: number
  failed: number
  remaining: number
}> {
  const queue = getEmailQueue()
  
  // Get initial stats
  const beforeStats = await queue.getStats()
  
  // Process pending emails
  await queue.processPending()
  
  // Get updated stats
  const afterStats = await queue.getStats()
  
  return {
    processed: beforeStats.pending - afterStats.pending,
    failed: afterStats.failed - beforeStats.failed,
    remaining: afterStats.pending
  }
}
