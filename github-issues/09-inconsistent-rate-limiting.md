# Inconsistent Rate Limiting: Reject Endpoint Missing Protection

## Priority
⚠️ **MEDIUM**

## Labels
`bug`, `security`, `medium-priority`, `rate-limiting`

## Description
The approve endpoint has rate limiting protection, but the reject endpoint does not. This inconsistency creates a security gap where malicious actors could spam rejection requests.

## Location
- **With Rate Limiting**: `app/api/letters/[id]/approve/route.ts` (has protection)
- **Missing Rate Limiting**: `app/api/letters/[id]/reject/route.ts` (no protection)

## Current State

**Approve Endpoint (Protected)**
```typescript
const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 10, "15 m")
if (rateLimitResponse) return rateLimitResponse
```

**Reject Endpoint (Unprotected)**
```typescript
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // No rate limiting check
  const supabase = await createClient()
  // ... rest of handler
}
```

## Attack Vector
1. Attacker identifies letter IDs
2. Spams rejection endpoint
3. Could cause:
   - Database load
   - Audit log spam
   - Legitimate rejections masked
   - Admin notification flood (if implemented)

## Impact
- DoS potential on admin operations
- Audit trail pollution
- Inconsistent security posture

## Recommended Fix

```typescript
import { adminRateLimit, safeApplyRateLimit } from "@/lib/rate-limit"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Add rate limiting
  const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 10, "15 m")
  if (rateLimitResponse) return rateLimitResponse

  const supabase = await createClient()
  // ... rest of handler
}
```

## Additional Endpoints to Review
Ensure ALL admin endpoints have consistent rate limiting:
- [ ] `/api/letters/[id]/approve`
- [ ] `/api/letters/[id]/reject`
- [ ] `/api/letters/[id]/improve`
- [ ] `/api/letters/[id]/submit`
- [ ] Any other admin-only operations

## Acceptance Criteria
- [ ] Reject endpoint has rate limiting (10 requests per 15 minutes)
- [ ] Rate limit configuration matches approve endpoint
- [ ] All admin endpoints audited for rate limiting
- [ ] Rate limit exceeded returns proper 429 status
- [ ] Documentation updated with rate limit policy
