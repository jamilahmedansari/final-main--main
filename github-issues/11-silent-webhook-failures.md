# Silent Failures in Stripe Webhook: Lost Revenue Tracking

## Priority
⚠️ **MEDIUM**

## Labels
`bug`, `medium-priority`, `payments`, `data-integrity`

## Description
Coupon usage tracking and commission creation errors are logged but don't fail the webhook. This could lead to lost revenue tracking and incorrect employee commissions.

## Location
- **File**: `app/api/stripe/webhook/route.ts`
- **Lines**: 114-126 (coupon usage), 167-173 (commission creation), 184-187 (status update)

## Current Behavior
```typescript
// Coupon tracking error - silently continues
if (couponError) {
  console.error('Error recording coupon usage:', couponError)
  // ❌ Webhook returns 200 OK anyway
}

// Commission creation error - silently continues
if (commissionError) {
  console.error('Error creating commission:', commissionError)
  // ❌ Webhook returns 200 OK anyway
}
```

## Impact
**Scenario 1: Lost Coupon Attribution**
1. User subscribes with employee coupon `EMP123`
2. Subscription created successfully ✅
3. Coupon usage insert fails ❌
4. Webhook returns 200 OK
5. Employee never gets credit for referral
6. Commission never created
7. No way to detect or recover

**Scenario 2: Duplicate Webhooks**
1. Stripe retries webhook due to network issue
2. Subscription already exists (duplicate event)
3. Commission creation fails (duplicate key or other error)
4. Returns 200 OK
5. Stripe stops retrying
6. No commission record exists

## Risk
- Lost employee commissions → employee disputes
- Inaccurate referral metrics
- Cannot reconcile coupon effectiveness
- Financial reporting gaps

## Recommended Fix

**Option 1: Idempotent Operations with Retry Queue**
```typescript
// Make operations idempotent
await supabase.from('coupon_usage').upsert({
  id: `${subscription.id}-${coupon.id}`, // Deterministic ID
  coupon_id: coupon.id,
  user_id: subscription.user_id,
  subscription_id: subscription.id
}, { onConflict: 'id' })

// If fails, add to retry queue instead of silently continuing
if (couponError) {
  await addToRetryQueue({
    operation: 'record_coupon_usage',
    data: { subscription_id, coupon_id },
    attempts: 0
  })
}
```

**Option 2: Database Transaction**
```typescript
// Wrap all operations in transaction
await supabase.rpc('process_subscription_with_coupon', {
  p_subscription_id: subscription.id,
  p_coupon_code: metadata.coupon_code,
  // ... other params
})
```

**Option 3: Return 5xx on Critical Failures**
```typescript
if (couponError) {
  console.error('Critical: Coupon usage tracking failed:', couponError)
  // Return 500 so Stripe retries
  return NextResponse.json(
    { error: 'Failed to process coupon' },
    { status: 500 }
  )
}
```

## Trade-offs
- **Option 1**: Most robust, requires retry queue infrastructure
- **Option 2**: Clean, but requires refactoring to database functions
- **Option 3**: Simple, but relies on Stripe retry mechanism

## Acceptance Criteria
- [ ] Critical webhook operations wrapped in transaction OR
- [ ] Failed operations added to retry queue OR
- [ ] Webhook returns 5xx on critical failures
- [ ] Idempotent keys used to prevent duplicates
- [ ] Monitoring/alerting on webhook failures
- [ ] Manual reconciliation process documented
- [ ] Test duplicate webhook scenarios
