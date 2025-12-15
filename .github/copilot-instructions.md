diff --git a/.github/copilot-instructions.md b/.github/copilot-instructions.md
index 4f3f2d1..c9a3c61 100644
--- a/.github/copilot-instructions.md
+++ b/.github/copilot-instructions.md
@@ -14,16 +14,21 @@ User → Letter Form → AI Draft (GPT-4 Turbo) → Admin Review → Approved PDF
Next.js 16 (App Router, React 19) | Supabase (Postgres + RLS) | OpenAI via Vercel AI SDK | Stripe | pnpm

## Role Authorization (Critical)

| Role         | Access                    | Constraint                          |
| ------------ | ------------------------- | ----------------------------------- | -------------------------------------------------- |
| `subscriber` | Own letters, subscription | First letter free, then credits     |
| `employee`   | Own coupons, commissions  | **NO letter access** (RLS enforced) |
| -            | `admin`                   | `/secure-admin-gateway/*`           | Env-based auth + portal key                        |
| +            | `admin`                   | `/secure-admin-gateway/*`           | **Single Admin only**. Env-based auth + portal key |

-> ⚠️ `is_super_user` = unlimited letters, NOT admin privilege
+### Single Admin Model (Critical)

- +- There is **exactly ONE admin account** responsible for:
- - **Reviewing, editing/improving, approving/rejecting** letters
- - Managing the **admin dashboard analytics**
    +- Admin access is **only** via `/secure-admin-gateway/*` (separate portal session).
- +> ⚠️ `is_super_user` = unlimited letters, NOT admin privilege
  ## Supabase Client Pattern
  ```typescript
  // Server (API routes, server components)
  @@ -86,7 +91,7 @@ Always audit status changes:
  - UI: shadcn/ui from `@/components/ui/*`, toast via `sonner`
  - Admin routes: Verify with `isAdminAuthenticated()` from `lib/auth/admin-session.ts`

  ## Routes & Endpoints (Purpose + Role)

  ```

@@ -119,7 +124,7 @@ Always audit status changes:

**Secure Admin Portal (separate auth system)**

- `/secure-admin-gateway/login` - portal login (email/password + portal key)
  -- `/secure-admin-gateway/dashboard` - admin portal dashboard
  +- `/secure-admin-gateway/dashboard` - **single admin** dashboard (includes analytics)
- `/secure-admin-gateway/review` - review center
- `/secure-admin-gateway/review/[id]` - review a letter
- `/secure-admin-gateway/dashboard/letters` - review queue (admin only)
- `/secure-admin-gateway/dashboard/analytics` - analytics (admin only)
- `/secure-admin-gateway/dashboard/commissions` - commissions (admin only)
