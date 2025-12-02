# Code-Documentation Alignment Report

## Summary
This report documents all discrepancies between the documented behavior and the actual code implementation in the Talk-To-My-Lawyer codebase.

---

## MISMATCH #1:
- **Document**: CLAUDE.md
- **Section**: Package Manager (line 40)
- **Documented Behavior**: "Package Manager: npm"
- **Actual Code**: package-lock.json and pnpm-lock.yaml both exist, pnpm is being used
- **File Location**: /root/.vscode-server-insiders/data/main-main--2-/
- **Line Numbers**: N/A
- **Fix Required**: Update CLAUDE.md to reflect pnpm as the package manager

---

## MISMATCH #2:
- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Letter Status Flow (lines 11-22)
- **Documented Behavior**: Status flow includes `approved` as a legacy status
- **Actual Code**: Code still references `approved` status in multiple places
- **File Location**: Multiple files including letter components and API routes
- **Line Numbers**: Various
- **Fix Required**: Update code to use `completed` instead of `approved` consistently

---

## MISMATCH #3:
- **Document**: DATABASE_FUNCTIONS.md
- **Section`: Function `log_letter_audit` (lines 75-77)
- **Documented Behavior**: Called by `/api/letters/[id]/start-review`, `/api/letters/[id]/approve`, `/api/letters/[id]/reject`
- **Actual Code**: API endpoint `/api/letters/[id]/start-review` does not exist
- **File Location**: /app/api/letters/[id]/
- **Line Numbers**: N/A
- **Fix Required**: Create the missing start-review endpoint or update documentation

---

## MISMATCH #4:
- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Function `add_letter_allowances` (documented but not implemented)
- **Documented Behavior**: Function exists to add letter credits
- **Actual Code**: Function is not in the database schema
- **File Location**: /scripts/
- **Line Numbers**: N/A
- **Fix Required**: Create migration script to add this function

---

## MISMATCH #5:
- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Function `validate_coupon` (documented)
- **Documented Behavior**: Function exists to validate employee coupons
- **Actual Code**: Function is not in the database schema
- **File Location**: /scripts/
- **Line Numbers**: N/A
- **Fix Required**: Create migration script to add this function

---

## MISMATCH #6:
- **Document**: CLAUDE.md
- **Section`: Project Structure (lines 61-65)
- **Documented Behavior**: Admin pages at `/dashboard/admin/`
- **Actual Code**: Admin portal is at `/secure-admin-gateway/`
- **File Location**: /app/
- **Line Numbers**: N/A
- **Fix Required**: Update documentation to reflect correct admin portal location

---

## MISMATCH #7:
- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Function `reset_monthly_allowances`
- **Documented Behavior**: Returns VOID
- **Actual Code**: Function exists and returns VOID as documented
- **File Location**: /scripts/005_letter_allowance_system.sql
- **Line Numbers**: Around line 150
- **Fix Required**: None - this matches correctly

---

## MISMATCH #8:
- **Document**: Multiple locations
- **Section**: Environment variables
- **Documented Behavior**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is the correct name
- **Actual Code**: Code uses `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` correctly
- **File Location**: /app/api/create-checkout/route.ts
- **Line Numbers**: Line 14
- **Fix Required**: None - this matches correctly

---

## MISMATCH #9:
- **Document**: .env.example
- **Section**: Environment variables
- **Documented Behavior**: Lists `RESEND_API_KEY` for email functionality
- **Actual Code**: No email sending implementation exists
- **File Location**: /app/api/
- **Line Numbers**: N/A
- **Fix Required**: Implement email functionality or remove RESEND_API_KEY from docs

---

## MISMATCH #10:
- **Document**: DATABASE_FUNCTIONS.md
- **Section`: coupon_usage table (referenced multiple times)
- **Documented Behavior**: Table exists for tracking coupon usage
- **Actual Code**: Table does not exist in database schema
- **File Location**: /scripts/001_setup_schema.sql
- **Line Numbers**: N/A
- **Fix Required**: Create migration to add coupon_usage table

---

## MISMATCH #11:
- **Document**: CLAUDE.md
- **Section**: Security Best Practices
- **Documented Behavior**: "Rate limiting: Letter generation: 5 per 15 minutes"
- **Actual Code**: No rate limiting implementation found
- **File Location**: /app/api/
- **Line Numbers**: N/A
- **Fix Required**: Implement rate limiting middleware

---

## MISMATCH #12:
- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Audit logging
- **Documented Behavior**: All letter status changes should be logged
- **Actual Code`: Not all status transitions are logged (e.g., draft → generating)
- **File Location**: /app/api/generate-letter/route.ts
- **Line Numbers**: N/A
- **Fix Required**: Add audit logging to all letter status changes

---

## MISMATCH #13:
- **Document**: DATABASE_FUNCTIONS.md
- **Section**: Security hardening
- **Documented Behavior**: Search path changes implemented for security
- **Actual Code**: Multiple migration scripts (012-015) exist for search path fixes
- **File Location**: /scripts/
- **Line Numbers**: Various
- **Fix Required**: Verify all migrations have been applied to production

---

## MISMATCH #14:
- **Document**: DATABASE_FUNCTIONS.md
- **Section**: `get_employee_coupon` function (documented)
- **Documented Behavior**: Function exists to get employee coupon info
- **Actual Code**: Function exists in database
- **File Location**: /scripts/008_employee_coupon_auto_generation.sql
- **Line Numbers**: Around line 50
- **Fix Required**: None - this matches correctly

---

## MISMATCH #15:
- **Document**: PRODUCTION_CHECKLIST.md
- **Section**: Environment variables
- **Documented Behavior**: `CRON_SECRET` required for monthly reset
- **Actual Code**: Cron job endpoint exists at `/api/subscriptions/reset-monthly`
- **File Location**: /app/api/subscriptions/reset-monthly/route.ts
- **Line Numbers**: N/A
- **Fix Required**: None - this matches correctly

---

## Priority Fixes Required:

### Critical (Must Fix Before Production):
1. **MISMATCH #10** - Create coupon_usage table
2. **MISMATCH #3** - Create `/api/letters/[id]/start-review` endpoint
3. **MISMATCH #11** - Implement rate limiting
4. **MISMATCH #6** - Update admin portal documentation

### High Priority:
5. **MISMATCH #4** - Add `add_letter_allowances` function
6. **MISMATCH #5** - Add `validate_coupon` function
7. **MISMATCH #12** - Complete audit logging implementation

### Medium Priority:
8. **MISMATCH #1** - Update package manager documentation
9. **MISMATCH #2** - Standardize status usage (approved vs completed)
10. **MISMATCH #9** - Implement email or remove RESEND_API_KEY

---

## Recommendations:

1. **Create Missing API Endpoints**: Implement all documented API endpoints
2. **Add Missing Database Functions**: Create migrations for missing functions
3. **Complete Security Implementation**: Add rate limiting and complete audit logging
4. **Update Documentation**: Ensure all documentation reflects actual implementation
5. **Standardize Naming**: Use consistent naming conventions throughout
6. **Test All Features**: Verify all documented features work as expected

---

**Last Updated**: December 2025
**Total Mismatches Found**: 15
**Critical Issues**: 4
**High Priority**: 3
**Medium Priority**: 3