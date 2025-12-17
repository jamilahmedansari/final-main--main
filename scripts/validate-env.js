#!/usr/bin/env node

const requiredEnvVars = {
  critical: [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', description: 'Supabase project URL' },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', description: 'Supabase anonymous key' },
    { name: 'OPENAI_API_KEY', description: 'OpenAI API key for letter generation' },
  ],
  production: [
    { name: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key' },
    { name: 'STRIPE_SECRET_KEY', description: 'Stripe secret key' },
    { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', description: 'Stripe publishable key' },
    { name: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe webhook secret' },
    { name: 'ADMIN_EMAIL', description: 'Admin email address' },
    { name: 'ADMIN_PORTAL_KEY', description: 'Admin portal access key' },
    { name: 'CRON_SECRET', description: 'Cron job authentication secret' },
  ],
  optional: [
    { name: 'NEXT_PUBLIC_APP_URL', description: 'Application URL', default: 'http://localhost:3000' },
    { name: 'KV_REST_API_URL', description: 'Upstash Redis URL for rate limiting' },
    { name: 'KV_REST_API_TOKEN', description: 'Upstash Redis token' },
    { name: 'SENDGRID_API_KEY', description: 'SendGrid API key for emails' },
    { name: 'BREVO_API_KEY', description: 'Brevo API key for emails' },
    { name: 'EMAIL_FROM', description: 'From email address' },
    { name: 'ENABLE_TEST_MODE', description: 'Enable test mode', default: 'false' },
  ],
}

function validateEnv() {
  console.log('\n=== Environment Validation ===\n')

  const isProduction = process.env.NODE_ENV === 'production'
  const testMode = process.env.ENABLE_TEST_MODE === 'true'

  let hasErrors = false
  let hasWarnings = false

  console.log('Critical Variables:')
  requiredEnvVars.critical.forEach(({ name, description }) => {
    const value = process.env[name]
    if (!value) {
      console.log(`  [ERROR] ${name}: Missing - ${description}`)
      hasErrors = true
    } else {
      const masked = value.substring(0, 8) + '...'
      console.log(`  [OK] ${name}: ${masked}`)
    }
  })

  if (isProduction && !testMode) {
    console.log('\nProduction Variables:')
    requiredEnvVars.production.forEach(({ name, description }) => {
      const value = process.env[name]
      if (!value) {
        console.log(`  [ERROR] ${name}: Missing - ${description}`)
        hasErrors = true
      } else {
        const masked = value.substring(0, 8) + '...'
        console.log(`  [OK] ${name}: ${masked}`)
      }
    })
  } else if (!isProduction) {
    console.log('\nProduction Variables (optional in development):')
    requiredEnvVars.production.forEach(({ name, description }) => {
      const value = process.env[name]
      if (!value) {
        console.log(`  [WARN] ${name}: Not set - ${description}`)
        hasWarnings = true
      } else {
        const masked = value.substring(0, 8) + '...'
        console.log(`  [OK] ${name}: ${masked}`)
      }
    })
  }

  console.log('\nOptional Variables:')
  requiredEnvVars.optional.forEach(({ name, description, default: defaultValue }) => {
    const value = process.env[name]
    if (!value) {
      if (defaultValue) {
        console.log(`  [INFO] ${name}: Using default "${defaultValue}" - ${description}`)
      } else {
        console.log(`  [WARN] ${name}: Not set - ${description}`)
        hasWarnings = true
      }
    } else {
      const masked = value.substring(0, 20) + (value.length > 20 ? '...' : '')
      console.log(`  [OK] ${name}: ${masked}`)
    }
  })

  console.log('\n=== Validation Summary ===')
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Test Mode: ${testMode ? 'Enabled' : 'Disabled'}`)

  if (hasErrors) {
    console.log('\n[FAILED] Missing critical environment variables')
    process.exit(1)
  } else if (hasWarnings) {
    console.log('\n[PASSED WITH WARNINGS] Some optional variables are missing')
    process.exit(0)
  } else {
    console.log('\n[PASSED] All environment variables are configured')
    process.exit(0)
  }
}

if (require.main === module) {
  require('dotenv').config({ path: '.env.local' })
  require('dotenv').config({ path: '.env' })
  validateEnv()
}

module.exports = { validateEnv, requiredEnvVars }
