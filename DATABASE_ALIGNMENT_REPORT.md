# Database Schema vs Code Alignment Report

## Summary
This report verifies that all database operations in the codebase match the documented schema.

---

## Schema Verification

### Tables from Documentation (001_setup_schema.sql):
1. **profiles** ✅ EXISTS
   - All columns match documented schema
   - RLS policies implemented correctly

2. **letters** ✅ EXISTS
   - All columns match documented schema
   - Letter status enum includes all documented statuses
   - Foreign key to profiles correctly implemented

3. **subscriptions** ✅ EXISTS
   - All columns match documented schema
   - Foreign key to profiles correctly implemented

4. **employee_coupons** ✅ EXISTS
   - All columns match documented schema
   - Auto-generation trigger implemented

5. **commissions** ✅ EXISTS
   - All columns match documented schema
   - Proper foreign key relationships

6. **letter_audit_trail** ✅ EXISTS
   - All columns match documented schema
   - Trigger for automatic logging implemented

---

## Missing Tables:

### ❌ coupon_usage Table
- **Referenced in**: DATABASE_FUNCTIONS.md
- **Purpose**: Track coupon usage by subscribers
- **Required Columns** (based on documentation):
  - id (UUID, primary key)
  - coupon_id (UUID, foreign key to employee_coupons)
  - user_id (UUID, foreign key to profiles)
  - subscription_id (UUID, foreign key to subscriptions)
  - used_at (timestamp)
  - discount_amount (decimal)
- **Impact**: API endpoints referencing this table will fail
- **Fix Required**: Create migration script to add this table

---

## Database Functions Verification:

### ✅ Implemented Functions:
1. `deduct_letter_allowance(u_id)` - ✅ EXISTS and matches spec
2. `log_letter_audit()` - ✅ EXISTS and matches spec
3. `reset_monthly_allowances()` - ✅ EXISTS and matches spec
4. `get_employee_coupon()` - ✅ EXISTS and matches spec

### ❌ Missing Functions:
1. `add_letter_allowances(u_id, amount)`
   - **Documented in**: DATABASE_FUNCTIONS.md
   - **Purpose**: Add letter credits to user subscription
   - **Fix Required**: Create migration script

2. `validate_coupon(code)`
   - **Documented in**: DATABASE_FUNCTIONS.md
   - **Purpose**: Validate employee coupon codes
   - **Fix Required**: Create migration script

---

## Code Database Operations Analysis:

### Supabase Queries Found:

#### 1. `/app/api/generate-letter/route.ts`:
- ✅ Uses `deduct_letter_allowance` correctly
- ✅ Inserts into letters table with correct columns
- ❌ Missing audit logging for draft → generating transition

#### 2. `/app/api/letters/[id]/approve/route.ts`:
- ✅ Updates letters table correctly
- ✅ Calls `log_letter_audit` correctly
- ✅ Updates reviewed_by and reviewed_at fields

#### 3. `/app/api/letters/[id]/reject/route.ts`:
- ✅ Updates letters table correctly
- ✅ Calls `log_letter_audit` correctly
- ✅ Includes rejection reason

#### 4. `/app/api/create-checkout/route.ts`:
- ✅ Queries subscriptions table correctly
- ✅ Handles coupon codes (but references missing coupon_usage table)

#### 5. `/app/api/subscriptions/route.ts`:
- ✅ Inserts into subscriptions table correctly
- ✅ Auto-generates employee coupon if applicable

#### 6. `/app/api/admin-auth/login/route.ts`:
- ✅ Queries profiles table correctly
- ✅ Validates admin role

#### 7. `/app/dashboard/letters/page.tsx`:
- ✅ Queries letters table for user's letters
- ✅ Applies correct visibility rules

---

## Type Definitions Check (`/lib/database.types.ts`):

### ✅ Properly Defined:
- Profile type matches schema
- Letter type matches schema (including LetterStatus enum)
- Subscription type matches schema
- EmployeeCoupon type matches schema
- Commission type matches schema

### ❌ Missing:
- CouponUsage type (table doesn't exist)
- Some junction table types (if any exist)

---

## RLS Policies Verification:

### ✅ Correctly Implemented:
1. **profiles**:
   - Users can only read/update their own profile
   - Admins can read all profiles
   - Employees cannot access other users' data

2. **letters**:
   - Subscribers can only access their own letters
   - Employees have NO access (as required)
   - Admins have full access

3. **subscriptions**:
   - Users can only read their own subscriptions
   - Admins can read all
   - Employees have no direct access

4. **employee_coupons**:
   - Employees can only see their own coupons
   - Admins can see all
   - Subscribers cannot access

5. **commissions**:
   - Employees can only see their own commissions
   - Admins can see all
   - Subscribers cannot access

---

## Critical Issues Found:

### 1. **Missing coupon_usage Table**
```sql
-- Migration needed:
CREATE TABLE coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES employee_coupons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    discount_amount DECIMAL(10,2) NOT NULL
);

-- Enable RLS
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their coupon usage" ON coupon_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all coupon usage" ON coupon_usage
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );
```

### 2. **Missing Database Functions**
```sql
-- Migration needed for add_letter_allowances:
CREATE OR REPLACE FUNCTION add_letter_allowances(u_id UUID, amount INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sub_record RECORD;
BEGIN
    -- Find active subscription for user
    SELECT id INTO sub_record
    FROM subscriptions
    WHERE user_id = u_id
    AND status = 'active'
    AND expires_at > NOW()
    LIMIT 1;

    -- If no active subscription, return false
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Add allowances
    UPDATE subscriptions
    SET credits_remaining = credits_remaining + amount,
        remaining_letters = remaining_letters + amount
    WHERE id = sub_record.id;

    RETURN TRUE;
END;
$$;

-- Migration needed for validate_coupon:
CREATE OR REPLACE FUNCTION validate_coupon(code TEXT)
RETURNS TABLE (
    coupon_id UUID,
    employee_id UUID,
    discount_percent INT,
    is_active BOOLEAN,
    usage_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ec.id,
        ec.employee_id,
        ec.discount_percent,
        ec.is_active,
        ec.usage_count
    FROM employee_coupons ec
    WHERE ec.code = validate_coupon.code
    AND ec.is_active = TRUE;
END;
$$;
```

### 3. **Missing Audit Logging**
In `/app/api/generate-letter/route.ts`, add:
```typescript
// Before deducting allowance
await supabase.rpc('log_letter_audit', {
  p_letter_id: letterId,
  p_action: 'created',
  p_old_status: null,
  p_new_status: 'draft',
  p_notes: 'Letter created via intake form'
});

// After generating AI content
await supabase.rpc('log_letter_audit', {
  p_letter_id: letterId,
  p_action: 'generated',
  p_old_status: 'generating',
  p_new_status: 'pending_review',
  p_notes: 'AI generation completed successfully'
});
```

---

## Recommendations:

1. **Immediate Actions**:
   - Create migration for coupon_usage table
   - Add missing database functions
   - Complete audit logging implementation

2. **Code Improvements**:
   - Add error handling for missing database objects
   - Implement retry logic for database operations
   - Add database connection health checks

3. **Documentation Updates**:
   - Update DATABASE_FUNCTIONS.md with function signatures
   - Add ERD documentation showing table relationships
   - Document all RLS policies

---

## Fixes Applied:

1. ✅ Identified all missing tables and functions
2. ✅ Created SQL scripts for missing elements
3. ✅ Verified RLS policies are correct
4. ✅ Confirmed type definitions match schema
5. ⏳ Pending: Create actual migration files

---

**Last Updated**: December 2025
**Total Issues Found**: 3 Critical
**Missing Tables**: 1
**Missing Functions**: 2
**Audit Logging Gaps**: 1