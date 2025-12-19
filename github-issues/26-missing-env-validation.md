# Missing Environment Variable Validation at Startup

## Priority
⚠️ **MEDIUM**

## Labels
`enhancement`, `medium-priority`, `developer-experience`, `configuration`

## Description
There's no validation that required environment variables are set before the application starts. This causes runtime failures with cryptic errors instead of clear startup errors.

## Current Behavior
```bash
# Start app with missing env vars
pnpm dev

# App starts successfully ✅
# ... later during usage ...
# Error: Supabase client cannot be created without a project URL
# Error: stripe is not defined
# ❌ Fails at runtime with unclear message
```

## Problems

### 1. Poor Developer Experience
New developers don't know what env vars are required:
```bash
git clone repo
pnpm install
pnpm dev
# Everything seems to work...
# Click login → crash
# Try to checkout → crash
```

### 2. Production Deployment Failures
Deploy to production, realize env var missing:
```bash
# Build succeeds
pnpm build  ✅

# Deploy succeeds
vercel deploy  ✅

# First user hits payment → crash
Error: STRIPE_SECRET_KEY is not defined  ❌
```

### 3. Hard to Debug
Errors happen deep in code, not obvious what's missing:
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
// TypeError: Cannot read property 'checkout' of undefined
// Not clear that STRIPE_SECRET_KEY is missing
```

### 4. Silent Failures
Some features fail silently:
```typescript
const adminEmail = process.env.ADMIN_EMAIL
if (adminEmail) {
  await sendNotification(adminEmail)
}
// If ADMIN_EMAIL not set, notification silently doesn't send
```

## Recommended Fix

### Option 1: Validation Script (Recommended)

**File to create**: `lib/config/validate-env.ts`

```typescript
/**
 * Validates that all required environment variables are set.
 * Call this at app startup to fail fast with clear error messages.
 */

interface EnvConfig {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: string
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string

  // Stripe
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string

  // OpenAI
  OPENAI_API_KEY: string

  // Admin Auth
  ADMIN_USERNAME: string
  ADMIN_PASSWORD: string

  // Optional
  ADMIN_EMAIL?: string
  NEXT_PUBLIC_APP_URL?: string
  LOG_LEVEL?: string
  TEST_MODE?: string
}

const requiredEnvVars: (keyof EnvConfig)[] = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'OPENAI_API_KEY',
  'ADMIN_USERNAME',
  'ADMIN_PASSWORD',
]

export function validateEnv(): EnvConfig {
  const missing: string[] = []
  const invalid: string[] = []

  // Check required vars
  for (const varName of requiredEnvVars) {
    const value = process.env[varName]

    if (!value) {
      missing.push(varName)
      continue
    }

    // Additional validation
    if (varName.includes('URL') && !value.startsWith('http')) {
      invalid.push(`${varName} must be a valid URL (got: ${value})`)
    }

    if (varName.includes('KEY') && value.length < 10) {
      invalid.push(`${varName} appears to be invalid (too short)`)
    }
  }

  // Report errors
  if (missing.length > 0 || invalid.length > 0) {
    const errorMessage = [
      '❌ Environment validation failed!\n',
      missing.length > 0 && `Missing required environment variables:\n${missing.map(v => `  - ${v}`).join('\n')}`,
      invalid.length > 0 && `\nInvalid environment variables:\n${invalid.map(v => `  - ${v}`).join('\n')}`,
      '\n\nPlease check your .env.local file or deployment settings.',
      'See .env.example for required variables.\n'
    ].filter(Boolean).join('\n')

    console.error(errorMessage)

    // Fail hard in development
    if (process.env.NODE_ENV === 'development') {
      throw new Error('Environment validation failed - see above')
    }

    // Log but continue in production (graceful degradation)
    // Or: process.exit(1) to fail hard
  }

  // Warnings for optional but recommended
  const warnings: string[] = []

  if (!process.env.ADMIN_EMAIL) {
    warnings.push('ADMIN_EMAIL not set - admin notifications will not work')
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    warnings.push('NEXT_PUBLIC_APP_URL not set - using dynamic URL detection')
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Environment warnings:\n' + warnings.map(w => `  - ${w}`).join('\n'))
  }

  return process.env as EnvConfig
}

// Type-safe access to env vars
export const env = validateEnv()
```

### Usage in App
```typescript
// app/layout.tsx or instrumentation.ts
import { validateEnv } from '@/lib/config/validate-env'

// Validate on startup
validateEnv()

export default function RootLayout() {
  // ...
}
```

### Option 2: Use Zod (Type-Safe)
```typescript
import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  ADMIN_EMAIL: z.string().email().optional(),
  TEST_MODE: z.enum(['true', 'false']).optional(),
})

export const env = envSchema.parse(process.env)
```

### Option 3: t3-env (Next.js Optimized)
```bash
pnpm add @t3-oss/env-nextjs zod
```

```typescript
// env.mjs
import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
})
```

## .env.example File
Create comprehensive example:

```env
# .env.example
# Copy to .env.local and fill in your values

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password

# Optional
ADMIN_EMAIL=admin@talk-to-my-lawyer.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
LOG_LEVEL=debug
TEST_MODE=false
```

## Package.json Scripts
```json
{
  "scripts": {
    "validate-env": "tsx lib/config/validate-env.ts",
    "predev": "pnpm validate-env",
    "prebuild": "pnpm validate-env"
  }
}
```

## CI/CD Integration
```yaml
# .github/workflows/ci.yml
- name: Validate environment
  run: pnpm validate-env
  env:
    # Set from GitHub secrets
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
    # ... etc
```

## Acceptance Criteria
- [ ] Environment validation script created
- [ ] All required vars documented
- [ ] Validation runs before dev/build
- [ ] Clear error messages for missing vars
- [ ] Type-safe access to env vars
- [ ] `.env.example` created with all vars
- [ ] README updated with setup instructions
- [ ] Validation integrated into CI/CD
- [ ] Warnings for optional recommended vars
