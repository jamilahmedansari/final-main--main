# Test Mode Creates Real Database Records

## Priority
⚠️ **MEDIUM**

## Labels
`bug`, `medium-priority`, `testing`, `data-integrity`

## Description
When `TEST_MODE=true`, the checkout flow creates real database records that could be confused with production data. There's no way to distinguish test data from real data or clean it up systematically.

## Location
- **File**: `app/api/create-checkout/route.ts`
- **Lines**: 84-134 (test mode bypass), 236-318 (subscription creation)

## Current Behavior
```typescript
if (process.env.TEST_MODE === "true") {
  // Creates REAL subscription records in PRODUCTION database
  const { data: subscription } = await supabase
    .from('subscriptions')
    .insert({
      user_id: user.id,
      plan_type: planType,
      // ... no test flag
    })
}
```

## Problems

### 1. Data Pollution
- Test subscriptions mixed with real ones
- Analytics includes test data
- Revenue reports inflated
- Cannot distinguish test from real

### 2. Credit Abuse
```typescript
// User could enable TEST_MODE and get free credits
if (TEST_MODE) {
  // Bypass payment, get full subscription
}
```

### 3. No Cleanup Mechanism
- Test data persists forever
- Cannot safely delete test records
- Manual cleanup risks deleting real data

### 4. Audit Trail Confusion
- Test actions logged as real actions
- Cannot filter out test events
- Compliance reporting inaccurate

## Security Risk
If TEST_MODE can be enabled in production (via env var), users could:
1. Set TEST_MODE=true in browser dev tools (if client-side)
2. Bypass payment
3. Get unlimited subscriptions
4. **Critical if TEST_MODE is user-controllable**

## Recommended Fix

### Option 1: Add is_test_data Flag (Quick Fix)

**Migration:** `scripts/017_add_test_data_flags.sql`
```sql
-- Add flag to all tables that TEST_MODE touches
ALTER TABLE subscriptions ADD COLUMN is_test_data BOOLEAN DEFAULT FALSE;
ALTER TABLE letters ADD COLUMN is_test_data BOOLEAN DEFAULT FALSE;
ALTER TABLE coupon_usage ADD COLUMN is_test_data BOOLEAN DEFAULT FALSE;
ALTER TABLE commissions ADD COLUMN is_test_data BOOLEAN DEFAULT FALSE;

-- Create index for filtering
CREATE INDEX idx_subscriptions_test_data ON subscriptions(is_test_data);
CREATE INDEX idx_letters_test_data ON letters(is_test_data);

-- Create view excluding test data
CREATE VIEW subscriptions_production AS
SELECT * FROM subscriptions WHERE is_test_data = FALSE;

CREATE VIEW letters_production AS
SELECT * FROM letters WHERE is_test_data = FALSE;
```

**Code Update:**
```typescript
if (process.env.TEST_MODE === "true") {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .insert({
      user_id: user.id,
      plan_type: planType,
      is_test_data: true,  // ✅ Mark as test
      // ...
    })
}
```

**Analytics Queries:**
```typescript
// Exclude test data from metrics
const { count } = await supabase
  .from('subscriptions')
  .select('*', { count: 'exact' })
  .eq('is_test_data', false)  // ✅ Production only
```

**Cleanup Script:**
```sql
-- scripts/cleanup_test_data.sql
DELETE FROM coupon_usage WHERE is_test_data = TRUE;
DELETE FROM commissions WHERE is_test_data = TRUE;
DELETE FROM letters WHERE is_test_data = TRUE;
DELETE FROM subscriptions WHERE is_test_data = TRUE;
```

### Option 2: Separate Test Database (Best Practice)

**Benefits:**
- Complete isolation
- No risk of data mixing
- Safe to wipe entire database
- Production queries never see test data

**Implementation:**
```typescript
// lib/supabase/server.ts
const SUPABASE_URL = process.env.TEST_MODE === 'true'
  ? process.env.SUPABASE_TEST_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL

const SUPABASE_KEY = process.env.TEST_MODE === 'true'
  ? process.env.SUPABASE_TEST_ANON_KEY
  : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**Environment:**
```env
# Production
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Test
SUPABASE_TEST_URL=https://yyy.supabase.co
SUPABASE_TEST_ANON_KEY=eyJ...
```

### Option 3: Stripe Test Mode (For Payment Testing)

**Stripe provides test mode:**
```typescript
// Use Stripe test keys in development
const stripe = new Stripe(
  process.env.NODE_ENV === 'production'
    ? process.env.STRIPE_SECRET_KEY!
    : process.env.STRIPE_TEST_SECRET_KEY!
)
```

**Benefits:**
- No real charges
- Separate test customers
- Official Stripe testing approach

**Webhook handling:**
```typescript
// Detect test mode events
if (event.livemode === false) {
  // This is a test webhook
  // Don't create production records
}
```

## Additional Security Measures

### 1. Restrict TEST_MODE to Development
```typescript
// Only allow TEST_MODE in development
if (process.env.TEST_MODE === 'true' && process.env.NODE_ENV === 'production') {
  throw new Error('TEST_MODE cannot be enabled in production')
}
```

### 2. Add Warning Logs
```typescript
if (process.env.TEST_MODE === 'true') {
  console.warn('⚠️ TEST_MODE ENABLED - Creating test data')
}
```

### 3. Admin Dashboard Test Data Toggle
```typescript
// Filter to hide/show test data
<Toggle
  label="Show test data"
  onChange={(show) => setIncludeTestData(show)}
/>
```

## Recommended Approach

**Immediate:**
1. Add `is_test_data` flag to all tables
2. Update TEST_MODE code to set flag
3. Update all analytics queries to exclude test data
4. Create cleanup script

**Long-term:**
1. Use separate test database
2. Use Stripe test mode for payment testing
3. Remove TEST_MODE from production entirely

## Acceptance Criteria
- [ ] Test data clearly marked with `is_test_data` flag
- [ ] All analytics exclude test data by default
- [ ] Cleanup script created and tested
- [ ] TEST_MODE disabled in production OR
- [ ] Separate test database configured
- [ ] Admin dashboard can filter test data
- [ ] Documentation on test data management
- [ ] Monitoring alerts if test data appears in production
