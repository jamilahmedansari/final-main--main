# Hardcoded APP_URL Instead of Dynamic Detection

## Priority
🔧 **LOW**

## Labels
`bug`, `low-priority`, `configuration`, `deployment`

## Description
The `APP_URL` defaults to a hardcoded production domain `'https://www.talk-to-my-lawyer.com'` instead of dynamically detecting the hostname. This breaks functionality in development, staging, and preview environments.

## Location
- **File**: `app/layout.tsx`
- **Line**: 4

## Current Code
```typescript
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.talk-to-my-lawyer.com'
```

## Problems

### 1. Development Issues
Local development at `localhost:3000` generates links to production:
```typescript
// Email contains wrong link
const resetLink = `${APP_URL}/reset-password?token=${token}`
// Points to https://www.talk-to-my-lawyer.com/reset-password
// Instead of http://localhost:3000/reset-password
```

### 2. Preview Deployments
Vercel/Netlify preview URLs don't work:
```
Preview URL: https://talk-to-my-lawyer-git-feat-pr-123.vercel.app
Link generated: https://www.talk-to-my-lawyer.com  ❌
```

### 3. Staging Environment
Staging environment generates production links:
```
Staging: https://staging.talk-to-my-lawyer.com
Link generated: https://www.talk-to-my-lawyer.com  ❌
```

### 4. CORS Issues
API calls might fail due to wrong origin

## Impact
- Broken password reset emails in dev/staging
- OAuth redirects fail
- Webhook URLs point to wrong environment
- Email links don't work
- Unable to test full flows locally

## Recommended Fix

### Option 1: Dynamic Detection (Server-Side)
```typescript
// lib/utils/get-app-url.ts
import { headers } from 'next/headers'

export async function getAppUrl(): Promise<string> {
  // 1. Try env var first (explicit override)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  // 2. Detect from request headers
  const headersList = headers()
  const host = headersList.get('host')
  const protocol = headersList.get('x-forwarded-proto') || 'http'

  if (host) {
    return `${protocol}://${host}`
  }

  // 3. Fallback for build time
  return 'http://localhost:3000'
}
```

### Option 2: Environment-Specific Defaults
```typescript
// lib/config.ts
export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  // Environment-specific defaults
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://www.talk-to-my-lawyer.com'
  }

  if (process.env.VERCEL_ENV === 'preview') {
    return `https://${process.env.VERCEL_URL}`
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000'
  }

  // Fallback
  return 'http://localhost:3000'
}
```

### Option 3: Next.js Runtime Config
```typescript
// next.config.js
module.exports = {
  publicRuntimeConfig: {
    APP_URL: process.env.NEXT_PUBLIC_APP_URL ||
            process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
            'http://localhost:3000'
  }
}
```

## Environment Variables Setup

### Development (.env.local)
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Staging (.env.staging)
```env
NEXT_PUBLIC_APP_URL=https://staging.talk-to-my-lawyer.com
```

### Production (.env.production)
```env
NEXT_PUBLIC_APP_URL=https://www.talk-to-my-lawyer.com
```

### Vercel (Automatic)
```env
# Vercel provides these automatically
VERCEL_URL=talk-to-my-lawyer-git-feat-pr-123.vercel.app
VERCEL_ENV=preview  # or production, development
```

## Usage Throughout App

### API Routes
```typescript
import { getAppUrl } from '@/lib/utils/get-app-url'

export async function POST(request: NextRequest) {
  const appUrl = await getAppUrl()

  // Generate reset link
  const resetLink = `${appUrl}/reset-password?token=${token}`

  // Send email with correct link
}
```

### Client Components
```typescript
'use client'
import { useEffect, useState } from 'react'

export function ShareButton() {
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    // Client-side: use window.location
    setShareUrl(`${window.location.origin}/share/${id}`)
  }, [])

  return <button onClick={() => share(shareUrl)}>Share</button>
}
```

### Stripe Webhooks
```typescript
const session = await stripe.checkout.sessions.create({
  success_url: `${await getAppUrl()}/dashboard?success=true`,
  cancel_url: `${await getAppUrl()}/pricing?canceled=true`,
})
```

## Files to Update
Search for all uses of `APP_URL`:
```bash
grep -r "APP_URL" --include="*.ts" --include="*.tsx" .
```

Likely files:
- [ ] `app/layout.tsx`
- [ ] `app/api/create-checkout/route.ts`
- [ ] Email templates
- [ ] OAuth callback URLs
- [ ] Webhook configurations

## Testing Checklist
- [ ] Development (localhost:3000) - links work locally
- [ ] Staging deployment - links point to staging
- [ ] Preview deployment - links point to preview URL
- [ ] Production - links point to production
- [ ] Email password reset links work in all environments
- [ ] Stripe redirects work in all environments

## Acceptance Criteria
- [ ] Dynamic URL detection implemented
- [ ] Works correctly in all environments
- [ ] No hardcoded production URLs
- [ ] Environment variables documented
- [ ] All usages of APP_URL updated
- [ ] Tests confirm URLs match environment
