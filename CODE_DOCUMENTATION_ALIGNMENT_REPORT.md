# Code-Documentation Alignment Report

## Summary

This report documents all discrepancies between the documented behavior and the actual code implementation in the Talk-To-My-Lawyer codebase.

**Last Updated**: December 18, 2025
**Total Issues Tracked**: 21
**Resolved**: 11
**Remaining**: 10

---

## ⚠️ NEW MISMATCHES (Found Dec 18)

### Mismatch #1: Plan Names
- **Document**: `DATABASE_FUNCTIONS.md` / `CLAUDE.md`
- **Section**: Plan Types / Pricing
- **Documented Behavior**:
    - `CLAUDE.md`: "Monthly Plan", "Yearly Plan"
    - `DATABASE_FUNCTIONS.md`: `monthly_standard`, `monthly_premium`
- **Actual Code** (`scripts/005_letter_allowance_system.sql`):
    - Uses `standard_4_month` and `premium_8_month`.
- **Fix Required**: Update documentation to match code (`standard_4_month`, `premium_8_month`) OR update code. Given "Yearly" implies 12 months, `premium_8_month` (if it means 8 letters per month?) or 8 letters per YEAR?
    - `CLAUDE.md`: "Yearly Plan: $599/year (8 letters included)" -> Total 8 letters for the whole year? Or per month?
    - `scripts/005`: `ELSIF plan = 'premium_8_month' THEN letters_to_add := 8;` (In `add_letter_allowances`)
    - `reset_monthly_allowances`: `WHEN plan_type = 'premium_8_month' THEN 8`.
    - So it resets monthly! So 8 letters *per month*?
    - `CLAUDE.md` says "8 letters included" (ambiguous if total or per month, but usually context implies per month if monthly plan is per month).
    - But price is $599/year.
    - If it resets monthly, that's 8 * 12 = 96 letters/year.
    - If it's 8 letters TOTAL for the year, `reset_monthly_allowances` SHOULD NOT include it.
    - **CRITICAL AMBIGUITY**: Does "Yearly Plan" get 8 letters *total* or 8 letters *per month*?
    - Logic in `reset_monthly_allowances` includes `premium_8_month`. So code thinks it's 8/month.
    - Docs "8 letters included" usually means total for the plan period.
    - FIX: Clarify if 8/month or 8/year.
    - **Resolution**: Assume Code is "Source of Truth" for behavior (8/month), but Naming is inconsistent. Update Docs to use `standard_4_month` etc. and clarify "8 letters/month".

### Mismatch #2: Admin Portal Location
- **Document**: `CLAUDE.md`, `PRODUCTION_CHECKLIST.md`
- **Section**: Admin Access
- **Documented Behavior**: Admin portal is at `/secure-admin-gateway`.
- **Actual Code**: `app/dashboard/layout.tsx` links to `/dashboard/admin`.
- **Investigation Needed**: Check if `/secure-admin-gateway` exists. If not, Docs are outdated. If it does, `dashboard/admin` might be a legacy or duplicate route.
- **Security Implication**: `/secure-admin-gateway` implies strict separate auth. `/dashboard/admin` might be integrated with standard user auth (Supabase Auth).
    - `lib/auth/admin-session.ts` supports `portalKey`, which suggests the strict auth is implemented.
    - We need to confirm WHICH route uses `admin-session.ts`.

### Mismatch #3: TypeScript Usage
- **Document**: `CLAUDE.md`
- **Section**: Common Gotchas
- **Documented Behavior**: "Use types from `lib/database.types.ts`, no `any`"
- **Actual Code**: `app/dashboard/layout.tsx` uses `useState<any>(null)`.
- **Fix Required**: Update code to use `Profile` type.

### Mismatch #4: Client-Side Layout Authorization
- **Document**: `CLAUDE.md` (Implicit in Role Authorization)
- **Actual Code**: `app/dashboard/layout.tsx` hides links but doesn't strictly redirect unauthorized users (server-side check likely exists but client-side could be stricter).

### Mismatch #5: Plan Pricing vs Letter Count
- **Document**: `CLAUDE.md` says "Yearly Plan: $599/year (8 letters included)".
- **Actual Code**: `app/api/create-checkout/route.ts` says `premium_8_month` has `letters: 8`.
- **Ambiguity**: Is it 8 total or 8 per month?
    - `reset_monthly_allowances` resets `premium_8_month` to 8. This implies 8 PER MONTH.
    - If 8 per month, then 96 letters/year.
    - Value proposition: $599 / 96 = ~$6/letter.
    - Documentation "8 letters included" sounds like "Total 8".
    - **Recommendation**: Clarify Docs to "8 letters per month".

### Mismatch #6: Admin Dashboard Security
- **Document**: `CLAUDE.md` ("Role Authorization")
- **Actual Code**: `app/dashboard/admin/page.tsx`
- **Issue**: The dashboard page fetches data without explicitly verifying if the current user is an admin.
- **Risk**: While RLS might protect the *data*, the *page structure* is accessible to anyone.
- **Fix Required**: Add `if (profile.role !== 'admin') redirect('/')` or similar check.

---

## ✅ RESOLVED ISSUES (Historical)

### MISMATCH #1: ✅ RESOLVED

- **Document**: CLAUDE.md
- **Section**: Package Manager
- **Original Issue**: Documented "npm" but pnpm was being used
- **Resolution**: CLAUDE.md updated to correctly state "pnpm" as package manager
- **Status**: ✅ FIXED

### MISMATCH #3: ✅ RESOLVED

- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Function `log_letter_audit`
- **Original Issue**: API endpoint `/api/letters/[id]/start-review` did not exist
- **Resolution**: Endpoint created at `/app/api/letters/[id]/start-review/route.ts`
- **File Location**: /app/api/letters/[id]/start-review/route.ts
- **Status**: ✅ FIXED

### MISMATCH #4: ✅ RESOLVED

- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Function `add_letter_allowances`
- **Original Issue**: Function was documented but not implemented
- **Resolution**: Function added in migration script
- **File Location**: /scripts/016_add_missing_tables_and_functions.sql (lines 33-82)
- **Status**: ✅ FIXED

---

### MISMATCH #5: ✅ RESOLVED

- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Function `validate_coupon`
- **Original Issue**: Function was documented but not implemented
- **Resolution**: Function added in migration script
- **File Location**: /scripts/016_add_missing_tables_and_functions.sql (lines 85-112)
- **Status**: ✅ FIXED

---

### MISMATCH #6: ✅ RESOLVED

- **Document**: CLAUDE.md
- **Section**: Project Structure
- **Original Issue**: Documentation incorrectly stated admin pages at `/dashboard/admin/`
- **Resolution**: CLAUDE.md correctly documents admin portal at `/secure-admin-gateway/`
- **Status**: ✅ FIXED

---

### MISMATCH #7: ✅ VERIFIED (No Issue)

- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Function `reset_monthly_allowances`
- **Documented Behavior**: Returns VOID
- **Actual Code**: Function exists and returns VOID as documented
- **File Location**: /scripts/005_letter_allowance_system.sql
- **Status**: ✅ NO ISSUE - Matches correctly

---

### MISMATCH #8: ✅ VERIFIED (No Issue)

- **Document**: Multiple locations
- **Section**: Environment variables
- **Documented Behavior**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is the correct name
- **Actual Code**: Code uses `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` correctly
- **Status**: ✅ NO ISSUE - Matches correctly

---

### MISMATCH #9: ✅ RESOLVED

- **Document**: .env.example
- **Section**: Environment variables
- **Original Issue**: Listed `RESEND_API_KEY` for email but no implementation existed
- **Resolution**: Email functionality implemented with multiple providers
- **File Locations**:
   - /lib/email/service.ts
   - /lib/email/providers/brevo.ts
   - /lib/email/providers/sendgrid.ts
   - /lib/email/providers/console.ts
- **Status**: ✅ FIXED - Brevo email provider implemented

---

### MISMATCH #10: ✅ RESOLVED

- **Document**: DATABASE_FUNCTIONS.md
- **Section**: coupon_usage table
- **Original Issue**: Table was referenced but did not exist
- **Resolution**: Table created in migration scripts
- **File Locations**:
   - /scripts/016_add_coupon_usage_table.sql
   - /scripts/016_add_missing_tables_and_functions.sql
- **Status**: ✅ FIXED

---

### MISMATCH #11: ✅ RESOLVED

- **Document**: CLAUDE.md
- **Section**: Security Best Practices
- **Original Issue**: Rate limiting documented but not implemented
- **Resolution**: Rate limiting fully implemented
- **File Locations**:
   - /lib/rate-limit.ts (in-memory rate limiter)
   - /lib/rate-limit-redis.ts (Redis-based rate limiter)
   - /docs/RATE_LIMITING.md (documentation)
- **Implemented Limiters**:
   - `letterGenerationRateLimit`: 5 letters per hour
   - `authRateLimit`: 5 attempts per 15 minutes
   - `apiRateLimit`: 100 requests per minute
   - `adminRateLimit`: 10 requests per 15 minutes
- **Status**: ✅ FIXED

---

### MISMATCH #14: ✅ VERIFIED (No Issue)

- **Document**: DATABASE_FUNCTIONS.md
- **Section**: `get_employee_coupon` function
- **Documented Behavior**: Function exists to get employee coupon info
- **Actual Code**: Function exists in database
- **File Location**: /scripts/008_employee_coupon_auto_generation.sql
- **Status**: ✅ NO ISSUE - Matches correctly

---

### MISMATCH #15: ✅ VERIFIED (No Issue)

- **Document**: PRODUCTION_CHECKLIST.md
- **Section**: Environment variables
- **Documented Behavior**: `CRON_SECRET` required for monthly reset
- **Actual Code**: Cron job endpoint exists at `/api/subscriptions/reset-monthly`
- **File Location**: /app/api/subscriptions/reset-monthly/route.ts
- **Status**: ✅ NO ISSUE - Matches correctly

---

## ⚠️ REMAINING ISSUES (From Remote Scan)

### MISMATCH #2 OLD: ⚠️ DESIGN CLARIFICATION NEEDED

- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Letter Status Flow (lines 11-22)
- **Documented Behavior**: Status flow shows `approved` as legacy status to be replaced by `completed`
- **Actual Code**: Both `approved` AND `completed` statuses are used intentionally:
  - `approved` = Admin has approved the letter
  - `completed` = Letter has been sent/downloaded (final state)
- **Current Flow**: `pending_review` → `under_review` → `approved` → `completed`
- **File Location**: /lib/database.types.ts (LetterStatus type includes both)
- **Action Required**: Update DATABASE_FUNCTIONS.md to clarify the two-step approval/completion workflow
- **Priority**: Medium

---

### MISMATCH #12: ⚠️ PARTIAL IMPLEMENTATION

- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Audit logging
- **Issue**: Not all status transitions are fully logged
- **Missing Audit Logs**:
  - `draft` → `generating` transition in `/app/api/generate-letter/route.ts`
- **Implemented Audit Logs**:
  - ✅ `start-review` logs `review_started`
  - ✅ `approve` logs approval
  - ✅ `reject` logs rejection
- **Action Required**: Add audit logging to generate-letter route for draft→generating transition
- **Priority**: Low (non-critical, letter creation is tracked)

---

### MISMATCH #13: ⚠️ VERIFICATION NEEDED

- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Security hardening
- **Issue**: Search path changes implemented but need production verification
- **Migration Scripts Present**:
  - /scripts/012_fix_search_path_add_letter_allowances.sql
  - /scripts/013_fix_search_path_handle_new_user.sql
  - /scripts/014_fix_all_search_paths.sql
  - /scripts/015_all_search_paths_final.sql
- **Action Required**: Verify all migrations have been applied to production database
- **Priority**: High (security-related)

---

### MISMATCH #16: ⚠️ NEW - TYPE DEFINITION GAP

- **Document**: DATABASE_ALIGNMENT_REPORT.md
- **Section**: Type definitions
- **Issue**: CouponUsage type not defined in database.types.ts
- **Current State**: `coupon_usage` table exists but TypeScript type is missing
- **File Location**: /lib/database.types.ts
- **Action Required**: Add CouponUsage interface to database.types.ts
- **Priority**: Low (functionality works, just missing type)
