# Missing ENUM Type for plan_type Column

## Priority
🔧 **LOW**

## Labels
`database`, `low-priority`, `data-integrity`, `enhancement`

## Description
The `plan_type` column is stored as TEXT without an ENUM constraint, allowing invalid values to be inserted. This can cause bugs when querying or filtering subscriptions by plan type.

## Current Schema
```sql
CREATE TABLE subscriptions (
  -- ...
  plan_type TEXT,  -- ❌ Any string allowed
  -- ...
)
```

## Problems

### 1. Data Integrity
```sql
-- All of these would be accepted:
INSERT INTO subscriptions (plan_type) VALUES ('standard_4_month');  -- ✅ Valid
INSERT INTO subscriptions (plan_type) VALUES ('premium');           -- ❌ Typo
INSERT INTO subscriptions (plan_type) VALUES ('STANDARD_4_MONTH');  -- ❌ Wrong case
INSERT INTO subscriptions (plan_type) VALUES ('foo');               -- ❌ Nonsense
```

### 2. Query Issues
```typescript
// Might miss records with typos
const subs = await supabase
  .from('subscriptions')
  .eq('plan_type', 'standard_4_month')
// Doesn't find 'standard', 'Standard_4_Month', etc.
```

### 3. Application Logic
```typescript
// Unsafe - no compile-time checking
if (subscription.plan_type === 'standard_4_month') {
  // What if DB has 'standard' or 'Standard'?
}
```

### 4. No Documentation
Developers don't know what valid values are without reading code

## Recommended Fix

### Option 1: PostgreSQL ENUM (Recommended)

**Benefits:**
- Database-level validation
- Better performance (stored as integers internally)
- Self-documenting schema
- Type safety

**Migration:** `scripts/016_add_plan_type_enum.sql`

```sql
-- Step 1: Create ENUM type
CREATE TYPE plan_type_enum AS ENUM (
  'one_time',
  'standard_4_month',
  'premium_8_month'
);

-- Step 2: Backup existing data
CREATE TABLE subscriptions_backup AS
SELECT * FROM subscriptions;

-- Step 3: Convert column
ALTER TABLE subscriptions
ALTER COLUMN plan_type TYPE plan_type_enum
USING (
  CASE
    WHEN plan_type = 'one_time' THEN 'one_time'::plan_type_enum
    WHEN plan_type IN ('standard_4_month', 'monthly_standard', 'standard')
      THEN 'standard_4_month'::plan_type_enum
    WHEN plan_type IN ('premium_8_month', 'monthly_premium', 'premium')
      THEN 'premium_8_month'::plan_type_enum
    ELSE NULL
  END
);

-- Step 4: Verify no NULLs (which would indicate invalid data)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM subscriptions WHERE plan_type IS NULL) THEN
    RAISE EXCEPTION 'Found subscriptions with invalid plan_type';
  END IF;
END $$;

-- Step 5: Make NOT NULL if appropriate
ALTER TABLE subscriptions
ALTER COLUMN plan_type SET NOT NULL;

-- Step 6: Drop backup if verification passes
DROP TABLE subscriptions_backup;
```

**Usage:**
```sql
-- ✅ Valid
INSERT INTO subscriptions (plan_type) VALUES ('standard_4_month'::plan_type_enum);

-- ❌ Rejected by database
INSERT INTO subscriptions (plan_type) VALUES ('invalid');
-- ERROR: invalid input value for enum plan_type_enum: "invalid"
```

### Option 2: CHECK Constraint (Alternative)

If you need more flexibility to add plan types without migrations:

```sql
ALTER TABLE subscriptions
ADD CONSTRAINT valid_plan_type
CHECK (plan_type IN (
  'one_time',
  'standard_4_month',
  'premium_8_month'
));
```

**Trade-offs:**
- ✅ Easier to modify (no ENUM migration needed)
- ❌ Less performant
- ❌ No inherent type in database

## TypeScript Integration

### Update Database Types
```bash
# Regenerate types after ENUM creation
pnpm supabase gen types typescript --local > lib/database.types.ts
```

### Usage in Code
```typescript
import { Database } from '@/lib/database.types'

type PlanType = Database['public']['Enums']['plan_type_enum']
// Type is: 'one_time' | 'standard_4_month' | 'premium_8_month'

// ✅ Type-safe
const plan: PlanType = 'standard_4_month'

// ❌ TypeScript error
const invalid: PlanType = 'invalid'
```

## Adding New Plan Types

### With ENUM:
```sql
-- Add new value to ENUM
ALTER TYPE plan_type_enum ADD VALUE 'annual_unlimited';

-- Use in code immediately
INSERT INTO subscriptions (plan_type) VALUES ('annual_unlimited');
```

**Note:** Cannot remove ENUM values easily - must recreate type

### With CHECK Constraint:
```sql
-- More flexible
ALTER TABLE subscriptions
DROP CONSTRAINT valid_plan_type;

ALTER TABLE subscriptions
ADD CONSTRAINT valid_plan_type
CHECK (plan_type IN (
  'one_time',
  'standard_4_month',
  'premium_8_month',
  'annual_unlimited'  -- Added
));
```

## Recommendations

**Use ENUM if:**
- Plan types are stable
- Performance matters
- Strong type safety needed
- PostgreSQL-specific is acceptable

**Use CHECK constraint if:**
- Plan types change frequently
- Need to easily deprecate old types
- Want database portability

## Acceptance Criteria
- [ ] ENUM type created OR CHECK constraint added
- [ ] Existing data validated and migrated
- [ ] Invalid data cleaned or migration fails gracefully
- [ ] TypeScript types regenerated
- [ ] Code updated to use typed values
- [ ] Tests confirm invalid values rejected
- [ ] Documentation updated with valid plan types
- [ ] Process documented for adding new plan types
