# Missing Letter Deletion Feature

## Priority
🔧 **LOW**

## Labels
`feature-missing`, `low-priority`, `privacy`, `enhancement`

## Description
Users cannot delete their letters from the dashboard. This creates privacy concerns and clutters the interface with old drafts or rejected letters.

## User Impact
- Cannot remove embarrassing drafts
- Cannot clean up rejected letters
- Privacy concerns (old letters remain indefinitely)
- Dashboard becomes cluttered over time
- GDPR "right to be forgotten" implications

## Current State
- Letters can be created ✅
- Letters can be viewed ✅
- Letters can be edited (maybe?)
- Letters CANNOT be deleted ❌

## Required Implementation

### 1. API Endpoint
**File to create**: `app/api/letters/[id]/delete/route.ts`

```typescript
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    // 1. Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Fetch letter to verify ownership and status
    const { data: letter, error: fetchError } = await supabase
      .from('letters')
      .select('user_id, status, reviewed_by')
      .eq('id', id)
      .single()

    if (fetchError || !letter) {
      return NextResponse.json({ error: "Letter not found" }, { status: 404 })
    }

    // 3. Authorization check
    if (letter.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 4. Business rules - what can be deleted?
    // Option A: Only drafts
    if (letter.status !== 'draft') {
      return NextResponse.json({
        error: "Only draft letters can be deleted"
      }, { status: 400 })
    }

    // Option B: Allow deleting any status
    // (consider audit/compliance implications)

    // 5. Soft delete or hard delete?
    // Option A: Soft delete (recommended)
    const { error: deleteError } = await supabase
      .from('letters')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'deleted'
      })
      .eq('id', id)

    // Option B: Hard delete
    // const { error: deleteError } = await supabase
    //   .from('letters')
    //   .delete()
    //   .eq('id', id)

    if (deleteError) {
      throw deleteError
    }

    // 6. Audit logging
    await supabase.rpc('log_letter_audit', {
      p_letter_id: id,
      p_action: 'deleted',
      p_old_status: letter.status,
      p_new_status: 'deleted',
      p_notes: 'Letter deleted by user'
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DeleteLetter] Error:', error)
    return NextResponse.json({
      error: "Failed to delete letter"
    }, { status: 500 })
  }
}
```

### 2. UI Component
Update letter card/list to include delete button:

```typescript
<Button
  variant="destructive"
  size="sm"
  onClick={() => handleDelete(letter.id)}
  disabled={letter.status !== 'draft'}
>
  Delete
</Button>
```

### 3. Confirmation Modal
```typescript
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete Letter?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone. This will permanently delete your letter.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={confirmDelete}>
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

## Business Rules to Consider

### What Can Be Deleted?
- **Option 1**: Only drafts (safest)
- **Option 2**: Drafts + rejected letters
- **Option 3**: Any letter except completed (with audit trail)
- **Option 4**: Any letter (with admin override for legal hold)

### Soft vs Hard Delete
- **Soft Delete** (Recommended):
  - Add `deleted_at` timestamp
  - Keep data for audit/legal compliance
  - Filter out deleted letters in queries
  - Allow admin recovery if needed

- **Hard Delete**:
  - Permanently remove from database
  - Cascade delete audit logs? (risky)
  - Cannot recover
  - GDPR compliance easier

### Credit Refund?
Should deleting a letter refund the credit?
- **No refund**: Letter was generated, AI cost incurred
- **Refund if draft**: Never completed, fair to refund
- **Partial refund**: Based on status

## Database Changes Needed (if soft delete)

```sql
-- Add deleted_at column
ALTER TABLE letters ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add deleted status to valid statuses
-- (if using status enum)

-- Update RLS policies to exclude deleted
CREATE POLICY "Users can view their non-deleted letters"
ON letters FOR SELECT
USING (
  auth.uid() = user_id
  AND deleted_at IS NULL
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_letters_deleted_at
ON letters(deleted_at)
WHERE deleted_at IS NOT NULL;
```

## Acceptance Criteria
- [ ] DELETE endpoint created with authorization
- [ ] Only letter owner can delete
- [ ] Business rules enforced (what can be deleted)
- [ ] Audit logging on deletion
- [ ] UI shows delete button with confirmation
- [ ] Optimistic UI update (instant feedback)
- [ ] Error handling (letter not found, unauthorized, etc.)
- [ ] Soft delete vs hard delete decision documented
- [ ] RLS policies updated
- [ ] Consider credit refund policy
- [ ] GDPR compliance reviewed
