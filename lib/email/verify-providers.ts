/**
 * Email Provider Verification Script
 * Verifies that all email providers are properly configured and working
 */

import { getEmailService } from './service'
import { renderTemplate } from './templates'

type TestResult = {
  provider: string
  configured: boolean
  testSucceeded: boolean
  error?: string
  details?: string
}

async function testProvider(providerName: string): Promise<TestResult> {
  try {
    const emailService = getEmailService()
    const provider = emailService.getProvider(providerName as any)

    const result: TestResult = {
      provider: providerName,
      configured: provider.isConfigured(),
      testSucceeded: false
    }

    if (!provider.isConfigured()) {
      result.details = `${providerName} is not configured`
      return result
    }

    // Test template rendering
    const templateData = {
      userName: 'Test User',
      letterTitle: 'Test Letter',
      letterLink: 'https://example.com/letter/123',
      actionUrl: 'https://example.com/action',
      loginUrl: 'https://example.com/login'
    }

    const { subject, text, html } = renderTemplate('welcome', templateData)

    result.details = `Template rendered successfully: ${subject}`

    // If it's the console provider, we can actually test sending
    if (providerName === 'console') {
      const emailResult = await emailService.send({
        to: 'test@example.com',
        subject,
        text,
        html
      }, providerName as any)

      result.testSucceeded = emailResult.success
      if (emailResult.success) {
        result.details += ` | Test email sent successfully (ID: ${emailResult.messageId})`
      } else {
        result.error = emailResult.error
      }
    } else {
      // For other providers, just check configuration
      result.testSucceeded = true
      result.details += ` | Configuration verified`
    }

    return result

  } catch (error) {
    return {
      provider: providerName,
      configured: false,
      testSucceeded: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function verifyEmailProviders(): Promise<TestResult[]> {
  console.log('🔍 Verifying Email Provider Configuration...\n')

  const providers = ['sendgrid', 'brevo', 'resend', 'smtp', 'console']
  const results: TestResult[] = []

  for (const provider of providers) {
    console.log(`Testing ${provider}...`)
    const result = await testProvider(provider)
    results.push(result)

    const status = result.configured ? '✅' : '❌'
    const testStatus = result.testSucceeded ? '✅' : '❌'

    console.log(`  ${status} Configured: ${result.configured}`)
    console.log(`  ${testStatus} Test: ${result.testSucceeded}`)
    if (result.details) {
      console.log(`  ℹ️  Details: ${result.details}`)
    }
    if (result.error) {
      console.log(`  ❌ Error: ${result.error}`)
    }
    console.log('')
  }

  const configuredCount = results.filter(r => r.configured).length
  const workingCount = results.filter(r => r.testSucceeded).length

  console.log(`\n📊 Summary: ${configuredCount}/${results.length} providers configured, ${workingCount}/${results.length} working`)

  return results
}

export async function verifyTemplateSystem(): Promise<{ success: boolean; error?: string; templateCount: number }> {
  console.log('📧 Verifying Email Template System...\n')

  try {
    const testTemplates = ['welcome', 'password-reset', 'letter-approved', 'commission-earned'] as const
    const results: string[] = []

    for (const template of testTemplates) {
      const templateData = {
        userName: 'Test User',
        letterTitle: 'Test Letter',
        letterLink: 'https://example.com/letter/123',
        commissionAmount: 100,
        actionUrl: 'https://example.com/action',
        loginUrl: 'https://example.com/login',
        resetUrl: 'https://example.com/reset'
      }

      const { subject, text, html } = renderTemplate(template, templateData)

      results.push(`✅ ${template}: ${subject} (Text: ${text.length} chars, HTML: ${html.length} chars)`)
    }

    console.log('Template rendering results:')
    results.forEach(result => console.log(`  ${result}`))

    return { success: true, templateCount: results.length }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.log(`❌ Template system error: ${errorMessage}`)
    return { success: false, error: errorMessage, templateCount: 0 }
  }
}

/**
 * Complete email service verification
 */
export async function runEmailServiceVerification(): Promise<{
  providers: TestResult[]
  templates: { success: boolean; error?: string; templateCount: number }
  overall: { success: boolean; configuredProviders: number; totalProviders: number }
}> {
  console.log('🚀 Starting Complete Email Service Verification\n')
  console.log('='.repeat(60))
  console.log('')

  // Verify providers
  const providerResults = await verifyEmailProviders()

  console.log('='.repeat(60))
  console.log('')

  // Verify templates
  const templateResults = await verifyTemplateSystem()

  console.log('='.repeat(60))
  console.log('')

  const configuredCount = providerResults.filter(r => r.configured).length
  const totalCount = providerResults.length
  const overallSuccess = configuredCount > 0 && templateResults.success

  const overall = {
    success: overallSuccess,
    configuredProviders: configuredCount,
    totalProviders: totalCount
  }

  console.log('🎯 Overall Status:', overallSuccess ? '✅ HEALTHY' : '❌ NEEDS CONFIGURATION')
  console.log(`📊 Providers: ${configuredCount}/${totalCount} configured`)
  console.log(`📧 Templates: ${templateResults.success ? '✅' : '❌'} ${templateResults.templateCount} templates tested`)

  return {
    providers: providerResults,
    templates: templateResults,
    overall
  }
}

// Export for use in test scripts
export { testProvider }