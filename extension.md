You already built this app for me — the full working project and the Supabase schema are available in this repository.

Do NOT rebuild the project or change the stack. Extend the existing implementation.

---

1. BASE CONTEXT (USE THESE AS FACT)

---

Tech stack:

- Next.js App Router (TypeScript, SSR, Server Actions)
- Supabase (Auth, PostgreSQL, RLS, Edge Functions)
- Stripe for payments/subscriptions
- Gemini AI via a Supabase Edge Function for letter generation

File structure (from this repo, do not assume another):

- Main app routes under `/app`
- Subscriber/employee dashboards under `/app/dashboard/...`
- Secure admin portal under `/app/secure-admin-gateway/...`
- Supabase helpers under `/lib/supabase/...`
- Auth helpers under `/lib/auth/...`
- Components under `/components/...`
- Migrations under `/supabase/migrations/*.sql`

The existing schema (see the files under `supabase/migrations/*.sql`) already defines at least these tables:

- `profiles`
- `letters`
- `letter_audit_trail`
- `subscriptions`
- `commissions`
- `employee_coupons`
- `coupon_usage`
- `security_audit_log`
- `security_config`

Do NOT drop, recreate, or rename these tables. Only extend behavior using new migrations and code. Keep their existing columns and semantics intact.

---

2. ALIGN WITH CURRENT SECURE ADMIN PORTAL

---

You previously implemented a secure admin gateway with:

- Admin login at `/secure-admin-gateway/login`
- Dual authentication: email/password + portal key
- Separate admin session handling (short timeout, isolated from normal users)
- Middleware protection for admin routes
- A dark-themed admin dashboard under `/secure-admin-gateway/dashboard`
- Environment variables for admin credentials and portal key

All of that must remain as-is. Do not weaken this design.

From now on:

- The ONLY admin entry point is `/secure-admin-gateway/login`.
- Admins are NOT created via public signup.
- Admin behavior is layered on top of this secure portal.

---

3. ROLES & ACCESS MODEL (USING EXISTING COLUMNS)

---

Use `profiles.role` and `profiles.is_super_user` from the existing schema.

Standardize behavior to:

- `role = 'subscriber'`

  - Normal end-users.
  - Land on `/dashboard`.
  - Can create and view ONLY their own letters.

- `role = 'employee'`

  - Employee/affiliate.
  - Use existing employee views under `/dashboard`:
    - Commissions tab
    - Coupons tab

- `role = 'admin'`
  - Administrator / owner.
  - Can log in via the secure admin gateway.
  - After login, they are directed to the Review Center.
  - Full access to all admin portal features: review management, analytics, commissions, and configuration.

Admins are NOT created via signup. They are seeded in the database or configured directly.
There is only ONE admin account.

---

4. ROLE-AWARE ROUTING & SESSION LOGIC

---

Using the existing middleware and session system:

- The middleware in `/lib/supabase/middleware.ts` enforces:

  - Normal users and employees cannot access `/secure-admin-gateway/*`.
  - Admin sessions (created by secure admin login) are required for `/secure-admin-gateway/*`.
  - All authenticated admins are routed to `/secure-admin-gateway/review` after login.

- Reuse the admin session helpers in `/lib/auth/admin-session.ts`. There is a single admin model with no internal super-admin distinction.

---

5. ADMIN REVIEW CENTER (MULTI-ADMIN LETTER REVIEW)

---

Create or extend an admin “Review Center” under the secure portal. Use new routes inside `/app/secure-admin-gateway/`:

- `app/secure-admin-gateway/review/page.tsx`

  - Shows a list or table of letters that need review (e.g., `status = 'pending_review'`).
  - Each row should display:
    - Letter title
    - User/subscriber name or email
    - Created date
    - Current status
    - Link or button to open the detailed view

- `app/secure-admin-gateway/review/[id]/page.tsx`
  - Shows full details for a specific letter:
    - Subscriber info (from `profiles`)
    - Intake data (from `letters.intake_data` or similar)
    - AI-generated draft content
    - Editable field for admin-edited content
  - Provide two main actions:
    - “Approve” → update the letter status to an approved status and commit the final text
    - “Reject” → update the letter status to a rejected status
  - For each approve / reject action:
    - Insert a row into `letter_audit_trail` referencing:
      - `letter_id`
      - `performed_by` (current admin)
      - `old_status`
      - `new_status`
      - optional notes / metadata

This Review Center must:

- Only be accessible to admins (`role = 'admin'`).
- Respect the secure admin session.
- Use the existing Supabase helpers and types from the project.
- Integrate visually with the existing dark admin UI you already built.

---

