# Database Schema Mismatch: Missing subscription_id Column

## Priority
⚠️ **HIGH**

## Labels
`bug`, `database`, `high-priority`, `schema`

## Description
The `coupon_usage` table is missing a `subscription_id` column, but the Stripe webhook attempts to insert it, causing silent failures in coupon tracking.

## Location
- **Schema**: `scripts/010_add_missing_functions.sql` (lines 46-56)
- **Usage**: Stripe webhook tries to insert `subscription_id` (line 107)

## Current Schema
```sql
CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  -- subscription_id is MISSING
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Error Pattern
Webhook code:
```typescript
await supabase.from('coupon_usage').insert({
  coupon_id: coupon.id,
  user_id: subscription.user_id,
  subscription_id: subscription.id,  // ❌ Column doesn't exist
  used_at: new Date().toISOString()
})
```

## Impact
- Coupon usage not tracked
- Employee commissions not calculated correctly
- Cannot link coupons to specific subscriptions
- Silent data loss (webhook continues despite error)

## Recommended Fix

### Migration Script
**File to create**: `scripts/012_add_subscription_id_to_coupon_usage.sql`

```sql
-- Add missing subscription_id column
ALTER TABLE coupon_usage
ADD COLUMN IF NOT EXISTS subscription_id UUID
REFERENCES subscriptions(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_coupon_usage_subscription_id
ON coupon_usage(subscription_id);

-- Add composite index for common queries
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_subscription
ON coupon_usage(coupon_id, subscription_id);
```

## Acceptance Criteria
- [ ] Migration script created and tested
- [ ] Column added to `coupon_usage` table
- [ ] Foreign key constraint properly set
- [ ] Indexes created for performance
- [ ] Webhook successfully inserts subscription_id
- [ ] Existing records handled (NULL allowed or backfilled)
- [ ] Database types regenerated (`pnpm db:types`)
