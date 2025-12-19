# Missing Database Indexes on Commonly Queried Fields

## Priority
⚠️ **MEDIUM**

## Labels
`performance`, `database`, `medium-priority`, `optimization`

## Description
Several commonly queried fields lack indexes, leading to full table scans and poor performance as data grows.

## Missing Indexes

### 1. subscriptions.stripe_customer_id
**Usage**: Queried on every Stripe webhook
```typescript
.eq('stripe_customer_id', customerId)
```
**Impact**: O(n) scan on webhook processing - critical path

### 2. subscriptions.stripe_session_id
**Usage**: Queried during checkout success flow
```typescript
.eq('stripe_session_id', sessionId)
```
**Impact**: Slow checkout confirmation

### 3. letters.reviewed_by
**Usage**: Admin queries for "my reviewed letters"
```typescript
.eq('reviewed_by', adminId)
```
**Impact**: Slow admin dashboard

### 4. coupon_usage.created_at
**Usage**: Time-based reporting queries
```typescript
.gte('created_at', startDate)
.lte('created_at', endDate)
```
**Impact**: Slow analytics/reporting

### 5. letters.status
**Usage**: Filtering letters by status (very common)
```typescript
.eq('status', 'pending_review')
```
**Impact**: Slow letter lists

### 6. letter_audit.letter_id
**Usage**: Fetching audit history for a letter
```typescript
.eq('letter_id', letterId)
```
**Impact**: Slow audit log retrieval

### 7. commissions.employee_id + status (composite)
**Usage**: Employee dashboard - active commissions
```typescript
.eq('employee_id', empId)
.eq('status', 'pending')
```
**Impact**: Slow employee dashboard

## Recommended Fix

### Migration Script
**File to create**: `scripts/013_add_performance_indexes.sql`

```sql
-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id
  ON subscriptions(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_session_id
  ON subscriptions(stripe_session_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON subscriptions(user_id, status);

-- Letters indexes
CREATE INDEX IF NOT EXISTS idx_letters_status
  ON letters(status);

CREATE INDEX IF NOT EXISTS idx_letters_reviewed_by
  ON letters(reviewed_by)
  WHERE reviewed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_letters_user_status
  ON letters(user_id, status);

-- Coupon usage indexes
CREATE INDEX IF NOT EXISTS idx_coupon_usage_created_at
  ON coupon_usage(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id
  ON coupon_usage(coupon_id);

-- Letter audit indexes
CREATE INDEX IF NOT EXISTS idx_letter_audit_letter_id_created
  ON letter_audit(letter_id, created_at DESC);

-- Commissions indexes
CREATE INDEX IF NOT EXISTS idx_commissions_employee_status
  ON commissions(employee_id, status);

CREATE INDEX IF NOT EXISTS idx_commissions_subscription
  ON commissions(subscription_id);
```

## Performance Impact Estimate
| Query | Before (10k rows) | After | Improvement |
|-------|-------------------|-------|-------------|
| Webhook lookup | ~50ms | ~2ms | 25x faster |
| Letter status filter | ~100ms | ~5ms | 20x faster |
| Admin reviewed letters | ~80ms | ~3ms | 26x faster |
| Audit log fetch | ~120ms | ~4ms | 30x faster |

## Monitoring Recommendations
After adding indexes:
1. Run `EXPLAIN ANALYZE` on common queries
2. Monitor index usage with `pg_stat_user_indexes`
3. Check for unused indexes after 1 week
4. Monitor index bloat over time

## Acceptance Criteria
- [ ] All indexes created via migration
- [ ] Query performance tested before/after
- [ ] No regression on write performance
- [ ] `EXPLAIN ANALYZE` shows index usage
- [ ] Documentation updated
- [ ] Consider partial indexes where appropriate (e.g., `WHERE status = 'active'`)
