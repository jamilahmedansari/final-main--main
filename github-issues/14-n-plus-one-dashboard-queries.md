# N+1 Query Problem in Dashboard

## Priority
⚠️ **MEDIUM**

## Labels
`performance`, `medium-priority`, `optimization`, `database`

## Description
The dashboard makes two separate sequential queries for letters and subscription data that should be combined or run in parallel.

## Location
- **File**: `app/dashboard/page.tsx`
- **Lines**: 19-32

## Current Implementation
```typescript
// Query 1 - Sequential
const { data: letters } = await supabase
  .from('letters')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(5)

// Query 2 - Sequential (waits for query 1)
const { data: subscriptions } = await supabase
  .from('subscriptions')
  .select('*')
  .eq('user_id', user.id)
```

## Performance Impact
- **Current**: Query 1 (50ms) → Query 2 (50ms) = **100ms total**
- **Parallel**: max(Query 1, Query 2) = **~50ms total**
- **Improvement**: 50% faster page load

## Recommended Fix

### Option 1: Parallel Queries (Quick Win)
```typescript
const [lettersResult, subscriptionsResult] = await Promise.all([
  supabase
    .from('letters')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5),

  supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', user.id)
])

const { data: letters, error: lettersError } = lettersResult
const { data: subscriptions, error: subscriptionsError } = subscriptionsResult
```

### Option 2: Aggregate Query with Database Function
```sql
CREATE OR REPLACE FUNCTION get_dashboard_data(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'letters', (
      SELECT json_agg(row_to_json(l))
      FROM (
        SELECT * FROM letters
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 5
      ) l
    ),
    'subscriptions', (
      SELECT json_agg(row_to_json(s))
      FROM subscriptions s
      WHERE user_id = p_user_id
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

```typescript
const { data } = await supabase.rpc('get_dashboard_data', {
  p_user_id: user.id
})
```

### Option 3: Join Query (if relationship needed)
```typescript
const { data } = await supabase
  .from('subscriptions')
  .select(`
    *,
    letters:letters(*)
  `)
  .eq('user_id', user.id)
```

## Other Dashboard Query Patterns to Review
Check these pages for similar issues:
- [ ] `/dashboard/letters` - Full letter list
- [ ] `/dashboard/subscription` - Subscription details
- [ ] `/secure-admin-gateway/letters` - Admin dashboard
- [ ] `/secure-admin-gateway/analytics` - Analytics page

## Acceptance Criteria
- [ ] Dashboard queries run in parallel
- [ ] Page load time measured before/after
- [ ] Error handling for both queries
- [ ] No N+1 queries in any dashboard page
- [ ] Consider React Suspense for streaming
- [ ] Loading states shown during data fetch
