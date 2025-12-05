# Missing Subscription Cancellation Flow

## Priority
⚠️ **HIGH**

## Labels
`feature-missing`, `high-priority`, `legal`, `user-experience`

## Description
There is no API endpoint or UI for users to cancel their subscriptions. This violates consumer protection best practices and potentially legal requirements in some jurisdictions.

## Current State
- Users can subscribe via Stripe checkout
- No cancellation endpoint exists
- Users must contact support or use Stripe customer portal (if configured)

## Legal/Compliance Risk
- FTC regulations require easy cancellation
- State laws (e.g., California) mandate cancel mechanisms
- Churn risk if users can't self-serve cancellation
- Support burden handling manual cancellations

## Required Implementation

### 1. API Endpoint
**File to create**: `app/api/subscriptions/cancel/route.ts`

```typescript
export async function POST(request: NextRequest) {
  // 1. Verify user authentication
  // 2. Get active subscription
  // 3. Cancel in Stripe: stripe.subscriptions.cancel(subscriptionId)
  // 4. Update database: status = 'cancelled'
  // 5. Log cancellation in audit trail
  // 6. Send confirmation email
}
```

### 2. UI Component
Update subscription management page to include:
- Clear "Cancel Subscription" button
- Confirmation modal with cancellation terms
- Feedback on what happens (credits, access period, etc.)
- Success/error states

### 3. Business Logic
- Immediate cancellation vs. end of billing period
- Handle unused credits (refund, expire, or allow usage)
- Prevent re-cancellation attempts
- Allow reactivation flow

## Acceptance Criteria
- [ ] POST `/api/subscriptions/cancel` endpoint created
- [ ] Stripe subscription properly cancelled
- [ ] Database status updated
- [ ] User receives confirmation email
- [ ] UI shows cancellation button and modal
- [ ] Clear messaging about what happens post-cancellation
- [ ] Audit log tracks cancellations
- [ ] Handle edge cases (already cancelled, no active subscription)
- [ ] Consider retention offer before final cancellation
