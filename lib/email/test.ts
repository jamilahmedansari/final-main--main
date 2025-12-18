import { getEmailService } from './service'
import type { EmailMessage } from './types'

/**
 * Test email service integration
 * This file can be used to verify email providers are working correctly
 */

export async function testEmailService() {
  console.log('🧪 Testing Email Service Integration...\n')

  const emailService = getEmailService()

  // Test 1: Default provider configuration
  console.log('1. Checking email service configuration...')
  console.log('✅ Default provider:', emailService.getProvider().name)
  console.log('✅ Is configured:', emailService.isConfigured())
  console.log('✅ Default from address:', emailService.getDefaultFrom())

  // Test 2: Available providers
  console.log('\n2. Available providers:')
  const providers = ['sendgrid', 'brevo', 'resend', 'smtp', 'console'] as const

  for (const providerName of providers) {
    try {
      const provider = emailService.getProvider(providerName)
      console.log(`✅ ${providerName}: ${provider.isConfigured() ? 'Configured' : 'Not configured'}`)
    } catch (error) {
      console.log(`❌ ${providerName}: Not available - ${error.message}`)
    }
  }

  // Test 3: Template rendering
  console.log('\n3. Testing email template rendering...')
  try {
    const { renderTemplate } = await import('./templates')

    // Test a template
    const templateData = {
      userName: 'Test User',
      letterTitle: 'Test Letter',
      letterLink: 'https://example.com/letter/123',
      actionUrl: 'https://example.com/action',
      loginUrl: 'https://example.com/login'
    }

    const { subject, text, html } = renderTemplate('welcome', templateData)
    console.log('✅ Template rendering works')
    console.log(`   Subject: ${subject}`)
    console.log(`   Text length: ${text.length} characters`)
    console.log(`   HTML length: ${html.length} characters`)
  } catch (error) {
    console.log('❌ Template rendering failed:', error.message)
  }

  // Test 4: Basic email sending (console provider)
  console.log('\n4. Testing email sending (console provider)...')
  try {
    const testMessage: EmailMessage = {
      to: 'test@example.com',
      subject: 'Test Email from Talk-To-My-Lawyer',
      text: 'This is a test email to verify the email service is working.',
      html: '<p>This is a <strong>test email</strong> to verify the email service is working.</p>'
    }

    const result = await emailService.send(testMessage, 'console')
    if (result.success) {
      console.log('✅ Console email sending works')
      console.log(`   Message ID: ${result.messageId}`)
    } else {
      console.log('❌ Console email sending failed:', result.error)
    }
  } catch (error) {
    console.log('❌ Email sending test failed:', error.message)
  }

  // Test 5: Template email sending
  console.log('\n5. Testing template email sending...')
  try {
    const result = await emailService.sendTemplate(
      'welcome',
      'test@example.com',
      {
        userName: 'Test User',
        letterTitle: 'Test Letter',
        letterLink: 'https://example.com/letter/123',
        actionUrl: 'https://example.com/dashboard',
        loginUrl: 'https://example.com/login'
      },
      'console'
    )

    if (result.success) {
      console.log('✅ Template email sending works')
      console.log(`   Provider: ${result.provider}`)
      console.log(`   Message ID: ${result.messageId}`)
    } else {
      console.log('❌ Template email sending failed:', result.error)
    }
  } catch (error) {
    console.log('❌ Template email sending test failed:', error.message)
  }

  console.log('\n🎉 Email service integration test completed!')
}

/**
 * Test specific provider configuration
 */
export async function testProviderConfiguration() {
  console.log('🔧 Testing Provider Configuration...\n')

  // Test Brevo API key
  if (process.env.BREVO_API_KEY) {
    console.log('✅ Brevo API key is configured')
    console.log(`   Key format: ${process.env.BREVO_API_KEY.startsWith('xkeysib-') ? 'Valid' : 'Invalid'}`)
  } else {
    console.log('❌ Brevo API key is not configured')
  }

  // Test SendGrid API key
  if (process.env.SENDGRID_API_KEY) {
    console.log('✅ SendGrid API key is configured')
    console.log(`   Key format: ${process.env.SENDGRID_API_KEY.startsWith('SG.') ? 'Valid' : 'Invalid'}`)
  } else {
    console.log('❌ SendGrid API key is not configured')
  }

  // Test Resend API key
  if (process.env.RESEND_API_KEY) {
    console.log('✅ Resend API key is configured')
    console.log(`   Key format: ${process.env.RESEND_API_KEY.startsWith('re_') ? 'Valid' : 'Invalid'}`)
  } else {
    console.log('❌ Resend API key is not configured')
  }

  // Test SMTP configuration
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('✅ SMTP configuration is present')
    console.log(`   Host: ${process.env.SMTP_HOST}`)
    console.log(`   Port: ${process.env.SMTP_PORT || '587'}`)
    console.log(`   User: ${process.env.SMTP_USER}`)
  } else {
    console.log('❌ SMTP configuration is incomplete')
  }

  // Test general email configuration
  console.log('\n📧 General Email Configuration:')
  console.log(`   Provider: ${process.env.EMAIL_PROVIDER || 'auto-detect'}`)
  console.log(`   From email: ${process.env.EMAIL_FROM || 'not configured'}`)
  console.log(`   From name: ${process.env.EMAIL_FROM_NAME || 'not configured'}`)
}

/**
 * Run all email service tests
 */
export async function runEmailServiceTests() {
  await testProviderConfiguration()
  console.log('\n' + '='.repeat(60) + '\n')
  await testEmailService()
}

// Export for use in API routes or scripts
export { testEmailService as testEmailServiceIntegration }