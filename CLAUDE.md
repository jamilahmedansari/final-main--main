# CLAUDE.md - AI Assistant Development Guide

> **Quick Reference for AI Assistants** - Essential patterns, workflows, and critical constraints for the Talk-To-My-Lawyer platform.

## 📋 Project Summary

**Talk-To-My-Lawyer**: AI-powered legal letter SaaS with mandatory attorney review workflow.

```
Subscriber → Letter Request → AI Draft (GPT-4 Turbo) → Admin Review → Approval → PDF/Email
```

### Tech Stack
- **Frontend**: Next.js 16.0.3 (App Router), React 19.2.0, TypeScript 5+, Tailwind CSS 4.1+
- **UI Library**: shadcn/ui (Radix UI primitives), Lucide icons, Motion (Framer Motion)
- **Backend**: Supabase (PostgreSQL + RLS + Auth), Stripe payments, OpenAI via Vercel AI SDK
- **Infrastructure**: Vercel hosting, Upstash Redis (rate limiting), SendGrid (email)
- **Package Manager**: pnpm (required)
- **Node.js**: 18+ required

---

## ⚠️ CRITICAL: Role Authorization & Access Control

### Three User Roles

| Role | Access | Key Constraints |
|------|--------|-----------------|
| **subscriber** | Own letters, subscription, profile | First letter free, then credit-based |
| **employee** | Own coupons, commission tracking ONLY | **NEVER access letter content** |
| **admin** | All data via `/secure-admin-gateway` | Separate auth system (env-based) |

### ⚠️ CRITICAL: is_super_user vs admin Role

```typescript
// ❌ WRONG - is_super_user is NOT admin role
if (profile.is_super_user) {
  // admin logic - WRONG!
}

// ✅ CORRECT - is_super_user means UNLIMITED LETTERS only
if (profile.is_super_user) {
  // Skip credit check for letter generation
}

// ✅ CORRECT - admin role check
if (profile.role === 'admin') {
  // Admin-specific logic
}
```

**Key Distinction**:
- `is_super_user = true` → Unlimited letter generation (no credit deduction)
- `role = 'admin'` → Access to admin portal and review system

---

## ⚠️ CRITICAL: Letter Status Workflow

### Status Progression

```
draft → generating → pending_review → under_review → approved → completed
                                                   ↘ rejected → (resubmit) → pending_review
                     ↘ failed (on error)
```

### Status Rules & Visibility

| Status | Subscriber View | Admin View | Actions Available |
|--------|----------------|------------|-------------------|
| `draft` | Visible, editable | Not shown | Edit, submit |
| `generating` | "Generating..." | Not shown | None (system) |
| `pending_review` | "Under Review" | Review queue | Admin: start review |
| `under_review` | "Under Review" | Full content | Admin: approve/reject/improve |
| `approved` | Full content visible | Full content | Download PDF, send email |
| `completed` | Full content visible | Full content | View only |
| `rejected` | Rejection reason shown | Full content | Resubmit for review |
| `failed` | Error message | Error details | Regenerate |

### ⚠️ MANDATORY Audit Logging

**ALL status transitions MUST be logged:**

```typescript
// ALWAYS log status changes
await supabase.rpc('log_letter_audit', {
  p_letter_id: letterId,
  p_action: 'status_change',
  p_old_status: 'under_review',
  p_new_status: 'approved',
  p_notes: 'Approved by admin - grammar corrections applied'
})
```

**Never skip audit logging** - it's required for legal compliance and audit trail.

---

## ⚠️ CRITICAL: Supabase Client Usage

```typescript
// ✅ Server Components & API Routes - ALWAYS use server client
import { createClient } from "@/lib/supabase/server"
const supabase = await createClient() // async call

// ✅ Client Components ONLY - browser-side operations
import { createClient } from "@/lib/supabase/client"
const supabase = createClient() // sync call

// ❌ NEVER use service role key in client-facing code
// ❌ NEVER bypass RLS policies in user-facing features
```

**When to use each**:
- **Server client**: API routes, Server Components, data fetching
- **Client client**: Client Components, real-time subscriptions, auth state

---

## 🛤️ API Route Pattern (Standard Template)

```typescript
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { applyRateLimit, apiRateLimit } from "@/lib/rate-limit-redis"

export async function POST(request: NextRequest) {
  try {
    // 1. RATE LIMITING (if needed)
    const rateLimitResponse = await applyRateLimit(request, apiRateLimit)
    if (rateLimitResponse) return rateLimitResponse

    // 2. CREATE SUPABASE CLIENT
    const supabase = await createClient()

    // 3. AUTH CHECK
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 4. ROLE CHECK (if needed)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_super_user")
      .eq("id", user.id)
      .single()

    if (profile?.role !== 'subscriber') {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 5. PARSE REQUEST BODY
    const body = await request.json()
    const { field1, field2 } = body

    // 6. VALIDATE INPUT
    if (!field1 || !field2) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // 7. BUSINESS LOGIC
    // RLS policies automatically enforce data access rules
    const { data, error } = await supabase
      .from("table_name")
      .insert({ user_id: user.id, field1, field2 })
      .select()
      .single()

    if (error) throw error

    // 8. SUCCESS RESPONSE
    return NextResponse.json({ success: true, data })

  } catch (error) {
    console.error("[FeatureName] Error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
```

---

## 🗄️ Key Database Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `check_letter_allowance(u_id)` | Check user's letter credit balance | `{has_allowance, remaining, plan_name, is_super}` |
| `deduct_letter_allowance(u_id)` | Deduct 1 credit (atomic) | `boolean` (success/fail) |
| `log_letter_audit(...)` | Create audit trail entry | `void` |
| `validate_coupon(code)` | Validate employee coupon | `{valid, discount_percent, employee_id}` |
| `handle_new_user()` | Auto-create profile on signup | Trigger (automatic) |

### Example: Check Letter Allowance

```typescript
const { data: allowance, error } = await supabase.rpc("check_letter_allowance", {
  u_id: user.id,
})

// Returns:
// {
//   has_allowance: boolean,
//   remaining: number,
//   plan_name: string | null,
//   is_super: boolean
// }
```

---

## 📂 Project Structure (Key Paths)

```
/home/user/main-main--final/
├── app/
│   ├── api/                          # API Routes
│   │   ├── generate-letter/route.ts  # AI letter generation
│   │   ├── letters/[id]/
│   │   │   ├── approve/route.ts      # Admin approve letter
│   │   │   ├── reject/route.ts       # Admin reject letter
│   │   │   ├── improve/route.ts      # AI improvement
│   │   │   ├── pdf/route.ts          # PDF generation
│   │   │   ├── send-email/route.ts   # Email delivery
│   │   │   ├── submit/route.ts       # Submit for review
│   │   │   └── start-review/route.ts # Start admin review
│   │   ├── admin-auth/               # Admin portal auth
│   │   ├── create-checkout/route.ts  # Stripe checkout
│   │   └── stripe/webhook/route.ts   # Stripe webhooks
│   ├── auth/                         # Auth pages (login, signup, etc.)
│   ├── dashboard/                    # Subscriber/Employee dashboards
│   │   ├── letters/                  # Subscriber letter management
│   │   ├── subscription/             # Subscription management
│   │   ├── commissions/              # Employee commissions
│   │   └── coupons/                  # Employee coupons
│   └── secure-admin-gateway/         # Admin portal (separate auth)
│       ├── login/                    # Admin login
│       ├── review/                   # Letter review center
│       └── dashboard/                # Admin analytics & management
├── components/
│   ├── admin/                        # Admin-specific components
│   │   ├── letter-review-interface.tsx
│   │   ├── review-letter-actions.tsx
│   │   └── user-management-actions.tsx
│   └── ui/                           # shadcn/ui components
├── lib/
│   ├── auth/
│   │   ├── admin-session.ts          # Admin session (30min timeout)
│   │   ├── admin-guard.ts            # Server-side admin check
│   │   └── get-user.ts               # User helper
│   ├── supabase/
│   │   ├── server.ts                 # Server Supabase client
│   │   ├── client.ts                 # Client Supabase client
│   │   └── middleware.ts             # Auth middleware
│   ├── database.types.ts             # TypeScript types from DB
│   ├── rate-limit-redis.ts           # Redis rate limiting
│   └── rate-limit.ts                 # In-memory rate limiting
└── scripts/                          # Database migrations
    ├── 001_setup_schema.sql
    ├── 002_setup_rls.sql
    ├── 003_seed_data.sql
    ├── 004_create_functions.sql
    ├── 005_letter_allowance_system.sql
    ├── 006_audit_trail.sql
    └── ... (run in numerical order)
```

---

## 🔧 Development Commands

```bash
# Install dependencies
pnpm install

# Development server (localhost:3000)
pnpm dev

# Production build (MUST pass before deploy)
pnpm build

# Linting
pnpm lint

# Start production server locally
pnpm start
```

---

## 🗃️ Database Migration Order

**Run SQL scripts in Supabase SQL Editor in this order:**

1. `001_setup_schema.sql` - Core tables
2. `002_setup_rls.sql` - Row Level Security policies
3. `003_seed_data.sql` - Initial data (subscription plans)
4. `004_create_functions.sql` - Database functions
5. `005_letter_allowance_system.sql` - Credit system
6. `006_audit_trail.sql` - Audit logging
7. `007_add_missing_letter_statuses.sql` - Status updates
8. `008_employee_coupon_auto_generation.sql` - Coupon system
9. `009_add_missing_subscription_fields.sql` - Subscription updates
10. `010_add_missing_functions.sql` - Additional functions
11. `011_security_hardening.sql` - Security enhancements
12. Continue with 012+ scripts as needed

---

## 🌍 Environment Variables

### Required Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# OpenAI
OPENAI_API_KEY=sk-xxx...

# Admin Portal (separate auth system)
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure_password_here
ADMIN_PORTAL_KEY=random_secure_key_here

# App URLs
NEXT_PUBLIC_APP_URL=https://www.talk-to-my-lawyer.com
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
```

### Optional (Recommended for Production)

```bash
# Stripe (payments)
STRIPE_SECRET_KEY=sk_live_xxx...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx...
STRIPE_WEBHOOK_SECRET=whsec_xxx...

# Upstash Redis (rate limiting)
KV_REST_API_URL=https://xxx.upstash.io
KV_REST_API_TOKEN=xxx...
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379

# Cron (monthly reset)
CRON_SECRET=random_secret_for_cron_auth

# Test Mode (development only)
ENABLE_TEST_MODE=true
NEXT_PUBLIC_TEST_MODE=true
```

---

## 🚦 Rate Limiting

### Redis-based (Production)

```typescript
import { letterGenerationRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

// In API route
const rateLimitResponse = await safeApplyRateLimit(
  request,
  letterGenerationRateLimit,
  5,    // max requests
  "1 h" // time window
)
if (rateLimitResponse) return rateLimitResponse
```

### Available Rate Limiters

| Limiter | Limit | Window | Use Case |
|---------|-------|--------|----------|
| `authRateLimit` | 5 requests | 15 min | Login/signup |
| `apiRateLimit` | 100 requests | 1 min | General API |
| `adminRateLimit` | 10 requests | 15 min | Admin endpoints |
| `letterGenerationRateLimit` | 5 requests | 1 hour | Letter generation |
| `subscriptionRateLimit` | 3 requests | 1 hour | Subscription actions |

---

## 🔐 Security Checklist

### Mandatory Practices

1. **RLS Enforcement** - Never bypass RLS with service role in user-facing code
2. **Employee Isolation** - Employees NEVER access `letters.content` or `letters.ai_draft_content`
3. **Audit All Changes** - Call `log_letter_audit()` for all letter status changes
4. **Admin Separation** - Admin portal uses separate auth via `admin-session.ts`
5. **Input Validation** - Validate all user inputs before database operations
6. **Type Safety** - Use types from `lib/database.types.ts`, avoid `any`
7. **Secret Management** - Never log API keys, always use `process.env`

### Admin Portal Security

```typescript
// Server-side admin check (API routes)
import { isAdminAuthenticated } from '@/lib/auth/admin-session'

const adminUser = await isAdminAuthenticated()
if (!adminUser) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

---

## 🎯 Common Workflows

### 1. Generate Letter (Subscriber)

```typescript
// app/api/generate-letter/route.ts

1. Rate limit check
2. Auth check (must be subscriber)
3. Check letter allowance via check_letter_allowance(user_id)
4. Check free trial eligibility (count === 0 letters)
5. Create letter record with status='generating'
6. Call OpenAI API for AI generation
7. Update letter with ai_draft_content and status='pending_review'
8. Deduct credit via deduct_letter_allowance(user_id) (if not free trial)
9. Log audit trail
10. Return success
```

### 2. Review Letter (Admin)

```typescript
// app/secure-admin-gateway/review/[id]/page.tsx

1. Verify admin session
2. Fetch letter via RLS (admin has full access)
3. Display full content for editing
4. Admin can:
   - Edit manually
   - Improve with AI (app/api/letters/[id]/improve)
   - Approve (app/api/letters/[id]/approve)
   - Reject (app/api/letters/[id]/reject)
5. All actions log via log_letter_audit()
```

### 3. Free Trial Logic

```typescript
// Check if user eligible for free trial
const { count } = await supabase
  .from("letters")
  .select("*", { count: "exact", head: true })
  .eq("user_id", user.id)
  .not("status", "eq", "failed") // Don't count failed attempts

const isFreeTrial = (count || 0) === 0 && !profile.is_super_user

if (isFreeTrial) {
  // Allow generation without credit check
  // DO NOT deduct credit
} else {
  // Normal credit check and deduction
}
```

---

## 🐛 Common Gotchas

### 1. Free Trial Detection

```typescript
// ❌ WRONG - checks allowance first
if (allowance.has_allowance) { /* generate */ }

// ✅ CORRECT - check free trial first
const isFreeTrial = (totalLetterCount === 0) && !is_super_user
if (isFreeTrial || allowance.has_allowance) { /* generate */ }
```

### 2. Credit Deduction

```typescript
// ❌ WRONG - deduct before generation
await deduct_letter_allowance(user_id)
// ... then generate (what if it fails?)

// ✅ CORRECT - deduct after successful generation
// ... generate letter
if (success && !isFreeTrial && !is_super_user) {
  await deduct_letter_allowance(user_id)
}
```

### 3. Admin vs Super User

```typescript
// ❌ WRONG
if (is_super_user) {
  // Show admin panel - WRONG!
}

// ✅ CORRECT
if (role === 'admin') {
  // Show admin panel
}

if (is_super_user) {
  // Skip letter credit deduction only
}
```

### 4. Supabase Client Import

```typescript
// ❌ WRONG - mixing server/client
import { createClient } from "@/lib/supabase/client" // in API route

// ✅ CORRECT
// API routes & server components:
import { createClient } from "@/lib/supabase/server"

// Client components:
import { createClient } from "@/lib/supabase/client"
```

### 5. Employee Access Control

```typescript
// ❌ WRONG - employee accessing letters
const { data } = await supabase
  .from("letters")
  .select("content") // Forbidden by RLS

// ✅ CORRECT - employee accessing own data only
const { data } = await supabase
  .from("commissions")
  .select("*")
  .eq("employee_id", user.id)
```

---

## 🎨 UI Component Guidelines

### Import Pattern

```typescript
// ✅ Use shadcn/ui components
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

// ✅ Toast notifications
import { toast } from "sonner"

toast.success("Letter approved successfully")
toast.error("Failed to generate letter")
```

### Component Location

- **shadcn/ui primitives**: `components/ui/*`
- **Business logic components**: `components/` (root)
- **Admin-specific**: `components/admin/`

---

## 📝 TypeScript Best Practices

### Use Database Types

```typescript
import type {
  Profile,
  Letter,
  LetterStatus,
  UserRole
} from "@/lib/database.types"

// ✅ Type-safe
const status: LetterStatus = "pending_review"

// ❌ Avoid magic strings
const status = "pending_review" // untyped
```

### Avoid `any`

```typescript
// ❌ WRONG
const data: any = await fetchData()

// ✅ CORRECT
interface ResponseData {
  id: string
  content: string
}
const data: ResponseData = await fetchData()
```

---

## 📊 Middleware & Route Protection

### File: `lib/supabase/middleware.ts`

**Protects routes based on:**
- Authentication status
- User role
- Admin session validity

**Key protections:**
1. `/secure-admin-gateway/*` → Requires admin session (separate from Supabase auth)
2. `/dashboard/*` → Requires authenticated user
3. Role-based redirects (employees can't access `/dashboard/letters`)

---

## 🎭 Admin Portal (Separate Auth System)

**Location**: `/secure-admin-gateway`

**Authentication**: Environment-based (not Supabase Auth)
- Admin credentials in `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PORTAL_KEY`)
- 30-minute session timeout
- Separate cookie-based session management

**Access levels:**
- **Regular admin**: Can review/approve letters
- **Super admin** (`is_super_user=true` + `role='admin'`): Full dashboard access

---

## 🔄 Letter Generation Flow (Detailed)

```
1. User fills form in /dashboard/letters/new
   ↓
2. Client submits to /api/generate-letter
   ↓
3. API checks:
   - Auth (must be subscriber)
   - Rate limit (5/hour)
   - Free trial (count === 0 letters?)
   - Letter allowance (if not free trial)
   ↓
4. Create letter record (status='generating')
   ↓
5. Call OpenAI GPT-4 Turbo via Vercel AI SDK
   ↓
6. Update letter:
   - ai_draft_content = AI response
   - status = 'pending_review'
   ↓
7. Deduct credit (if not free trial or super user)
   ↓
8. Log audit: 'letter_generated'
   ↓
9. Admin sees in review queue (/secure-admin-gateway/review)
   ↓
10. Admin reviews, edits, approves
   ↓
11. Status → 'approved'
   ↓
12. Subscriber can download PDF or send email
```

---

## 📚 Additional Documentation

- **[README.md](./README.md)** - Project overview and setup
- **[PLATFORM_ARCHITECTURE.md](./PLATFORM_ARCHITECTURE.md)** - Detailed architecture
- **[DATABASE_FUNCTIONS.md](./DATABASE_FUNCTIONS.md)** - Database function reference
- **[SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)** - Security guidelines
- **[PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)** - Pre-deployment checklist

---

## 🚀 Quick Start for AI Assistants

1. **Read this file first** - Understand critical constraints
2. **Check user role** - Know who can access what
3. **Follow API patterns** - Use standard template above
4. **Audit everything** - Log all letter changes
5. **Type safety** - Use types from `database.types.ts`
6. **Test locally** - `pnpm dev` before committing
7. **Build check** - `pnpm build` must succeed

---

## ⚡ Performance Notes

- Use `select()` with specific columns, not `select("*")`
- Implement pagination for large lists (letters, users)
- Cache frequently accessed data (subscription plans)
- Use React Server Components for data fetching when possible
- Minimize client-side JavaScript bundle

---

**Last Updated**: December 2024
**Version**: 2.0.0
**Maintainer**: AI Development Team
