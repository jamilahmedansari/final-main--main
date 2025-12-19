# Duplicate Subscription Credit Fields Causing Confusion

## Priority
⚠️ **MEDIUM**

## Labels
`technical-debt`, `database`, `medium-priority`, `refactoring`

## Description
The `subscriptions` table has both `credits_remaining` and `remaining_letters` fields that serve the same purpose. This creates confusion, potential sync issues, and inconsistent code.

## Current Schema
```sql
CREATE TABLE subscriptions (
  -- ...
  credits_remaining INT,      -- ❓ Which one is source of truth?
  remaining_letters INT,      -- ❓ Same data, different field
  -- ...
)
```

## Code Inconsistencies

**Some code uses `credits_remaining`**:
```typescript
subscription.credits_remaining > 0
```

**Other code uses `remaining_letters`**:
```typescript
subscription.remaining_letters--
```

## Problems
1. **Data sync issues**: Updates to one field don't update the other
2. **Code confusion**: Developers don't know which to use
3. **Migration debt**: Fields likely from schema evolution
4. **Wasted storage**: Duplicated data
5. **Query confusion**: Which field should indexes use?

## Recommended Fix

### Step 1: Audit Usage
```bash
# Find all usages of both fields
grep -r "credits_remaining" .
grep -r "remaining_letters" .
```

### Step 2: Consolidate to Single Field
**Decision**: Use `remaining_letters` (more descriptive)

### Step 3: Migration Script
**File to create**: `scripts/014_consolidate_credit_fields.sql`

```sql
-- Step 1: Ensure data consistency (copy if needed)
UPDATE subscriptions
SET remaining_letters = credits_remaining
WHERE remaining_letters IS NULL AND credits_remaining IS NOT NULL;

UPDATE subscriptions
SET credits_remaining = remaining_letters
WHERE credits_remaining IS NULL AND remaining_letters IS NOT NULL;

-- Step 2: Verify no conflicts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM subscriptions
    WHERE credits_remaining != remaining_letters
  ) THEN
    RAISE EXCEPTION 'Data mismatch between credits_remaining and remaining_letters';
  END IF;
END $$;

-- Step 3: Drop deprecated column
ALTER TABLE subscriptions DROP COLUMN IF EXISTS credits_remaining;

-- Step 4: Add constraint
ALTER TABLE subscriptions
ADD CONSTRAINT remaining_letters_non_negative
CHECK (remaining_letters >= 0);
```

### Step 4: Update Code References
Replace all instances of `credits_remaining` with `remaining_letters`:

```typescript
// ❌ Old
if (subscription.credits_remaining > 0) { }

// ✅ New
if (subscription.remaining_letters > 0) { }
```

### Step 5: Update TypeScript Types
Regenerate database types:
```bash
pnpm db:types
```

## Files to Update (Estimated)
- API routes using subscription credits
- Dashboard components displaying credits
- Database functions
- Migration scripts
- Type definitions

## Acceptance Criteria
- [ ] Audit finds all usages of both fields
- [ ] Decision documented on which field to keep
- [ ] Migration safely removes duplicate field
- [ ] All code references updated
- [ ] TypeScript types regenerated
- [ ] No TypeScript errors
- [ ] Tests confirm credit deduction works
- [ ] Documentation updated
