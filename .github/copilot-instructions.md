# Talk-To-My-Lawyer - Copilot Instructions

> AI-powered legal letter SaaS. Full reference: see consolidated documentation in project root.

## Core Workflow

```
User → Letter Form → AI Draft (GPT-4 Turbo) → Admin Review → Approved PDF
```

## Tech Stack

Next.js 16 (App Router, React 19) | Supabase (Postgres + RLS) | OpenAI via Vercel AI SDK | Stripe | pnpm

## Role Authorization (Critical)

| Role         | Access                    | Constraint                          |
| ------------ | ------------------------- | ----------------------------------- |
| `subscriber` | Own letters, subscription | First letter free, then credits     |
| `employee`   | Own coupons, commissions  | **NO letter access** (RLS enforced) |
| `admin`      | `/secure-admin-gateway/*` | Env-based auth + portal key         |

> ⚠️ `is_super_user` = unlimited letters, NOT admin privilege

## Supabase Client Pattern

```typescript
// Server (API routes, server components)
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Client components only
import { createClient } from "@/lib/supabase/client";
```

## API Route Pattern

```typescript
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // RLS enforces row-level access automatically
}
```

## Letter Status Flow

`draft` → `generating` → `pending_review` → `under_review` → `approved`/`rejected` → `completed`

Always audit status changes:

```typescript
await supabase.rpc("log_letter_audit", {
  p_letter_id,
  p_action,
  p_old_status,
  p_new_status,
  p_notes,
});
```

## Key Database Functions

- `check_letter_allowance(u_id)` → `{has_allowance, remaining, plan_name, is_super}`
- `deduct_letter_allowance(u_id)` → boolean (call after generation)
- `validate_coupon(code)` → validates employee coupon

## Commands

```bash
pnpm install && pnpm dev    # Development at localhost:3000
pnpm build                  # Must pass before deploy
pnpm lint                   # ESLint check
```

## Security Rules

1. **RLS mandatory** - Never bypass with service role in user-facing code
2. **Employee isolation** - No letter content access (business requirement)
3. **Admin auth** - Separate system via `lib/auth/admin-session.ts` (30min timeout)

## Common Patterns

- Free trial: `count === 0` letters check before requiring subscription
- UI: shadcn/ui from `@/components/ui/*`, toast via `sonner`
- Admin routes: Verify with `isAdminAuthenticated()` from `lib/auth/admin-session.ts`

## Routes & Endpoints (Purpose + Role)

### UI Routes

**Public**

- `/` - marketing/landing (redirects signed-in users by role)
- `/auth/login` - sign in
- `/auth/signup` - sign up
- `/auth/check-email` - post-email-sent screen
- `/auth/forgot-password` - request password reset
- `/auth/reset-password` - set new password (via Supabase reset session)

**Authenticated dashboard**

- `/dashboard` - role router for signed-in users
- `/dashboard/letters` - subscriber letters list
- `/dashboard/letters/new` - subscriber create letter intake
- `/dashboard/letters/[id]` - subscriber letter detail (admin may view)
- `/dashboard/subscription` - subscriber subscription/credits
- `/dashboard/settings` - settings (intended subscriber)
- `/dashboard/commissions` - employee commissions (admins may view)
- `/dashboard/coupons` - employee coupons (admins may view)
- `/dashboard/employee-settings` - employee settings
- `/dashboard/admin-settings` - admin settings

**Secure Admin Portal (separate auth system)**

- `/secure-admin-gateway/login` - portal login (email/password + portal key)
- `/secure-admin-gateway/dashboard` - admin portal dashboard
- `/secure-admin-gateway/review` - review center
- `/secure-admin-gateway/review/[id]` - review a letter
- `/secure-admin-gateway/dashboard/letters` - review queue (admin only)
- `/secure-admin-gateway/dashboard/analytics` - analytics (admin only)
- `/secure-admin-gateway/dashboard/commissions` - commissions (admin only)
- `/secure-admin-gateway/dashboard/all-letters` - all letters (admin only)

### API Endpoints

**Public / system-to-system**

- `GET /api/health` - health check
- `POST /api/auth/reset-password` - send reset email (rate-limited)
- `POST /api/stripe/webhook` - Stripe webhook (signature-verified; service-role DB)
- `POST /api/verify-payment` - verify Stripe session + create subscription (service-role DB)

**Authenticated (Supabase user session)**

- `POST /api/auth/update-password` - update password from reset session (rate-limited)
- `POST /api/create-checkout` - start checkout / coupon flows
- `GET /api/subscriptions/check-allowance` - credits check (RPC)
- `POST /api/subscriptions/activate` - activate subscription + add allowances (RPC)

**Letters (subscriber lifecycle)**

- `POST /api/generate-letter` - AI draft + create letter + submit for review (subscriber only)
- `POST /api/letters/[id]/submit` - submit letter for review (subscriber owner)
- `POST /api/letters/[id]/resubmit` - regenerate rejected letter + re-submit (subscriber owner)
- `GET /api/letters/[id]/pdf` - download approved letter PDF (subscriber owner; admin)
- `POST /api/letters/[id]/send-email` - email approved/completed letter PDF (subscriber owner)

**Admin / Review workflows**

- `POST /api/letters/improve` - AI improvement helper (admin - Supabase role)
- `POST /api/letters/[id]/start-review` - set `under_review` (admin portal session)
- `POST /api/letters/[id]/approve` - approve + store final content (admin portal session)
- `POST /api/letters/[id]/reject` - reject with reason (admin portal session)
- `POST /api/letters/[id]/improve` - AI improvement helper (admin portal session)
- `POST /api/letters/[id]/complete` - mark letter completed (admin portal session)

**Admin portal auth**

- `POST /api/admin-auth/login` - create admin portal session cookie
- `POST /api/admin-auth/logout` - destroy admin portal session cookie
- `GET /api/admin/analytics` - analytics (admin portal session)

**Admin or CRON**

- `POST /api/subscriptions/reset-monthly` - reset allowances (Bearer `CRON_SECRET` OR admin)
