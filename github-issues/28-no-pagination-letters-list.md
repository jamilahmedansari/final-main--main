# No Pagination on Letters List

## Priority
🔧 **LOW**

## Labels
`enhancement`, `low-priority`, `performance`, `scalability`

## Description
The dashboard shows only the 5 most recent letters with `.limit(5)`. For users with many letters, there's no way to view older letters or paginate through the full list.

## Location
- **File**: `app/dashboard/page.tsx`
- **Line**: 24

## Current Implementation
```typescript
const { data: letters } = await supabase
  .from('letters')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(5)  // ❌ Only 5 letters, no pagination
```

## User Impact
- Users with >5 letters cannot see older ones
- No way to search through letter history
- "View All" link likely exists but full page probably has same issue
- Poor UX for active users

## Scalability Concerns
As the app grows:
- Power users might have 50+ letters
- Loading all letters at once becomes slow
- Database query inefficient
- Large payload size

## Recommended Fix

### Option 1: Cursor-Based Pagination (Recommended)
Best for real-time data and scalability:

```typescript
export default async function LettersPage({
  searchParams
}: {
  searchParams: { cursor?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const PAGE_SIZE = 20

  let query = supabase
    .from('letters')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1)  // Fetch one extra to check if there's a next page

  // If cursor provided, start after that timestamp
  if (searchParams.cursor) {
    query = query.lt('created_at', searchParams.cursor)
  }

  const { data: letters } = await query

  // Check if there's a next page
  const hasMore = letters.length > PAGE_SIZE
  const displayLetters = hasMore ? letters.slice(0, PAGE_SIZE) : letters
  const nextCursor = hasMore ? letters[PAGE_SIZE - 1].created_at : null

  return (
    <div>
      <LettersList letters={displayLetters} />

      {/* Pagination */}
      <div className="flex justify-center gap-4 mt-6">
        {nextCursor && (
          <Link
            href={`/dashboard/letters?cursor=${nextCursor}`}
            className="btn"
          >
            Load More
          </Link>
        )}
      </div>
    </div>
  )
}
```

### Option 2: Offset-Based Pagination
Simpler but less performant for large datasets:

```typescript
const page = Number(searchParams.page) || 1
const pageSize = 20
const offset = (page - 1) * pageSize

const { data: letters, count } = await supabase
  .from('letters')
  .select('*', { count: 'exact' })
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .range(offset, offset + pageSize - 1)

const totalPages = Math.ceil(count / pageSize)
```

### Option 3: Infinite Scroll (Client-Side)
Modern UX with React:

```typescript
'use client'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useInView } from 'react-intersection-observer'

export function InfiniteLettersList() {
  const { ref, inView } = useInView()

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['letters'],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await fetch(`/api/letters?cursor=${pageParam}`)
      return res.json()
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor
  })

  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage()
    }
  }, [inView, hasNextPage])

  return (
    <div>
      {data?.pages.map((page) =>
        page.letters.map((letter) => (
          <LetterCard key={letter.id} letter={letter} />
        ))
      )}

      {/* Intersection observer trigger */}
      <div ref={ref}>
        {isFetchingNextPage && <Spinner />}
      </div>
    </div>
  )
}
```

### Option 4: "Load More" Button (Simplest)
```typescript
'use client'
import { useState } from 'react'

export function LettersList({ initialLetters }: { initialLetters: Letter[] }) {
  const [letters, setLetters] = useState(initialLetters)
  const [cursor, setCursor] = useState(initialLetters[initialLetters.length - 1]?.created_at)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialLetters.length === 20)

  const loadMore = async () => {
    setLoading(true)
    const res = await fetch(`/api/letters?cursor=${cursor}`)
    const data = await res.json()

    setLetters([...letters, ...data.letters])
    setCursor(data.nextCursor)
    setHasMore(data.hasMore)
    setLoading(false)
  }

  return (
    <div>
      {letters.map((letter) => (
        <LetterCard key={letter.id} letter={letter} />
      ))}

      {hasMore && (
        <Button onClick={loadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </Button>
      )}
    </div>
  )
}
```

## Additional Improvements

### Search/Filter
```typescript
const { data: letters } = await supabase
  .from('letters')
  .select('*')
  .eq('user_id', user.id)
  .eq('status', searchParams.status)  // Filter by status
  .ilike('title', `%${searchParams.search}%`)  // Search
  .order('created_at', { ascending: false })
```

### Sort Options
```typescript
const sortBy = searchParams.sort || 'created_at'
const sortOrder = searchParams.order === 'asc'

const { data: letters } = await supabase
  .from('letters')
  .select('*')
  .eq('user_id', user.id)
  .order(sortBy, { ascending: sortOrder })
```

## Performance Optimization

### Add Index
```sql
-- Already exists, but ensure:
CREATE INDEX IF NOT EXISTS idx_letters_user_created
ON letters(user_id, created_at DESC);
```

### Database Function
For complex pagination with counts:
```sql
CREATE OR REPLACE FUNCTION get_user_letters_paginated(
  p_user_id UUID,
  p_limit INT,
  p_offset INT
)
RETURNS TABLE (
  letters JSON,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    json_agg(row_to_json(l.*)) as letters,
    COUNT(*) OVER() as total_count
  FROM letters l
  WHERE l.user_id = p_user_id
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
```

## Acceptance Criteria
- [ ] Pagination implemented (cursor or offset)
- [ ] Users can access all their letters
- [ ] Performance tested with 100+ letters
- [ ] Page size configurable (10, 20, 50)
- [ ] Loading states during pagination
- [ ] URL reflects current page (for bookmarking)
- [ ] Mobile responsive
- [ ] Consider search/filter functionality
- [ ] Consider infinite scroll for modern UX
