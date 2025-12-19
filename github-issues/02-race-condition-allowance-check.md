# Race Condition in Letter Allowance Check

## Priority
🚨 **HIGH**

## Labels
`bug`, `security`, `high-priority`, `concurrency`

## Description
The free trial check and credit deduction are separate queries, allowing users to trigger multiple letter generation requests simultaneously and bypass credit limits.

## Location
- **File**: `app/api/generate-letter/route.ts`
- **Lines**: 36-59

## Current Behavior
1. Check if user has free trial (query 1)
2. Check if user has credits (query 2)
3. Generate letter
4. Deduct credit (query 3)

If user sends 5 requests simultaneously, all pass the check before any deduction occurs.

## Steps to Reproduce
1. User with 1 credit remaining
2. Send 5 simultaneous POST requests to `/api/generate-letter`
3. All 5 requests pass the credit check
4. User gets 5 letters for 1 credit

## Impact
- Revenue loss from bypassed credit checks
- Unlimited free trial abuse
- Unfair usage patterns

## Recommended Fix

**Option 1: Database Transaction**
```typescript
const { data, error } = await supabase.rpc('atomic_deduct_and_generate', {
  user_id: user.id
})
if (error || !data.has_allowance) {
  return NextResponse.json({ error: "No credits available" }, { status: 403 })
}
```

**Option 2: Optimistic Locking**
Use `deduct_letter_allowance()` BEFORE generation, then rollback if generation fails.

## Acceptance Criteria
- [ ] Concurrent requests properly handled
- [ ] Credit check and deduction are atomic
- [ ] Load testing confirms fix works under concurrency
- [ ] Audit log shows all deduction attempts
