# Inconsistent Plan Type Naming Across Codebase

## Priority
🔧 **LOW**

## Labels
`bug`, `low-priority`, `technical-debt`, `data-consistency`

## Description
Plan types use inconsistent naming conventions across different parts of the codebase, creating potential bugs when matching plans between checkout, webhook processing, and database records.

## Inconsistencies Found

### Code Uses:
```typescript
// checkout/route.ts, webhook/route.ts
plan_type: 'one_time'
plan_type: 'standard_4_month'
plan_type: 'premium_8_month'
```

### Migrations Use:
```sql
-- scripts/009_add_missing_subscription_fields.sql
UPDATE subscriptions SET plan_type = 'monthly_standard'
UPDATE subscriptions SET plan_type = 'monthly_premium'
```

### Database May Contain:
- `one_time`
- `standard_4_month`
- `premium_8_month`
- `monthly_standard` (from old migration)
- `monthly_premium` (from old migration)

## Problems

### 1. Query Failures
```typescript
// This might not find subscriptions created by old migrations
const subs = await supabase
  .from('subscriptions')
  .eq('plan_type', 'standard_4_month') // But DB has 'monthly_standard'
```

### 2. Analytics Broken
```typescript
// Counting "standard" plans
const count = await supabase
  .from('subscriptions')
  .select('*', { count: 'exact' })
  .eq('plan_type', 'standard_4_month')
// Misses 'monthly_standard' records
```

### 3. Webhook Processing
If old subscriptions renew, Stripe metadata might have old plan type:
```typescript
const planType = metadata.plan_type // 'monthly_standard'
// Update logic expects 'standard_4_month'
```

## Recommended Fix

### Step 1: Define Source of Truth

**Decision**: Use descriptive names from current code (better UX)
- `one_time` (single letter purchase)
- `standard_4_month` (4 letters over 4 months)
- `premium_8_month` (8 letters over 8 months)

### Step 2: Create Type Definition
```typescript
// lib/types/subscription.ts
export const PLAN_TYPES = {
  ONE_TIME: 'one_time',
  STANDARD: 'standard_4_month',
  PREMIUM: 'premium_8_month'
} as const

export type PlanType = typeof PLAN_TYPES[keyof typeof PLAN_TYPES]
```

### Step 3: Data Migration
```sql
-- scripts/015_normalize_plan_types.sql

-- Update old naming to new naming
UPDATE subscriptions
SET plan_type = 'standard_4_month'
WHERE plan_type IN ('monthly_standard', 'standard', 'monthly_4');

UPDATE subscriptions
SET plan_type = 'premium_8_month'
WHERE plan_type IN ('monthly_premium', 'premium', 'monthly_8');

-- Ensure no orphaned plan types
DO $$
DECLARE
  invalid_types TEXT[];
BEGIN
  SELECT ARRAY_AGG(DISTINCT plan_type) INTO invalid_types
  FROM subscriptions
  WHERE plan_type NOT IN ('one_time', 'standard_4_month', 'premium_8_month');

  IF invalid_types IS NOT NULL THEN
    RAISE EXCEPTION 'Found invalid plan types: %', invalid_types;
  END IF;
END $$;
```

### Step 4: Add Database Constraint (Optional)
```sql
-- Create ENUM type for safety
CREATE TYPE plan_type_enum AS ENUM (
  'one_time',
  'standard_4_month',
  'premium_8_month'
);

-- Convert column to ENUM
ALTER TABLE subscriptions
ALTER COLUMN plan_type TYPE plan_type_enum
USING plan_type::plan_type_enum;
```

### Step 5: Update All Code References
```typescript
// ❌ Before - hardcoded strings
if (subscription.plan_type === 'standard_4_month') { }

// ✅ After - use constant
import { PLAN_TYPES } from '@/lib/types/subscription'
if (subscription.plan_type === PLAN_TYPES.STANDARD) { }
```

### Step 6: Update Stripe Product Metadata
Ensure Stripe products have correct metadata:
```typescript
// In Stripe Dashboard or via API
product.metadata.plan_type = 'standard_4_month'
```

## Files to Update
- [ ] `app/api/create-checkout/route.ts`
- [ ] `app/api/stripe/webhook/route.ts`
- [ ] `scripts/009_add_missing_subscription_fields.sql`
- [ ] Any analytics or reporting queries
- [ ] Dashboard components displaying plan names
- [ ] Email templates mentioning plan types

## Testing Strategy
1. Create new subscription → verify correct plan_type
2. Process webhook → verify plan_type matches
3. Query existing subscriptions → verify all found
4. Analytics dashboard → verify counts correct
5. Test with each plan type

## Acceptance Criteria
- [ ] Single source of truth for plan type values
- [ ] All database records normalized
- [ ] TypeScript constants used instead of magic strings
- [ ] Database constraint prevents invalid values (optional)
- [ ] Stripe metadata updated
- [ ] All queries return expected results
- [ ] Tests confirm consistency
- [ ] Documentation updated with plan types
