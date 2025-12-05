# Outdated Migration Comments for Plan Types

## Priority
🔧 **LOW**

## Labels
`documentation`, `low-priority`, `technical-debt`, `migrations`

## Description
The migration script `009_add_missing_subscription_fields.sql` updates `plan_type` to `monthly_standard` and `monthly_premium`, but the checkout code uses different values (`standard_4_month`, `premium_8_month`). The migration comments and implementation are outdated and inconsistent with current usage.

## Location
- **File**: `scripts/009_add_missing_subscription_fields.sql`
- **Lines**: 14-20

## Current Migration Code
```sql
-- Update plan types to standardized values
UPDATE subscriptions
SET plan_type = 'monthly_standard'
WHERE plan_type IN ('standard', 'standard_monthly', '4_month');

UPDATE subscriptions
SET plan_type = 'monthly_premium'
WHERE plan_type IN ('premium', 'premium_monthly', '8_month');
```

## Actual Application Code
```typescript
// app/api/create-checkout/route.ts
const planType = formData.get('planType')  // 'standard_4_month' or 'premium_8_month'

await supabase.from('subscriptions').insert({
  plan_type: planType  // 'standard_4_month', not 'monthly_standard'
})
```

## Problem
- Migration creates records with `monthly_standard`
- New code creates records with `standard_4_month`
- Database now has mixed values:
  - Old: `monthly_standard`, `monthly_premium`
  - New: `standard_4_month`, `premium_8_month`
  - Maybe even: `standard`, `premium` (from before migration)

## Impact

### 1. Query Failures
```typescript
// Looking for standard plan
const subs = await supabase
  .from('subscriptions')
  .eq('plan_type', 'standard_4_month')

// Misses records with 'monthly_standard' ❌
```

### 2. Analytics Broken
```sql
-- Revenue by plan
SELECT plan_type, COUNT(*), SUM(amount)
FROM subscriptions
GROUP BY plan_type;

-- Results:
-- monthly_standard    | 23  | $1150
-- standard_4_month    | 45  | $2250
-- These are the SAME PLAN! ❌
```

### 3. Confusion for Developers
```typescript
// Developer sees two different values in database
// Which one should I use?
// Are these different plans?
```

## Recommended Fix

### Step 1: Decide on Canonical Values
**Recommended:** Use descriptive current values
- `one_time` (single letter)
- `standard_4_month` (4 letters over 4 months)
- `premium_8_month` (8 letters over 8 months)

### Step 2: Update Migration to Match
```sql
-- scripts/009_add_missing_subscription_fields.sql (UPDATED)

-- Normalize all plan type values to canonical names
UPDATE subscriptions
SET plan_type = 'standard_4_month'
WHERE plan_type IN (
  'standard',
  'standard_monthly',
  'monthly_standard',  -- Old migration value
  '4_month',
  'standard_4'
);

UPDATE subscriptions
SET plan_type = 'premium_8_month'
WHERE plan_type IN (
  'premium',
  'premium_monthly',
  'monthly_premium',  -- Old migration value
  '8_month',
  'premium_8'
);

UPDATE subscriptions
SET plan_type = 'one_time'
WHERE plan_type IN (
  'single',
  'one_letter',
  'onetime'
);

-- Verify no unexpected values remain
DO $$
DECLARE
  unexpected_count INT;
BEGIN
  SELECT COUNT(*) INTO unexpected_count
  FROM subscriptions
  WHERE plan_type NOT IN ('one_time', 'standard_4_month', 'premium_8_month');

  IF unexpected_count > 0 THEN
    RAISE WARNING 'Found % subscriptions with unexpected plan_type values', unexpected_count;
    -- Log them for manual review
    RAISE NOTICE 'Unexpected values: %', (
      SELECT string_agg(DISTINCT plan_type, ', ')
      FROM subscriptions
      WHERE plan_type NOT IN ('one_time', 'standard_4_month', 'premium_8_month')
    );
  END IF;
END $$;
```

### Step 3: Update Migration Comments
```sql
-- scripts/009_add_missing_subscription_fields.sql

-- Purpose: Add missing fields and normalize plan_type values
-- This migration:
-- 1. Adds remaining_letters column
-- 2. Normalizes plan_type to canonical values:
--    - 'one_time': Single letter purchase
--    - 'standard_4_month': 4 letters over 4 months ($49.99)
--    - 'premium_8_month': 8 letters over 8 months ($79.99)
-- 3. Backfills remaining_letters based on plan_type

-- NOTE: Any code referencing plan_type should use these exact values
```

### Step 4: Create New Migration (If 009 Already Run)
```sql
-- scripts/019_normalize_plan_types.sql

-- Fix inconsistent plan_type values from migration 009

-- Update old 'monthly_*' values to current naming
UPDATE subscriptions
SET plan_type = 'standard_4_month'
WHERE plan_type = 'monthly_standard';

UPDATE subscriptions
SET plan_type = 'premium_8_month'
WHERE plan_type = 'monthly_premium';

-- Verify consistency
DO $$
DECLARE
  plan_types TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT plan_type) INTO plan_types
  FROM subscriptions;

  RAISE NOTICE 'Current plan types in database: %', plan_types;

  -- All should be one of the three canonical values
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE plan_type NOT IN ('one_time', 'standard_4_month', 'premium_8_month')
  ) THEN
    RAISE EXCEPTION 'Database still has non-canonical plan_type values';
  END IF;
END $$;
```

## Update Documentation

### CLAUDE.md
```markdown
## Subscription Plan Types

The application supports three plan types:

| plan_type | Description | Credits | Duration | Price |
|-----------|-------------|---------|----------|-------|
| `one_time` | Single letter purchase | 1 | N/A | $49.99 |
| `standard_4_month` | Standard subscription | 4 | 4 months | $49.99 |
| `premium_8_month` | Premium subscription | 8 | 8 months | $79.99 |

**IMPORTANT:** Always use these exact values. Legacy values like `monthly_standard` are deprecated.

### Code Example
\`\`\`typescript
const planType = 'standard_4_month'  // ✅ Correct

const planType = 'monthly_standard'  // ❌ Deprecated
\`\`\`
```

## Verification Script

Create a verification script to check for inconsistencies:

```sql
-- scripts/verify_plan_types.sql

-- Check for any non-canonical plan types
SELECT
  plan_type,
  COUNT(*) as count,
  CASE
    WHEN plan_type IN ('one_time', 'standard_4_month', 'premium_8_month') THEN '✅ Valid'
    ELSE '❌ Invalid'
  END as status
FROM subscriptions
GROUP BY plan_type
ORDER BY count DESC;

-- Check if Stripe metadata matches
SELECT
  s.plan_type as db_plan_type,
  s.stripe_price_id,
  COUNT(*) as count
FROM subscriptions s
WHERE s.stripe_price_id IS NOT NULL
GROUP BY s.plan_type, s.stripe_price_id;
```

## Acceptance Criteria
- [ ] Migration updated with canonical plan type values
- [ ] Comments accurately describe plan types and values
- [ ] All existing data normalized to canonical values
- [ ] No mixed plan type values in database
- [ ] Documentation updated with current values
- [ ] Verification script confirms consistency
- [ ] Stripe metadata matches database values
- [ ] Code search confirms no hardcoded old values
- [ ] Analytics queries return accurate results
