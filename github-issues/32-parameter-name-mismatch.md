# Documentation Parameter Mismatch: deduct_letter_allowance

## Priority
🔧 **LOW**

## Labels
`documentation`, `low-priority`, `technical-debt`, `consistency`

## Description
The CLAUDE.md documentation states that `deduct_letter_allowance` takes `u_id` as a parameter, but the actual implementation uses `user_uuid` as the parameter name. This inconsistency can confuse developers.

## Location
- **Documentation**: `CLAUDE.md` (database functions section)
- **Implementation**: Likely in `scripts/*_functions.sql`

## Documentation Says:
```typescript
// From CLAUDE.md
deduct_letter_allowance(u_id)  // ❌ Incorrect parameter name
```

## Actual Implementation:
```sql
-- Likely in database migration
CREATE FUNCTION deduct_letter_allowance(user_uuid UUID)  -- ✅ Actual parameter
RETURNS BOOLEAN AS $$
  -- function body
$$ LANGUAGE plpgsql;
```

## Impact

### Developer Confusion
```typescript
// Developer reads docs, tries:
await supabase.rpc('deduct_letter_allowance', {
  u_id: user.id  // ❌ Wrong parameter name
})
// Error: function parameter "u_id" not found

// Has to debug and find real parameter is:
await supabase.rpc('deduct_letter_allowance', {
  user_uuid: user.id  // ✅ Correct
})
```

### Time Wasted
- Developer reads documentation ✅
- Writes code based on docs ✅
- Code fails ❌
- Has to search database migrations to find real parameter name
- Loses trust in documentation

## Recommended Fix

### Option 1: Update Documentation to Match Implementation
```markdown
<!-- CLAUDE.md -->
| Function | Purpose |
|----------|---------|
| `deduct_letter_allowance(user_uuid)` | Deducts 1 credit, returns boolean |
```

**Pros:**
- Quick fix
- No database changes
- No risk

**Cons:**
- `user_uuid` is verbose
- Inconsistent with other functions if they use `u_id`

### Option 2: Update Database Function to Match Documentation
```sql
-- Migration: scripts/018_fix_function_parameter_names.sql

-- Drop and recreate with correct parameter name
DROP FUNCTION IF EXISTS deduct_letter_allowance(UUID);

CREATE OR REPLACE FUNCTION deduct_letter_allowance(
  u_id UUID  -- ✅ Matches documentation
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_rows INT;
BEGIN
  -- Update subscriptions to deduct one letter
  UPDATE subscriptions
  SET remaining_letters = remaining_letters - 1
  WHERE user_id = u_id
    AND status = 'active'
    AND remaining_letters > 0;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql;
```

**Pros:**
- Documentation is correct
- Shorter, cleaner parameter name
- Consistent across codebase

**Cons:**
- Requires database migration
- Must update all code calling the function
- Could break existing deployments if not careful

### Option 3: Make Parameter Names Consistent Across All Functions

Audit all database functions and standardize:
```sql
-- Consistent pattern: use u_id for user ID parameter
check_letter_allowance(u_id UUID)
deduct_letter_allowance(u_id UUID)
log_letter_audit(p_letter_id UUID, p_user_id UUID, ...)
validate_coupon(p_code TEXT, u_id UUID)
```

**Naming Convention:**
- `u_id` - user ID
- `p_` prefix - other parameters
- `l_` prefix - local variables

## Code Search and Update

### Find All Usages
```bash
# Search TypeScript/JavaScript code
grep -r "deduct_letter_allowance" --include="*.ts" --include="*.tsx"

# Search SQL migrations
grep -r "deduct_letter_allowance" scripts/
```

### Update Call Sites
```typescript
// Before
await supabase.rpc('deduct_letter_allowance', {
  user_uuid: user.id
})

// After (if choosing Option 2)
await supabase.rpc('deduct_letter_allowance', {
  u_id: user.id
})
```

## Related Functions to Check

Audit parameter naming consistency for all functions:
- [ ] `check_letter_allowance` - what parameter does it use?
- [ ] `log_letter_audit` - consistent parameter names?
- [ ] `validate_coupon` - how does it accept user ID?
- [ ] Any other custom database functions

## TypeScript Type Safety

If using generated types:
```bash
# Regenerate after parameter name change
pnpm supabase gen types typescript --local > lib/database.types.ts
```

This will update types to match new parameter names:
```typescript
// Generated types will show:
Database['public']['Functions']['deduct_letter_allowance']['Args'] = {
  u_id: string  // ✅ Type-safe!
}
```

## Documentation Standards

Create a documentation checklist:
- [ ] Parameter names match implementation
- [ ] Return types are accurate
- [ ] Example code has been tested
- [ ] Function descriptions are current
- [ ] Code examples use actual parameter names from database

## Testing

After fix, add test:
```typescript
describe('deduct_letter_allowance', () => {
  it('should accept correct parameter name', async () => {
    const result = await supabase.rpc('deduct_letter_allowance', {
      u_id: testUserId  // Verify this matches docs
    })

    expect(result.error).toBeNull()
  })

  it('should fail with wrong parameter name', async () => {
    const result = await supabase.rpc('deduct_letter_allowance', {
      user_uuid: testUserId  // Old name should fail
    })

    expect(result.error).toBeTruthy()
  })
})
```

## Acceptance Criteria
- [ ] Documentation parameter names match implementation
- [ ] All database function calls use correct parameters
- [ ] TypeScript types regenerated (if applicable)
- [ ] All functions use consistent naming convention
- [ ] Examples in documentation have been tested
- [ ] Migration script created (if renaming function)
- [ ] No breaking changes in production
- [ ] Tests verify correct parameter names
