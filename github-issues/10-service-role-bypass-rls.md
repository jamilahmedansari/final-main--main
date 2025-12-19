# Service Role Client Bypasses RLS in User-Facing Code

## Priority
⚠️ **MEDIUM**

## Labels
`security`, `medium-priority`, `architecture`, `rls`

## Description
The profile creation endpoint uses the service role client to bypass Row Level Security (RLS), violating the documented pattern: "never bypass with service role in user-facing code."

## Location
- **File**: `app/api/create-profile/route.ts`
- **Lines**: 65-68

## Current Implementation
```typescript
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // ❌ Service role bypass
)

await adminClient.from('profiles').insert({
  id: user.id,
  email: user.email,
  role: 'subscriber',
  is_super_user: false
})
```

## Why This Exists
Profile creation requires bypassing RLS because new users don't have a profile yet, creating a chicken-and-egg problem.

## Security Concerns
1. Service role has unrestricted access
2. No validation before insert (could inject malicious data)
3. Violates security principle documented in CLAUDE.md
4. Sets precedent for other bypasses

## Recommended Fix

**Option 1: Database Function with SECURITY DEFINER** (Preferred)
```sql
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id UUID,
  p_email TEXT
) RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate inputs
  IF p_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  -- Insert with controlled permissions
  INSERT INTO profiles (id, email, role, is_super_user)
  VALUES (p_user_id, p_email, 'subscriber', false);
END;
$$;
```

Then call from API:
```typescript
await supabase.rpc('create_user_profile', {
  p_user_id: user.id,
  p_email: user.email
})
```

**Option 2: Add Comprehensive Validation**
If service role must be used, add strict validation:
```typescript
// Validate email format
if (!isValidEmail(user.email)) {
  throw new Error('Invalid email')
}

// Ensure role is only 'subscriber'
// Ensure is_super_user is always false
// Log the operation for audit
```

## Benefits of Option 1
- RLS pattern maintained
- Service role not exposed in application code
- Centralized validation logic
- Easier to audit
- Follows database-first security model

## Acceptance Criteria
- [ ] Service role removed from application code
- [ ] Database function created with SECURITY DEFINER
- [ ] Input validation enforced
- [ ] Operation logged in audit trail
- [ ] Documentation updated
- [ ] Other service role usages audited
