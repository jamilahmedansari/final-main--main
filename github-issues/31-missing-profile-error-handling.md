# No Error Handling for Missing Profile in Generate Letter

## Priority
⚠️ **MEDIUM**

## Labels
`bug`, `medium-priority`, `error-handling`, `resilience`

## Description
The generate letter endpoint fetches the user's profile but doesn't check for errors, only checks the role. If the profile doesn't exist (edge case but possible), the role check silently fails and produces unclear errors downstream.

## Location
- **File**: `app/api/generate-letter/route.ts`
- **Line**: 29

## Current Code
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single()

// ❌ No error handling
// ❌ What if profile is null?
// ❌ What if database error occurred?

if (profile?.role === 'employee') {
  return NextResponse.json({
    error: "Employees cannot generate letters"
  }, { status: 403 })
}
```

## Edge Cases

### 1. Profile Doesn't Exist
**Scenario:**
- User authenticated via Supabase Auth
- Profile creation failed or was skipped
- `profile` is `null`

**Current behavior:**
```typescript
profile?.role === 'employee'  // undefined === 'employee' → false
// Silently continues... then fails later when checking allowances
```

### 2. Database Error
**Scenario:**
- Database connection issue
- RLS policy denies access (misconfiguration)
- Table doesn't exist (migration issue)

**Current behavior:**
```typescript
const { data: profile } = await supabase...
// data is null, error is populated but ignored
// Continues execution with null profile
```

### 3. Multiple Profiles (shouldn't happen but...)
**Scenario:**
- Data integrity issue
- Profile duplicated somehow

**Current behavior:**
```typescript
.single()  // Throws error if multiple rows
// But error is not caught
```

## Impact
- Poor error messages for users
- Hard to debug in production
- Silent failures instead of explicit errors
- Data integrity issues masked

## Recommended Fix

### Explicit Error Handling
```typescript
// Fetch profile with error handling
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('role, is_super_user')
  .eq('id', user.id)
  .single()

// 1. Handle database errors
if (profileError) {
  console.error('[GenerateLetter] Profile fetch error:', profileError)
  return NextResponse.json({
    error: "Unable to verify account. Please try again."
  }, { status: 500 })
}

// 2. Handle missing profile
if (!profile) {
  console.error('[GenerateLetter] Profile not found for user:', user.id)

  // This is critical - should never happen
  // Log to monitoring service
  await logCriticalError({
    message: 'User without profile',
    userId: user.id,
    email: user.email
  })

  return NextResponse.json({
    error: "Account setup incomplete. Please contact support."
  }, { status: 500 })
}

// 3. Now safe to use profile
if (profile.role === 'employee') {
  return NextResponse.json({
    error: "Employees cannot generate letters"
  }, { status: 403 })
}
```

## Better Pattern: Profile Validation Utility

**File to create**: `lib/auth/validate-profile.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js'

export class ProfileError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'FETCH_ERROR' | 'INVALID_ROLE',
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'ProfileError'
  }
}

export async function getValidatedProfile(
  supabase: SupabaseClient,
  userId: string,
  requiredFields: string[] = ['role']
) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(requiredFields.join(', '))
    .eq('id', userId)
    .single()

  if (error) {
    console.error('[ValidateProfile] Fetch error:', error)
    throw new ProfileError(
      'Failed to fetch profile',
      'FETCH_ERROR',
      500
    )
  }

  if (!profile) {
    console.error('[ValidateProfile] Profile not found:', userId)
    throw new ProfileError(
      'Profile not found',
      'NOT_FOUND',
      404
    )
  }

  return profile
}

export async function requireRole(
  supabase: SupabaseClient,
  userId: string,
  allowedRoles: string[]
) {
  const profile = await getValidatedProfile(supabase, userId, ['role'])

  if (!allowedRoles.includes(profile.role)) {
    throw new ProfileError(
      `Role ${profile.role} not authorized`,
      'INVALID_ROLE',
      403
    )
  }

  return profile
}
```

**Usage in API routes:**
```typescript
import { getValidatedProfile, ProfileError } from '@/lib/auth/validate-profile'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // ✅ Validated profile fetch with clear errors
    const profile = await getValidatedProfile(supabase, user.id, ['role', 'is_super_user'])

    // Prevent employees from generating
    if (profile.role === 'employee') {
      return NextResponse.json({
        error: "Employees cannot generate letters"
      }, { status: 403 })
    }

    // Rest of letter generation logic...

  } catch (error) {
    if (error instanceof ProfileError) {
      return NextResponse.json({
        error: error.message
      }, { status: error.statusCode })
    }

    console.error('[GenerateLetter] Error:', error)
    return NextResponse.json({
      error: "Internal server error"
    }, { status: 500 })
  }
}
```

## Additional Improvements

### 1. Profile Creation Guard
Ensure profile always exists after signup:

```typescript
// In signup flow or Supabase trigger
CREATE OR REPLACE FUNCTION create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role, is_super_user)
  VALUES (NEW.id, NEW.email, 'subscriber', false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_profile_for_user();
```

### 2. Monitoring Alert
```typescript
if (!profile) {
  // Critical error - should never happen
  await sendAlert({
    severity: 'critical',
    message: `User ${user.id} has no profile`,
    context: { userId: user.id, email: user.email }
  })
}
```

### 3. Health Check Endpoint
```typescript
// app/api/health/profiles/route.ts
export async function GET() {
  const supabase = createServiceClient()

  // Check for users without profiles
  const { data: orphanedUsers } = await supabase.rpc('find_orphaned_users')

  if (orphanedUsers.length > 0) {
    return NextResponse.json({
      status: 'unhealthy',
      issue: 'Users without profiles found',
      count: orphanedUsers.length
    }, { status: 500 })
  }

  return NextResponse.json({ status: 'healthy' })
}
```

## Files to Update
Similar pattern should be applied to:
- [ ] `app/api/generate-letter/route.ts` ✓ (mentioned)
- [ ] `app/api/letters/[id]/approve/route.ts`
- [ ] `app/api/letters/[id]/reject/route.ts`
- [ ] `app/api/create-checkout/route.ts`
- [ ] Any other endpoint that fetches profile

## Acceptance Criteria
- [ ] Profile fetch includes error checking
- [ ] Missing profile returns clear error
- [ ] Database errors handled gracefully
- [ ] User sees helpful error message
- [ ] Errors logged for debugging
- [ ] Monitoring alerts for critical cases
- [ ] Database trigger ensures profile creation
- [ ] Health check detects orphaned users
- [ ] All API routes use validated profile fetch
