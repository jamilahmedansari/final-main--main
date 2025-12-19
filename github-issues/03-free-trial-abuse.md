# Free Trial Abuse: Infinite Letter Generation

## Priority
🚨 **HIGH**

## Labels
`bug`, `security`, `high-priority`, `business-logic`

## Description
Free trial letters skip credit deduction, but there's no tracking to prevent abuse. Users can delete their free letter and regenerate infinitely without ever subscribing.

## Location
- **File**: `app/api/generate-letter/route.ts`
- **Lines**: 125-146

## Current Behavior
```typescript
// Free trial - skip deduction
if (allowanceCheck.has_allowance && letterCount === 0) {
  // Generate letter without deducting credit
}
```

The check only looks at `letterCount === 0`, which counts existing letters, not historical usage.

## Attack Vector
1. User signs up
2. Generates free letter
3. Deletes letter from dashboard (if deletion exists) OR letter stays in draft
4. `letterCount` returns to 0
5. Generates another free letter
6. Repeat infinitely

## Impact
- Unlimited free usage
- No subscription conversions
- Business model completely bypassed
- AI generation costs without revenue

## Recommended Fix

**Option 1: Track Free Trial Usage**
```sql
ALTER TABLE profiles ADD COLUMN free_trial_used_at TIMESTAMP;
```
```typescript
if (!profile.free_trial_used_at && letterCount === 0) {
  // Allow free trial
  // Mark free_trial_used_at = NOW()
}
```

**Option 2: Count All Letters (Including Deleted)**
```typescript
const { count: totalLetterCount } = await supabase
  .from('letters')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', user.id)
  // Don't filter by status - count ALL historical letters
```

## Acceptance Criteria
- [ ] Free trial can only be used once per account
- [ ] Deleted letters don't reset free trial eligibility
- [ ] Audit trail shows free trial usage timestamp
- [ ] Edge cases tested (concurrent free trial attempts)
