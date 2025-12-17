# Agents.md - Verification & Testing Guide

> Instructions for automated agents to verify Talk-To-My-Lawyer functionality.  
> For full architecture, see consolidated documentation in project root.

---

## Quick Context

**App**: AI-powered legal letter SaaS with mandatory attorney review.  
**Stack**: Next.js 16 (App Router) | Supabase (Postgres + RLS) | OpenAI | Stripe | pnpm

```
User → Letter Form → AI Draft (GPT-4 Turbo) → Admin Review → PDF Download
```

---

## ⚠️ CRITICAL: Role Verification

### Three Roles (Verify RLS Enforces These)

| Role         | Can Access                             | CANNOT Access                   |
| ------------ | -------------------------------------- | ------------------------------- |
| `subscriber` | Own letters, subscription, profile     | Other users' data, admin portal |
| `employee`   | Own coupons, commissions               | **ANY letter content**          |
| `admin`      | Everything via `/secure-admin-gateway` | N/A                             |

### Single Admin Model (Critical)

There is **exactly ONE admin account** in the system.

This **single admin** is responsible for:

- Reviewing every submitted letter in the **Review Center**
- **Editing/improving** letter content (including via AI assist)
- **Approving or rejecting** letters
- Monitoring **dashboard analytics**, including:
  - Letters generated / submitted / approved / rejected
  - Employee coupon code usage and discount impact
  - Employee commission totals and related metrics

> ⚠️ `is_super_user` = unlimited letters (subscriber business feature), **NOT** admin privilege.

**Admin portal access rules**

- Admin access is **only** via `/secure-admin-gateway/*` using **email/password + portal key** (env-based).
- There is **no public admin signup** and no multi-admin model.

---

## Verification Checklist

### 1. Authentication Flows

- [ ] **Subscriber**: Sign up → redirects to `/dashboard`
- [ ] **Employee**: Has access to `/dashboard/coupons`, `/dashboard/commissions`
- [ ] **Admin**: Only accessible via `/secure-admin-gateway/login` (no public signup)
- [ ] **Cross-role**: Subscribers cannot access admin routes, employees cannot see letters

### 2. Letter Lifecycle

```
draft → generating → pending_review → under_review → approved/rejected → completed
```

- [ ] Letter form submission creates record with `draft` status
- [ ] AI generation updates to `generating` then `pending_review`
- [ ] Single admin starts review → updates to `under_review`
- [ ] Approval/rejection logged via `log_letter_audit()`
- [ ] Subscriber sees content ONLY after approval

### 3. Subscription & Credits

| Plan       | Price   | Credits          |
| ---------- | ------- | ---------------- |
| Free Trial | $0      | 1 (first letter) |
| Single     | $299    | 1                |
| Monthly    | $299/mo | 4                |
| Yearly     | $599/yr | 8                |

- [ ] Free trial: `count === 0` check works
- [ ] Credits deducted via `deduct_letter_allowance(u_id)`
- [ ] Subscriber with `is_super_user=true` bypasses credit check (unlimited)

### 4. Employee System

- [ ] Coupon auto-generated on employee role assignment (format: `EMP-XXXXXX`)
- [ ] Coupon applies 20% discount
- [ ] Commission: 5% of subscription amount
- [ ] Employee dashboard shows usage stats
- [ ] Verify employees cannot view letters or letter content (RLS + UI + API)

### 5. Admin Portal (Single Admin)

- [ ] Access: `/secure-admin-gateway/login`
- [ ] Auth: Email + Password + Portal Key (env-based)
- [ ] Session: 30-minute timeout
- [ ] Dashboard includes:
  - [ ] **Review Center** / queue for `pending_review` letters
  - [ ] Letter review actions: edit/improve, approve, reject
  - [ ] **Analytics** for letters and employee systems (coupons + commissions)

---

## Routes & Endpoints Reference (Purpose + Role)

### UI Pages

**Public**

- `/` - marketing/landing (redirects signed-in users by role)
- `/auth/login` - sign in
- `/auth/signup` - sign up
- `/auth/check-email` - post-signup / post-reset email sent
- `/auth/forgot-password` - request password reset
- `/auth/reset-password` - set new password (via Supabase reset session)

**Authenticated (role-based under /dashboard)**

- `/dashboard` - main dashboard (redirects by role)
- `/dashboard/letters` - subscriber letters list (employees redirected away)
- `/dashboard/letters/new` - create letter intake (subscriber)
- `/dashboard/letters/[id]` - letter detail (subscriber owner; admins may view)
- `/dashboard/subscription` - subscription/credits (subscriber)
- `/dashboard/settings` - settings (intended subscriber)
- `/dashboard/commissions` - commissions (employee; admins may view)
- `/dashboard/coupons` - coupons (employee; admins may view)
- `/dashboard/employee-settings` - employee settings (intended employee)
- `/dashboard/admin-settings` - admin settings (intended admin)

**Legacy/Alternate Admin UIs**

- `/admin/*` - admin-only UI (Supabase `profiles.role = 'admin'`)
- `/dashboard/admin/*` - legacy admin UI (blocked/redirected by middleware)

**Secure Admin Portal (separate portal session; SINGLE ADMIN)**

- `/secure-admin-gateway` - portal entry (redirects to login/dashboard based on portal session)
- `/secure-admin-gateway/login` - portal login (email/password + portal key)
- `/secure-admin-gateway/dashboard` - **single admin** dashboard (includes analytics + review center entry points)
- `/secure-admin-gateway/review` - review center / queue
- `/secure-admin-gateway/review/[id]` - review/edit/approve/reject a letter
- `/secure-admin-gateway/dashboard/letters` - review queue list
- `/secure-admin-gateway/dashboard/analytics` - analytics (letters + employee coupons + commissions)
- `/secure-admin-gateway/dashboard/commissions` - commissions analytics
- `/secure-admin-gateway/dashboard/all-letters` - all letters

### API Endpoints

**Public / system-to-system**

- `GET /api/health` - health check
- `POST /api/auth/reset-password` - send password reset email (rate-limited)
- `POST /api/stripe/webhook` - Stripe webhook receiver (signature-verified)
- `POST /api/verify-payment` - verify Stripe checkout session + create subscription (service-role)

**Authenticated (Supabase user session)**

- `POST /api/auth/update-password` - update password from reset session (rate-limited)
- `POST /api/create-checkout` - create Stripe checkout / coupon flows
- `POST /api/create-profile` - create/update own `profiles` row (self-only; uses service role)
- `GET /api/subscriptions/check-allowance` - credits check (RPC)
- `POST /api/subscriptions/activate` - activate subscription + add allowances (RPC)

**Letters (subscriber lifecycle)**

- `POST /api/generate-letter` - AI-generate draft + submit for review (subscriber only)
- `POST /api/letters/[id]/submit` - submit a letter for review (subscriber owner)
- `POST /api/letters/[id]/resubmit` - regenerate rejected letter + re-submit (subscriber owner)
- `POST /api/letters/[id]/send-email` - email an approved/completed letter PDF (subscriber owner)
- `GET /api/letters/[id]/pdf` - download approved letter PDF (subscriber owner; admins)

**Admin / Review workflows (admin portal session)**

- `POST /api/letters/improve` - AI improve helper (admin - Supabase role)
- `GET /api/letters/[id]/audit` - letter audit trail (INTENDED: admin-only; employee must not access letter data)
- `POST /api/letters/[id]/start-review` - set `under_review`
- `POST /api/letters/[id]/approve` - approve + store final content
- `POST /api/letters/[id]/reject` - reject with reason
- `POST /api/letters/[id]/improve` - AI improve helper for review
- `POST /api/letters/[id]/complete` - mark approved letter completed

**Admin portal auth**

- `POST /api/admin-auth/login` - create portal session cookie
- `POST /api/admin-auth/logout` - destroy portal session cookie
- `GET /api/admin/analytics` - analytics (admin portal session)

**Admin or CRON**

- `POST /api/subscriptions/reset-monthly` - reset allowances (Bearer `CRON_SECRET` OR admin)

---

## Environment Variables (Verify Existence Only)

```bash
# Required - verify these exist in process.env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENAI_API_KEY
STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
ADMIN_EMAIL
ADMIN_PASSWORD
ADMIN_PORTAL_KEY
CRON_SECRET
```

⚠️ **Never log or expose actual values**

---

## Database Tables (Verify RLS Enabled)

- `profiles` - User accounts with role
- `letters` - Legal documents with status workflow
- `subscriptions` - Plans and credits
- `employee_coupons` - Discount codes
- `commissions` - Employee earnings
- `letter_audit_trail` - All letter actions

---

## Key Database Functions

| Function                        | Verify                         |
| ------------------------------- | ------------------------------ |
| `check_letter_allowance(u_id)`  | Returns correct allowance info |
| `deduct_letter_allowance(u_id)` | Properly decrements credits    |
| `log_letter_audit(...)`         | Creates audit entries          |
| `validate_coupon(code)`         | Validates employee coupons     |

---

## Build Verification

```bash
pnpm install    # No dependency errors
pnpm build      # Must pass (no TypeScript/Next.js errors)
pnpm dev        # Runs at localhost:3000
pnpm lint       # ESLint passes
```

---

## End-to-End Test Flow

### Test 1: Subscriber Journey

1. Sign up as subscriber
2. Create letter (first is free)
3. Verify AI draft generated
4. Verify letter shows "Under Review" (content hidden)
5. As the single admin: review/edit as needed, then approve letter
6. Verify subscriber can now see content and download PDF

### Test 2: Employee Commission

1. Create employee user
2. Verify coupon auto-generated
3. Subscriber uses coupon at checkout
4. Verify 20% discount applied
5. Verify employee gets 1 point + 5% commission

### Test 3: Role Isolation

1. As employee: attempt to access `/api/letters` → should fail
2. As subscriber: attempt to access `/secure-admin-gateway` → should fail
3. Verify RLS prevents cross-user data access

---

## Safe Auto-Fixes (Agents May Perform)

✅ Install missing dependencies  
✅ Fix obvious import errors  
✅ Add missing TypeScript types  
✅ Update deprecated API calls (if migration is documented)

---

## Do NOT Auto-Fix

❌ Change role semantics  
❌ Bypass RLS policies  
❌ Modify database schema without migration script  
❌ Create new routes or flows not in codebase  
❌ Expose or log secrets
