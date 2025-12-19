# No Validation for Letter Status Transitions

## Priority
⚠️ **MEDIUM**

## Labels
`bug`, `medium-priority`, `business-logic`, `validation`

## Description
Letter status changes don't validate against the documented workflow, allowing invalid state transitions like `approved` → `rejected` or `completed` → `draft`.

## Documentation Reference
From `CLAUDE.md`:
```
draft → generating → pending_review → under_review → approved → completed
                                                   ↘ rejected
```

## Current Behavior
All status update endpoints accept any status change without validation:

```typescript
// ❌ No validation - can go from any status to any status
await supabase
  .from('letters')
  .update({ status: 'approved' })
  .eq('id', letterId)
```

## Invalid Transitions Currently Allowed
- `approved` → `rejected` (should be immutable once approved)
- `completed` → `draft` (completed letters shouldn't revert)
- `rejected` → `approved` (should require new review)
- Skipping states (e.g., `draft` → `approved` without review)

## Impact
- Data integrity issues
- Audit trail confusion
- Business logic bypassed
- Potential for abuse

## Recommended Fix

### Option 1: Database Constraint Function
```sql
CREATE OR REPLACE FUNCTION validate_letter_status_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Define valid transitions
  IF OLD.status = 'draft' AND NEW.status NOT IN ('generating', 'pending_review') THEN
    RAISE EXCEPTION 'Invalid transition from draft to %', NEW.status;
  END IF;

  IF OLD.status = 'generating' AND NEW.status NOT IN ('pending_review', 'draft') THEN
    RAISE EXCEPTION 'Invalid transition from generating to %', NEW.status;
  END IF;

  IF OLD.status = 'pending_review' AND NEW.status NOT IN ('under_review', 'draft') THEN
    RAISE EXCEPTION 'Invalid transition from pending_review to %', NEW.status;
  END IF;

  IF OLD.status = 'under_review' AND NEW.status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid transition from under_review to %', NEW.status;
  END IF;

  IF OLD.status = 'approved' AND NEW.status != 'completed' THEN
    RAISE EXCEPTION 'Approved letters can only move to completed';
  END IF;

  IF OLD.status IN ('completed', 'rejected') THEN
    RAISE EXCEPTION 'Cannot change status of % letters', OLD.status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER letter_status_transition_check
  BEFORE UPDATE ON letters
  FOR EACH ROW
  EXECUTE FUNCTION validate_letter_status_transition();
```

### Option 2: Application-Level Validation
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['generating', 'pending_review'],
  generating: ['pending_review', 'draft'],
  pending_review: ['under_review', 'draft'],
  under_review: ['approved', 'rejected'],
  approved: ['completed'],
  completed: [],
  rejected: []
}

function validateTransition(oldStatus: string, newStatus: string) {
  if (!VALID_TRANSITIONS[oldStatus]?.includes(newStatus)) {
    throw new Error(`Invalid transition: ${oldStatus} → ${newStatus}`)
  }
}
```

## Additional Considerations
- Allow admin override for edge cases (with audit log)
- Handle manual status fixes (require super admin)
- Document all valid transitions
- Add status transition diagram to docs

## Acceptance Criteria
- [ ] Status transitions validated before update
- [ ] Invalid transitions rejected with clear error
- [ ] Database trigger OR application validation implemented
- [ ] All status update endpoints updated
- [ ] Tests cover all valid and invalid transitions
- [ ] Admin override mechanism (if needed)
- [ ] Documentation updated with state machine diagram
