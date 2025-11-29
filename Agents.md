# Agent Instructions: Talk-to-My-Lawyer Application Verification

## Objective

Verify that the **Talk-to-My-Lawyer** application works end-to-end across all three roles (**Subscriber, Employee, Admin**) with secure authentication, AI letter generation, admin review, subscriptions, coupons/commissions, and PDF delivery.  

If any issues are found, fix them automatically where it is **safe and deterministic** to do so.

---

## 0. Application Context (Do NOT change, only verify)

**Stack & Infra**

- Frontend: **Next.js** (App Router) hosted on **Vercel**
- Backend: **Supabase** (Postgres, Auth, Storage, Realtime, Edge Functions)
- AI Provider: **OpenAI** (first draft letter generation via Edge Function or API route)
- Payments: **Stripe** (subscriptions, one-off letter purchase)
- Storage: Supabase Storage for PDFs

**Core User Roles**

1. **Subscriber (User)**
   - Signs up / logs in via Supabase Auth
   - Fills **Letter Generation Form**
   - Sees AI-generated draft only after **Admin review & approval**
   - Accesses letters in **My Letters** area
   - Manages **subscription**, **profile**, and **billing**

2. **Employee**
   - Signs up as employee (NOT admin)
   - Gets a **discount coupon code** to share
   - Earns:
     - **1 point** per successful coupon use
     - **5% commission** on the subscription/plan purchased with their code
   - Has an **Employee dashboard** to see coupon usage and earnings

3. **Admin**
   - **No public sign-up path**
   - Accesses a **separate admin portal** (e.g. `/secure-admin-gateway`)
   - Auth is stricter (email/password + key, short session timeout)
   - Reviews AI-generated drafts in an **editor**, edits, and **approves**
   - Manages:
     - Subscribers & their letters
     - Employees, coupons, commission metrics
     - High-level analytics

> IMPORTANT: `profiles.is_super_user` means **unlimited letters for a subscriber**, **NOT** “admin”. The agent must verify that no code treats it as an admin flag.

---

## 1. Initial Project Assessment

The agent must:

- Scan the entire project structure to identify:
  - Next.js app roots (`app/`, `pages/`, `middleware.ts`, etc.)
  - Admin routes (e.g. `/secure-admin-gateway`, `/admin`, `/dashboard/admin` if existing)
  - Subscriber dashboard routes (`/dashboard`, `/dashboard/letters`, `/dashboard/subscription`, `/dashboard/profile`)
  - Employee dashboard routes (`/dashboard/employee`, `/employee`, or existing structure)
  - API routes / server actions for:
    - Letter creation and status updates
    - Coupon/commission logic
    - Stripe webhook handlers
  - Supabase Edge Functions directories:
    - `generate-letter` (AI draft generation)
    - `calculate-commission` (commission logic)
    - `handle-stripe-webhook` (billing updates)
- Locate configuration files:
  - `package.json`, `tsconfig.json`, `next.config.js`, `.eslintrc.*`
  - Supabase config (`supabase/config.toml`, migrations, `supabase/functions/*`)
- Identify:
  - Database connection and Supabase client setup (`@supabase/ssr`, server-side clients)
  - RLS policies and relevant Postgres tables (from migrations)

The agent must **not** create new routes or flows. It should work within the existing routing structure and files.

---

## 2. Dependency Check

- Verify all Node dependencies are installed and consistent:
  - Run `npm install` / `pnpm install` / `yarn install` as appropriate
  - Check for missing or conflicting packages (Next.js, Supabase client, Stripe, OpenAI, PDF libs, rich text editor, etc.)
- Ensure **Supabase CLI** dependencies (if used) and Edge Function runtime requirements are satisfied.
- Do **not** upgrade major versions automatically unless:
  - The change is backward compatible and
  - The migration is deterministic and low risk

---

## 3. Configuration & Environment Verification

The agent must validate:

### 3.1 Environment Variables (Existence Only)

Check that the following **exist** (never log values):

- Supabase:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_JWT_SECRET`
- Stripe:
  - `STRIPE_PUBLISHABLE_KEY`
  - `STRIPE_SECRET_KEY`
  - Any plan price IDs used in code (e.g. monthly/yearly/one-off product IDs)
- AI Provider:
  - `OPENAI_API_KEY` (or equivalent key used for letter generation)
- Admin Security:
  - Any secret portal keys or admin credentials used by `/secure-admin-gateway`

The agent must:

- Confirm that the application **reads** these from `process.env`, not hard-coded literals.
- Never print or expose actual values in logs or reports.

### 3.2 Supabase & RLS

Verify:

- Tables such as:
  - `profiles`
  - `letters`
  - `subscriptions`
  - `employee_metrics`
  - `coupons`
  - `coupon_usage`
  - `commissions`
  - `transactions`
- Have **Row-Level Security (RLS)** enabled and appropriate policies:
  - Subscribers can only see **their own** profiles, letters, subscriptions.
  - Employees see **only their own** metrics, coupon usage, and commissions.
  - Admins access **everything** using service role or explicit admin checks.
- `profiles.is_super_user` is used **only** for “unlimited letters” logic, not for admin access.

---

## 4. Core Functionality Tests (App-Specific)

The agent must actively test these flows.

### 4.1 Authentication & Role Separation

- Test **Subscriber** flow:
  - Sign up / log in as a normal user.
  - Verify redirect to **Subscriber dashboard** (`/dashboard` or equivalent).
  - Ensure the UI shows:
    - My Letters
    - Create New Letter
    - Subscription
    - Profile
- Test **Employee** flow:
  - Sign up or mark a user as `role = employee` according to existing logic.
  - Verify access to **Employee dashboard** (employee coupons, commission stats).
- Test **Admin** flow:
  - **No admin sign-up** via public UI.
  - Verify the only way into the admin interface is:
    - A protected route such as `/secure-admin-gateway` or explicitly configured admin route.
  - Test admin login with:
    - Email/password and any additional portal key (if implemented).
  - Confirm that:
    - Normal subscribers/employees cannot access admin routes.
    - Admin routes use **middleware** and/or server-side checks with Supabase JWT.

### 4.2 Subscriber Dashboard

Verify the subscriber dashboard includes and functions:

- **My Letters**
  - Lists only the subscriber’s letters.
  - Shows status steps (e.g. “Request received”, “Under attorney review”, “Approved”, etc.).
  - Allows preview and download of approved letters.
- **Create New Letter**
  - Letter form fields:
    - Sender name/address
    - Attorney/law firm name
    - Recipient name
    - Matter/subject
    - Desired resolution
    - Any additional fields already present in the codebase
  - On submit:
    - Creates a letter record with appropriate initial status (`request_received` or equivalent).
    - Triggers AI draft generation via Edge Function or server action.
- **Subscription**
  - Shows current subscription status and remaining letters (or unlimited if `is_super_user`).
  - Provides upgrade/buy options based on existing Stripe plans.
- **Profile**
  - Update basic info (name, email, etc., as supported).
  - Logout behavior works correctly.

### 4.3 AI Letter Generation Flow (OpenAI)

The agent must validate:

- The **Edge Function or API endpoint** responsible for letter generation (e.g. `generate-letter`) exists and:
  - Accepts structured input from the letter form (facts, tone, type).
  - Calls **OpenAI** with a proper prompt (no secrets in logs).
  - Receives an AI-generated **first draft**.
- On successful generation:
  - The draft is stored in the `letters` table (or associated content table).
  - Status transitions from `"request_received"` → `"under_admin_review"` (or similar).
  - The letter is **not** yet visible as “approved” in the subscriber’s My Letters list.

### 4.4 Admin Review & Editor Workflow

The agent must confirm:

- Admin dashboard includes:
  - A **Review Queue** listing letters in `"under_admin_review"` status.
  - Ability to open each letter into an **editor** (rich text or markdown editor).
- Admin capabilities:
  - See AI first draft content.
  - Manually edit content.
  - Optionally trigger AI-assisted refinements (if implemented).
  - Approve the final draft.
- On **approval**:
  - Letter status updates to `"approved"` (or equivalent).
  - The final approved version is:
    - Available on the subscriber’s **My Letters** page.
    - Used as the **source of truth** for PDFs and email sending.
  - Any Supabase Realtime subscriptions correctly update the subscriber view.

### 4.5 PDF Generation & Delivery

Verify:

- A PDF-generation path exists (e.g. via `react-pdf`, `jspdf`, or an API route).
- For approved letters:
  - “Preview” shows the letter in a clean, legal-letter layout.
  - “Download as PDF” generates a valid file.
  - (If implemented) “Email via Attorney Channel” uses the approved content.
- PDFs are stored in Supabase Storage (if configured):
  - With access control that allows only:
    - The owning subscriber.
    - Admins.
    - Employee only if explicitly allowed (usually no).

---

## 5. Payments, Subscriptions, and Dummy Checkout

### 5.1 Stripe Plan Logic

Verify that:

- Existing Stripe price IDs map to plans such as (example amounts; do not hardcode here):
  - 1 letter — one-time
  - 4 letters / month — subscription
  - 8 letters / year — subscription
- When a plan is purchased:
  - `subscriptions` and/or `transactions` records are updated accordingly.
  - The subscriber’s allowed letter quota is updated (or unlimited if appropriate).

### 5.2 Webhook Handling

Check the Stripe webhook handler (e.g. `handle-stripe-webhook`):

- Listens for relevant events:
  - `checkout.session.completed`
  - `invoice.payment_succeeded` / `payment_intent.succeeded`, etc.
- On valid event:
  - Locates user by Stripe customer or metadata.
  - Creates/updates:
    - Subscription records
    - Transaction records
    - Letter quota or entitlement
- Webhook secret is read from environment and not logged.

### 5.3 Special Test Coupon: `TALK3`

The project includes a special discount code **`TALK3`** used for **testing**:

- When `TALK3` is used:
  - The agent must ensure the flow uses a **dummy checkout** pattern as implemented in the repo:
    - Bypasses real payment for that transaction only.
    - Still goes through the same logical flow (subscription/letter entitlement, coupon tracking).
  - All usual validations (letters quotas, coupon usage, employee commission, etc.) still occur logically.

---

## 6. Employee Coupons, Points, and Commissions

The agent must verify:

### 6.1 Coupon Assignment

- Each employee has at least one coupon code associated (via `coupons` table or similar).
- Coupon metadata correctly tracks:
  - The owning `employee_id`
  - Discount amount (e.g. 20% off)
  - Active/expired status

### 6.2 Coupon Usage Tracking

- When a subscriber uses a valid employee coupon at checkout:
  - A `coupon_usage` or equivalent record is created.
  - It records:
    - Subscriber (user) ID
    - Employee ID
    - Coupon code
    - Transaction/subscription id
    - Timestamp

### 6.3 Points and 5% Commission

- For each valid coupon use that leads to a payment (or logical dummy-checkout event):
  - The employee earns:
    - **1 point** (in `employee_metrics` or related table).
    - **5% commission** of the subscription amount (record in `commissions` table).
- The `calculate-commission` Edge Function (or equivalent logic):
  - Runs correctly and does not double-count.
  - Updates `commissions` + `employee_metrics` with accurate totals and statuses.

### 6.4 Employee Dashboard

- The Employee dashboard:
  - Displays their coupon(s).
  - Shows:
    - Number of times coupons were used.
    - Points accumulated.
    - Total commissions (pending/paid if implemented).
- Employee cannot see other employees’ data.

---

## 7. Realtime Status & UX

If Supabase Realtime is enabled:

- Confirm any live updates:
  - Letter status changes (e.g. from under review → approved).
  - Subscription status updates.
- Ensure subscribers see updated status without full reload (if the app is designed that way).
- If Realtime is partially configured, the agent should **not** invent new streams, only fix broken existing ones.

---

## 8. Build & Deployment Check

The agent must:

- Run the **development server** (e.g. `npm run dev`) to ensure:
  - No missing imports.
  - No runtime env config errors.
- Run **production build** (e.g. `npm run build`) and fail if:
  - TypeScript errors exist.
  - Next.js build issues occur.
- Confirm no unresolved:
  - Dynamic imports
  - Required environment variables
  - Edge Function deployment issues

---

## 9. Automated Fixes (Safe-only)

If issues are detected, the agent may automatically:

- Install missing dependencies (`npm install <pkg>`).
- Add **missing but clearly required** configuration files using sensible templates:
  - For example, a missing `tsconfig.json` or minimal `supabase/config.toml`.
- Fix **simple, deterministic** syntax/type errors:
  - Incorrect imports
  - Obvious null/undefined access in clearly-typed components
- Update deprecated API calls where migration is straightforward and documented.
- Generate missing database migrations **only** if:
  - The structure is clearly required by existing code and queries.
  - The change is backward compatible.
- Never:
  - Expose or log secrets.
  - Invent new routes or flows not already implied by the codebase.
  - Change role semantics (Subscriber, Employee, Admin, `is_super_user`) without explicit code references.

---

## 10. Reporting

At the end of execution, the agent must generate a concise report including:

- ✅ **Working Functionalities**
  - Auth, dashboards, AI letters, admin review, Stripe, coupons, commissions, PDFs.
- ❌ **Issues Found and Fixed**
  - What was broken, where, and how it was fixed.
- ⚠️ **Warnings / Potential Improvements**
  - Non-blocking issues, tech debt, or risky patterns spotted.
- 📋 **Manual Steps Required**
  - Items requiring human attention (e.g., set a missing env var, configure Stripe dashboard values, or run DB migrations on production).

---

## 11. Final End-to-End Verification

Once fixes and checks are done, the agent must:

1. Create a **test subscriber**, generate a letter, and confirm:
   - AI draft generated.
   - Admin can review, edit, approve.
   - Approved letter appears in subscriber **My Letters** with working PDF download.
2. Create or use a **test employee**:
   - Share their coupon.
   - Use it in a test checkout flow (including `TALK3` scenario when appropriate).
   - Validate:
     - Discount applied.
     - Letter/subscription granted.
     - Employee got 1 point + 5% commission.
3. As **admin**:
   - View:
     - Users and their letters.
     - Employees, coupon usage, and revenue/commissions.
   - Confirm that role protections and RLS prevent cross-user data leaks.

**Success Criteria:**  
All critical flows (auth, AI letter gen + admin review, subscriptions/payments, employee coupon/commission, PDFs, and dashboards) work as designed or are automatically fixed where possible. Any remaining manual steps are clearly documented.

## Environment Variables Setup

### `.env.example` (Commit to Git)

This file serves as a template. Copy it to `.env.local` for development or configure in Vercel for production.

```env
# Application URLs
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

# Stripe Configuration
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# AI Provider Configuration
OPENAI_API_KEY=

# Admin Portal Security
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_PORTAL_KEY=

# Cron Jobs
CRON_SECRET=

# Rate Limiting (Redis/Upstash)
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=
KV_URL=
REDIS_URL=
```

### `.env.local` (Add to `.gitignore` - Local Development Only)

```env
# Application URLs
NEXT_PUBLIC_APP_URL=https://www.talk-to-my-lawyer.com
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://www.talk-to-my-lawyer.com

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=[your_supabase_url]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your_supabase_anon_key]
SUPABASE_SERVICE_ROLE_KEY=[your_supabase_service_role_key]

# Stripe Configuration
STRIPE_SECRET_KEY=[your_stripe_secret_key]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=[your_stripe_publishable_key]

# AI Provider Configuration
OPENAI_API_KEY=[your_openai_api_key]

# Admin Portal Security
ADMIN_EMAIL=[your_admin_email]
ADMIN_PASSWORD=[your_admin_password]
ADMIN_PORTAL_KEY=[your_admin_portal_key]

# Cron Jobs
CRON_SECRET=[your_cron_secret]

# Rate Limiting (Redis/Upstash)
KV_REST_API_URL=[your_upstash_url]
KV_REST_API_TOKEN=[your_upstash_token]
KV_REST_API_READ_ONLY_TOKEN=[your_upstash_readonly_token]
KV_URL=[your_redis_url]
REDIS_URL=[your_redis_url]
```

### `.env.production` (Vercel Environment Variables)

For production deployment on Vercel, configure these in the Vercel dashboard under Settings → Environment Variables. Use production values for all keys.

```env
# Application URLs
NEXT_PUBLIC_APP_URL=https://www.talk-to-my-lawyer.com
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://www.talk-to-my-lawyer.com

# Supabase Configuration (Production)
NEXT_PUBLIC_SUPABASE_URL=https://nomiiqzxaxyxnxndvkbe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[production_anon_key]
SUPABASE_SERVICE_ROLE_KEY=[production_service_role_key]
SUPABASE_JWT_SECRET=[production_jwt_secret]

# Stripe Configuration (Production)
STRIPE_SECRET_KEY=[production_stripe_secret_key]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=[production_stripe_publishable_key]
STRIPE_WEBHOOK_SECRET=[production_webhook_secret]

# AI Provider Configuration (Production)
OPENAI_API_KEY=[production_openai_key]

# Admin Portal Security (Production)
ADMIN_EMAIL=[production_admin_email]
ADMIN_PASSWORD=[production_admin_password]
ADMIN_PORTAL_KEY=[production_portal_key]

# Cron Jobs (Production)
CRON_SECRET=[production_cron_secret]

# Rate Limiting (Redis/Upstash - Production)
KV_REST_API_URL=[production_kv_url]
KV_REST_API_TOKEN=[production_kv_token]
KV_REST_API_READ_ONLY_TOKEN=[production_kv_readonly_token]
KV_URL=[production_redis_url]
REDIS_URL=[production_redis_url]
```

### `.gitignore` Entry

Ensure your `.gitignore` includes:

```gitignore
# Local env files
.env*.local
.env.local
.env.development.local
.env.test.local
.env.production.local
```

### Next.js Environment Variable Loading Order

1. `.env.local` - Always loaded, ignored by git
2. `.env.production` / `.env.development` - Loaded based on NODE_ENV
3. `.env` - Default for all environments
4. `.env.example` - Template only, not loaded     



