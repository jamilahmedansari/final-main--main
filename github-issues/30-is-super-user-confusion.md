# Confusion Between is_super_user and admin Role

## Priority
⚠️ **MEDIUM**

## Labels
`bug`, `medium-priority`, `architecture`, `authorization`

## Description
The `isSuperAdmin()` function checks both `role === 'admin'` AND `is_super_user === true`, creating confusion about their purposes. According to CLAUDE.md, `is_super_user` should ONLY mean unlimited letters for subscribers, NOT admin privileges.

## Location
- **File**: `lib/auth/admin-session.ts`
- **Lines**: 192-206

## Documentation Reference
From `CLAUDE.md`:
```typescript
// ❌ WRONG - is_super_user is NOT admin
if (profile.is_super_user) { /* admin logic */ }

// ✅ CORRECT - is_super_user means unlimited letters ONLY
if (profile.is_super_user) { /* skip credit check */ }

// ✅ CORRECT - admin check
if (profile.role === 'admin') { /* admin logic */ }
```

## Current Problematic Implementation
```typescript
export async function isSuperAdmin(supabase: any): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_user')
    .eq('id', session.user.id)
    .single()

  // ❌ WRONG: Conflates two separate concepts
  return profile?.role === 'admin' && profile?.is_super_user === true
}
```

## Problems

### 1. Semantic Confusion
Two separate concerns mixed:
- **`role === 'admin'`**: User can access admin portal
- **`is_super_user`**: User has unlimited letter credits

These should be independent!

### 2. Real-World Scenarios

**Scenario A: VIP Subscriber**
- Paying customer who gets unlimited letters as perk
- Should have: `is_super_user = true, role = 'subscriber'`
- Current code would: NOT give admin access ✅ (correct by accident)

**Scenario B: Super Admin**
- Company owner who needs unlimited letters AND admin access
- Should have: `is_super_user = true, role = 'admin'`
- Current code would: Give admin access ✅

**Scenario C: Regular Admin**
- Employee who reviews letters but pays for own usage
- Should have: `is_super_user = false, role = 'admin'`
- Current code would: NOT recognize as "super admin" ❌
- What does "super admin" even mean?

### 3. Naming Confusion
Function name `isSuperAdmin()` implies admin hierarchy:
- Regular admin
- Super admin (more privileges?)

But implementation uses `is_super_user` which is about letter credits, not admin privileges!

## Recommended Fix

### Option 1: Separate Concerns Completely

**Database Schema:**
```sql
-- profiles table
role TEXT NOT NULL CHECK (role IN ('subscriber', 'employee', 'admin'))
is_super_user BOOLEAN DEFAULT FALSE  -- Unlimited letters for ANY role
```

**Admin Check (No Changes Needed):**
```typescript
export async function isAdmin(supabase: any): Promise<boolean> {
  const profile = await getProfile(supabase)
  return profile?.role === 'admin'
}
```

**Letter Allowance Check:**
```typescript
// In generate-letter endpoint
const { data: profile } = await supabase
  .from('profiles')
  .select('is_super_user')
  .eq('id', user.id)
  .single()

if (profile.is_super_user) {
  // Skip credit check - generate letter
  // This works for subscribers AND admins
}
```

**Remove `isSuperAdmin()` entirely** - it's misleading:
```typescript
// Delete this function
export async function isSuperAdmin(supabase: any): Promise<boolean> {
  // This shouldn't exist
}
```

### Option 2: Add Explicit Admin Hierarchy (If Actually Needed)

If there's a real need for admin levels:

```sql
-- Add new column for admin hierarchy
ALTER TABLE profiles
ADD COLUMN admin_level TEXT CHECK (admin_level IN ('basic', 'super'))
DEFAULT 'basic';

-- is_super_user remains for letter allowance only
```

```typescript
export async function getAdminLevel(supabase: any): Promise<'basic' | 'super' | null> {
  const profile = await getProfile(supabase)

  if (profile?.role !== 'admin') {
    return null
  }

  return profile.admin_level || 'basic'
}

// Usage
const adminLevel = await getAdminLevel(supabase)
if (adminLevel === 'super') {
  // Super admin features (e.g., manage other admins, system settings)
}
```

## Clarify Use Cases

### is_super_user = true
**Purpose:** Unlimited letter generation
**Applies to:**
- VIP subscribers (lifetime members, special deals)
- Company executives who need unlimited usage
- Beta testers
- Special partnerships

**Does NOT grant:**
- Admin portal access
- Letter review privileges
- Analytics access
- User management

### role = 'admin'
**Purpose:** Access to admin portal
**Applies to:**
- Legal reviewers
- Customer support with admin access
- System administrators

**Does NOT grant:**
- Unlimited letter credits (admin pays for their own letters OR gets super_user separately)

### Both is_super_user = true AND role = 'admin'
**Purpose:** Admin who also has unlimited letters
**Example:**
- Company founder
- Lead attorney who reviews AND generates many letters

## Migration to Fix Existing Code

### Step 1: Audit Current Usage
```sql
-- Find profiles with both flags
SELECT
  id,
  email,
  role,
  is_super_user,
  CASE
    WHEN role = 'admin' AND is_super_user = true THEN 'admin_super'
    WHEN role = 'admin' THEN 'admin_regular'
    WHEN is_super_user = true THEN 'super_subscriber'
    ELSE 'regular'
  END as user_type
FROM profiles
WHERE role = 'admin' OR is_super_user = true;
```

### Step 2: Remove isSuperAdmin() Calls
```bash
# Find all usages
grep -r "isSuperAdmin" --include="*.ts" --include="*.tsx"
```

Replace with appropriate check:
```typescript
// ❌ Before
if (await isSuperAdmin(supabase)) { }

// ✅ After (for admin features)
if (await isAdmin(supabase)) { }

// ✅ After (for unlimited letters)
if (profile.is_super_user) { }
```

### Step 3: Update Documentation
Update CLAUDE.md with clear examples:
```markdown
## Authorization Patterns

### Admin Portal Access
- Check: `role === 'admin'`
- Purpose: Access to review letters, analytics, admin dashboard

### Unlimited Letter Credits
- Check: `is_super_user === true`
- Purpose: Skip credit deduction, unlimited generation
- Note: Can be combined with ANY role
```

## Acceptance Criteria
- [ ] `is_super_user` only used for letter allowance
- [ ] `role === 'admin'` only used for admin access
- [ ] `isSuperAdmin()` function removed OR repurposed with clear semantics
- [ ] All code audited for conflated usage
- [ ] Tests confirm independent operation
- [ ] Documentation updated with clear examples
- [ ] Database audit shows correct flag usage
- [ ] VIP subscribers can have unlimited letters without admin access
- [ ] Regular admins don't need unlimited letters
