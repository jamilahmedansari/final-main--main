# Missing Audit Logging in Submit Endpoint

## Priority
⚠️ **HIGH**

## Labels
`bug`, `compliance`, `audit`, `high-priority`

## Description
The submit endpoint updates letter status from `draft` to `pending_review` but doesn't call `log_letter_audit()`, violating the documented requirement that "ALL letter status changes MUST log via `log_letter_audit()`".

## Location
- **File**: `app/api/letters/[id]/submit/route.ts`
- **Lines**: 1-56

## Documentation Reference
From `CLAUDE.md`:
> **All transitions**: MUST log via `log_letter_audit()`

## Current Behavior
```typescript
.update({
  status: 'pending_review',
  submitted_at: new Date().toISOString()
})
// Missing: log_letter_audit() call
```

## Impact
- Incomplete audit trail
- Compliance violations (SOC2, HIPAA if applicable)
- Cannot track when letters were submitted
- Cannot debug status transition issues
- Potential legal discovery gaps

## Recommended Fix
```typescript
// After status update
await supabase.rpc('log_letter_audit', {
  p_letter_id: id,
  p_action: 'submitted',
  p_old_status: 'draft',
  p_new_status: 'pending_review',
  p_notes: 'Letter submitted for review by user'
})
```

## Additional Audit Gaps to Check
- [ ] All endpoints that modify letter status
- [ ] Bulk status updates
- [ ] Automated status transitions (if any)

## Acceptance Criteria
- [ ] Submit endpoint logs audit entry
- [ ] Audit includes old_status, new_status, timestamp, user_id
- [ ] Error handling if audit logging fails
- [ ] Verify all other status transitions have audit logging
