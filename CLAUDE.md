# CLAUDE.md - AI Assistant Development Guide

> Quick reference for AI assistants. For full documentation, see consolidated docs in project root.

## Project Summary
**Talk-To-My-Lawyer**: AI-powered legal letter SaaS with mandatory attorney review.

```
User → Letter Form → AI Draft (GPT-4 Turbo) → Admin Review → PDF Download
```

## Tech Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL + RLS + Auth), Stripe, OpenAI via Vercel AI SDK
- **Email**: SendGrid / Brevo (with queue system)
- **PDF**: jsPDF for letter generation
- **Package Manager**: pnpm

---

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Development server (localhost:3000)
pnpm build            # Production build (must pass)
pnpm lint             # ESLint check
pnpm start            # Start production server
pnpm start:prod       # Validate env + start production
pnpm db:migrate       # Run database migrations
pnpm health-check     # Check application health
pnpm validate-env     # Validate environment variables
```

---

## CRITICAL: Role Authorization

There are exactly 3 roles. No "super admin" exists.

| Role | Access | Hard Constraint |
|------|--------|-----------------|
| `subscriber` | Own letters, subscription, profile | First letter free, then credits |
| `employee` | Own coupons, commissions only | **NEVER access letter content** |
| `admin` | Full access via `/secure-admin-gateway` | Env-based auth + portal key |

### is_super_user flag (NOT a role)
`is_super_user` is a boolean flag on subscriber profiles for unlimited letters. It is NOT an admin role.

```typescript
// WRONG - is_super_user is NOT admin
if (profile.is_super_user) { /* admin logic */ }

// CORRECT - is_super_user means unlimited letters ONLY (premium subscriber)
if (profile.is_super_user) { /* skip credit check */ }

// CORRECT - admin check (single admin role, no super admin)
if (profile.role === 'admin') { /* admin logic */ }
```

---

## CRITICAL: Letter Status Workflow

```
draft → generating → pending_review → under_review → approved → completed
                                                   ↘ rejected
```

### Status Rules
- **Unapproved letters**: Content HIDDEN from subscriber (show "Under Review")
- **Approved letters**: Full content visible, PDF/email enabled
- **All transitions**: MUST log via `log_letter_audit()`

```typescript
// ALWAYS audit status changes
await supabase.rpc('log_letter_audit', {
  p_letter_id: letterId,
  p_action: 'approved',
  p_old_status: 'under_review',
  p_new_status: 'approved',
  p_notes: 'Approved by admin'
})
```

---

## CRITICAL: Supabase Client Usage

```typescript
// Server components/API routes - ALWAYS use server client
import { createClient } from "@/lib/supabase/server"
const supabase = await createClient()

// Client components ONLY
import { createClient } from "@/lib/supabase/client"
```

---

## API Route Pattern

```typescript
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 1. Auth check
    const { data: { user }, error } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // 2. Role check (if needed)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    // 3. Business logic (RLS auto-enforces access)

    // 4. Response
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("[FeatureName] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
```

---

## Key Database Functions

| Function | Purpose |
|----------|---------|
| `check_letter_allowance(u_id)` | Returns `{has_allowance, remaining, plan_name, is_super}` |
| `deduct_letter_allowance(u_id)` | Deducts 1 credit, returns boolean |
| `log_letter_audit(...)` | Creates audit trail entry |
| `validate_coupon(code)` | Validates employee coupon |
| `get_employee_coupon(u_id)` | Gets employee's coupon code |

---

## Project Structure

```
app/
├── api/
│   ├── generate-letter/       # AI letter generation
│   ├── letters/[id]/          # approve, reject, improve, pdf, send-email, audit
│   ├── admin/                 # coupons, email-queue, analytics
│   ├── admin-auth/            # login, logout
│   ├── auth/                  # reset-password, update-password
│   ├── subscriptions/         # check-allowance, activate, reset-monthly
│   ├── gdpr/                  # export-data, delete-account, accept-privacy-policy
│   ├── cron/                  # process-email-queue
│   ├── health/                # health checks
│   └── stripe/webhook/        # Stripe webhook handler
├── dashboard/                 # Subscriber dashboard
├── secure-admin-gateway/      # Admin portal (separate auth)
│   ├── login/
│   ├── review/
│   └── dashboard/             # users, letters, coupons, analytics, commissions
└── auth/                      # login, signup, forgot-password, reset-password

lib/
├── supabase/
│   ├── server.ts              # Server Supabase client
│   ├── client.ts              # Browser Supabase client
│   └── middleware.ts          # Auth middleware
├── auth/
│   ├── admin-session.ts       # Admin session (30min timeout)
│   ├── admin-guard.ts         # Admin route protection
│   └── get-user.ts            # User helper
├── email/
│   ├── service.ts             # Email service
│   ├── queue.ts               # Email queue
│   ├── templates.ts           # Email templates
│   └── providers/             # SendGrid, Brevo, Console
├── pdf/
│   ├── generator.ts           # PDF letter generation
│   └── types.ts               # PDF types
├── logging/
│   └── structured-logger.ts   # Structured logging
├── security/
│   └── input-sanitizer.ts     # Input sanitization
├── errors/
│   └── error-handler.ts       # Error handling utilities
├── database.types.ts          # Supabase generated types
├── rate-limit.ts              # Rate limiting
└── utils.ts                   # General utilities

scripts/
├── 001-022*.sql               # Database migrations (run in order)
├── run-migrations.js          # Migration runner
├── validate-env.js            # Environment validation
└── health-check.js            # Health check script
```

---

## Security Checklist

1. **RLS mandatory** - Never bypass with service role in user-facing code
2. **Employee isolation** - Employees NEVER see letter content
3. **Audit logging** - All letter status changes logged
4. **Admin auth** - Separate system, env-based credentials
5. **Secrets** - Never log API keys, use `process.env` only
6. **Input sanitization** - Use `lib/security/input-sanitizer.ts`
7. **Rate limiting** - Apply to public endpoints

---

## Common Gotchas

- **Free trial**: Check `count === 0` letters before requiring subscription
- **Letter credits**: Call `deduct_letter_allowance(u_id)` after generation
- **Admin routes**: Use `isAdminAuthenticated()` from `lib/auth/admin-session.ts`
- **UI components**: Use `@/components/ui/*` (shadcn/ui), toast via `sonner`
- **TypeScript**: Use types from `lib/database.types.ts`, no `any`
- **Email**: Use email queue for async delivery (`lib/email/queue.ts`)
- **PDF**: Generate via `lib/pdf/generator.ts`
- **Logging**: Use structured logger for production logs

---

## Environment Variables

Required environment variables (validated by `pnpm validate-env`):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role (server only)
- `OPENAI_API_KEY` - OpenAI API key for letter generation
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- `ADMIN_USERNAME` - Admin portal username
- `ADMIN_PASSWORD` - Admin portal password
- `ADMIN_PORTAL_KEY` - Admin portal access key
