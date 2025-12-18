/**
 * Coupon Fraud Detection System
 * Implements comprehensive fraud detection for employee coupons
 */

import { createClient } from '@/lib/supabase/server'

interface FraudDetectionResult {
  isFraudulent: boolean
  riskScore: number // 0-100
  reasons: string[]
  action: 'allow' | 'flag' | 'block'
  metadata: Record<string, any>
}

interface UsagePattern {
  ipAddresses: string[]
  userAgentCount: number
  timeWindow: number // minutes
  requestCount: number
  uniqueUsers: number
  conversionRate: number
  avgTimeBetweenRequests: number
}

interface SuspiciousPattern {
  type: 'velocity' | 'distribution' | 'timing' | 'behavior' | 'technical'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  evidence: any[]
  threshold: number
  actual: number
}

export class CouponFraudDetector {
  private supabase: any
  private readonly thresholds = {
    // Velocity checks
    maxRequestsPerIPPerHour: 10,
    maxRequestsPerIPPerDay: 50,
    maxRequestsPerUserAgentPerHour: 20,

    // Distribution checks
    maxConversionsPerIPPerHour: 5,
    maxConversionsPerIPPerDay: 25,
    maxConversionsPerEmployeePerHour: 15,

    // Timing checks
    minTimeBetweenRequestsMs: 5000, // 5 seconds
    maxBurstRequestsPerMinute: 5,

    // Geographic checks
    maxCountriesPerIPPerHour: 1,

    // Technical checks
    maxUserAgentsPerIPPerHour: 3,

    // Risk scoring
    highRiskThreshold: 75,
    mediumRiskThreshold: 50,
    lowRiskThreshold: 25
  }

  constructor() {
    this.supabase = null // Will be initialized per request
  }

  /**
   * Main fraud detection entry point
   */
  async detectFraud(
    couponCode: string,
    ipAddress: string,
    userAgent: string,
    userId?: string
  ): Promise<FraudDetectionResult> {
    this.supabase = await createClient()

    const patterns = await this.analyzeUsagePatterns(couponCode, ipAddress, userAgent, userId)
    const suspiciousPatterns = this.identifySuspiciousPatterns(patterns)
    const riskScore = this.calculateRiskScore(suspiciousPatterns)
    const action = this.determineAction(riskScore)
    const reasons = this.generateReasons(suspiciousPatterns)

    // Log the detection for monitoring
    await this.logFraudDetection({
      couponCode,
      ipAddress,
      userAgent,
      userId,
      riskScore,
      action,
      reasons,
      patterns
    })

    return {
      isFraudulent: action === 'block',
      riskScore,
      reasons,
      action,
      metadata: {
        patterns,
        suspiciousPatterns,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Analyze usage patterns for a coupon
   */
  private async analyzeUsagePatterns(
    couponCode: string,
    ipAddress: string,
    userAgent: string,
    userId?: string
  ): Promise<UsagePattern> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get usage data for the last hour
    const { data: hourlyUsage } = await this.supabase
      .from('coupon_usage')
      .select('*')
      .eq('coupon_code', couponCode)
      .gte('created_at', oneHourAgo.toISOString())
      .order('created_at', { ascending: true })

    // Get usage data for the last day
    const { data: dailyUsage } = await this.supabase
      .from('coupon_usage')
      .select('*')
      .eq('coupon_code', couponCode)
      .gte('created_at', oneDayAgo.toISOString())

    // Get usage for this specific IP
    const { data: ipUsage } = await this.supabase
      .from('coupon_usage')
      .select('*')
      .eq('coupon_code', couponCode)
      .eq('ip_address', ipAddress) // Assuming we store IP
      .gte('created_at', oneHourAgo.toISOString())

    // Get unique user agents for this IP
    const ipUserAgents = new Set(
      ipUsage?.map(usage => usage.user_agent).filter(Boolean) || []
    )

    // Calculate timing patterns
    const requestTimes = hourlyUsage?.map(usage => new Date(usage.created_at).getTime()) || []
    const timeBetweenRequests = this.calculateTimeBetweenRequests(requestTimes)

    return {
      ipAddresses: [...new Set(hourlyUsage?.map(usage => usage.ip_address) || [])],
      userAgentCount: ipUserAgents.size,
      timeWindow: 60, // 1 hour
      requestCount: hourlyUsage?.length || 0,
      uniqueUsers: [...new Set(hourlyUsage?.map(usage => usage.user_id) || [])].length,
      conversionRate: this.calculateConversionRate(hourlyUsage || []),
      avgTimeBetweenRequests: timeBetweenRequests
    }
  }

  /**
   * Identify suspicious patterns based on usage analysis
   */
  private identifySuspiciousPatterns(patterns: UsagePattern): SuspiciousPattern[] {
    const suspicious: SuspiciousPattern[] = []

    // Velocity checks
    if (patterns.requestCount > this.thresholds.maxRequestsPerIPPerHour) {
      suspicious.push({
        type: 'velocity',
        severity: 'high',
        description: 'High request velocity detected',
        evidence: [`Request count: ${patterns.requestCount}/hour`],
        threshold: this.thresholds.maxRequestsPerIPPerHour,
        actual: patterns.requestCount
      })
    }

    if (patterns.avgTimeBetweenRequests < this.thresholds.minTimeBetweenRequestsMs) {
      suspicious.push({
        type: 'timing',
        severity: 'medium',
        description: 'Requests too close together (bot-like behavior)',
        evidence: [`Avg time: ${patterns.avgTimeBetweenRequests}ms`],
        threshold: this.thresholds.minTimeBetweenRequestsMs,
        actual: patterns.avgTimeBetweenRequests
      })
    }

    // Technical checks
    if (patterns.userAgentCount > this.thresholds.maxUserAgentsPerIPPerHour) {
      suspicious.push({
        type: 'technical',
        severity: 'high',
        description: 'Multiple user agents from same IP',
        evidence: [`User agents: ${patterns.userAgentCount}`],
        threshold: this.thresholds.maxUserAgentsPerIPPerHour,
        actual: patterns.userAgentCount
      })
    }

    // Distribution checks
    if (patterns.uniqueUsers > patterns.requestCount * 0.9) {
      suspicious.push({
        type: 'distribution',
        severity: 'medium',
        description: 'Suspicious user distribution',
        evidence: [`Unique users: ${patterns.uniqueUsers}/${patterns.requestCount}`],
        threshold: patterns.requestCount * 0.9,
        actual: patterns.uniqueUsers
      })
    }

    // Conversion rate anomalies
    if (patterns.conversionRate > 0.95) { // 95% conversion rate is suspicious
      suspicious.push({
        type: 'behavior',
        severity: 'high',
        description: 'Unusually high conversion rate',
        evidence: [`Conversion rate: ${(patterns.conversionRate * 100).toFixed(1)}%`],
        threshold: 0.95,
        actual: patterns.conversionRate
      })
    }

    return suspicious
  }

  /**
   * Calculate risk score based on suspicious patterns
   */
  private calculateRiskScore(patterns: SuspiciousPattern[]): number {
    let riskScore = 0

    patterns.forEach(pattern => {
      const severityMultiplier = {
        low: 10,
        medium: 25,
        high: 50,
        critical: 100
      }[pattern.severity]

      const excessRatio = Math.min(pattern.actual / pattern.threshold, 3) // Cap at 3x threshold
      const patternScore = severityMultiplier * excessRatio

      riskScore = Math.min(riskScore + patternScore, 100) // Cap at 100
    })

    return Math.round(riskScore)
  }

  /**
   * Determine action based on risk score
   */
  private determineAction(riskScore: number): 'allow' | 'flag' | 'block' {
    if (riskScore >= this.thresholds.highRiskThreshold) {
      return 'block'
    } else if (riskScore >= this.thresholds.mediumRiskThreshold) {
      return 'flag'
    } else {
      return 'allow'
    }
  }

  /**
   * Generate human-readable reasons for fraud detection
   */
  private generateReasons(patterns: SuspiciousPattern[]): string[] {
    return patterns.map(pattern => {
      const severityEmoji = {
        low: '⚠️',
        medium: '🔶',
        high: '🔴',
        critical: '🚨'
      }[pattern.severity]

      return `${severityEmoji} ${pattern.description} (${pattern.actual} vs threshold ${pattern.threshold})`
    })
  }

  /**
   * Calculate time between consecutive requests
   */
  private calculateTimeBetweenRequests(timestamps: number[]): number {
    if (timestamps.length < 2) return 0

    const intervals = []
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1])
    }

    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
  }

  /**
   * Calculate conversion rate from usage data
   */
  private calculateConversionRate(usage: any[]): number {
    if (usage.length === 0) return 0

    const conversions = usage.filter(u => u.subscription_id).length
    return conversions / usage.length
  }

  /**
   * Log fraud detection results for monitoring
   */
  private async logFraudDetection(data: {
    couponCode: string
    ipAddress: string
    userAgent: string
    userId?: string
    riskScore: number
    action: 'allow' | 'flag' | 'block'
    reasons: string[]
    patterns: UsagePattern
  }): Promise<void> {
    try {
      await this.supabase
        .from('fraud_detection_logs')
        .insert({
          coupon_code: data.couponCode,
          ip_address: data.ipAddress,
          user_agent: data.userAgent,
          user_id: data.userId,
          risk_score: data.riskScore,
          action: data.action,
          reasons: data.reasons,
          patterns: data.patterns,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('[FraudDetection] Failed to log detection:', error)
      // Don't throw - logging failure shouldn't block the request
    }
  }

  /**
   * Check if IP is from a known datacenter or VPN
   */
  private async isDatacenterIP(ipAddress: string): Promise<boolean> {
    // This would integrate with a service like MaxMind or IPinfo
    // For now, return false as a placeholder
    return false
  }

  /**
   * Check if user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /go-http/i,
      /node/i
    ]

    return suspiciousPatterns.some(pattern => pattern.test(userAgent))
  }
}

// Singleton instance
export const couponFraudDetector = new CouponFraudDetector()

/**
 * Middleware function for coupon fraud detection
 */
export async function detectCouponFraud(
  couponCode: string,
  request: Request,
  userId?: string
): Promise<FraudDetectionResult> {
  const ipAddress = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'

  return await couponFraudDetector.detectFraud(couponCode, ipAddress, userAgent, userId)
}

/**
 * Get client IP address from request
 */
function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')

  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  if (cfConnectingIP) {
    return cfConnectingIP
  }

  return 'unknown'
}

/**
 * Enhance coupon validation with fraud detection
 */
export async function validateCouponWithFraudDetection(
  couponCode: string,
  request: Request,
  userId?: string
): Promise<{ isValid: boolean; fraudResult?: FraudDetectionResult; error?: string }> {
  try {
    // First, perform basic coupon validation
    const supabase = await createClient()
    const { data: coupon, error: couponError } = await supabase
      .from('employee_coupons')
      .select('*')
      .eq('code', couponCode)
      .eq('is_active', true)
      .single()

    if (couponError || !coupon) {
      return { isValid: false, error: 'Invalid or inactive coupon code' }
    }

    // Perform fraud detection
    const fraudResult = await detectCouponFraud(couponCode, request, userId)

    // Block fraudulent requests
    if (fraudResult.action === 'block') {
      // Deactivate coupon if high fraud risk
      if (fraudResult.riskScore >= 90) {
        await supabase
          .from('employee_coupons')
          .update({ is_active: false })
          .eq('code', couponCode)
      }

      return {
        isValid: false,
        fraudResult,
        error: 'Coupon validation failed due to suspicious activity'
      }
    }

    // Flag suspicious but allow through
    if (fraudResult.action === 'flag') {
      console.warn('[CouponFraud] Suspicious activity detected:', {
        couponCode,
        riskScore: fraudResult.riskScore,
        reasons: fraudResult.reasons
      })
    }

    return { isValid: true, fraudResult }
  } catch (error) {
    console.error('[CouponFraud] Validation error:', error)
    return { isValid: false, error: 'Coupon validation failed' }
  }
}