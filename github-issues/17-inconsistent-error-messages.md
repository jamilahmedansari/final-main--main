# Inconsistent Error Messages Expose Internal Details

## Priority
🔧 **LOW**

## Labels
`security`, `low-priority`, `ux`, `information-disclosure`

## Description
Some API routes return detailed error messages good for debugging but problematic in production. Generic messages should be shown to users while detailed errors are logged server-side.

## Examples

### Over-Sharing (Security Risk)
```typescript
// ❌ Exposes database structure
return NextResponse.json({
  error: "Foreign key constraint violation on subscriptions.user_id"
}, { status: 500 })

// ❌ Exposes internal logic
return NextResponse.json({
  error: "OpenAI API key invalid: sk-proj-xxxxx"
}, { status: 500 })

// ❌ Helps attackers enumerate
return NextResponse.json({
  error: "User with ID abc-123 not found in profiles table"
}, { status: 404 })
```

### Better Approach
```typescript
// ✅ Generic to user, detailed in logs
console.error('[GenerateLetter] Database error:', error)
return NextResponse.json({
  error: "Unable to generate letter. Please try again."
}, { status: 500 })
```

## Security Concerns
1. **Information Disclosure**: Reveals database schema, table names, column names
2. **Enumeration Attacks**: Helps attackers discover valid IDs, users, resources
3. **Stack Traces**: Production errors shouldn't show stack traces
4. **API Keys**: Partial key exposure in error messages

## Recommended Fix

### Error Helper Utility
**File to create**: `lib/errors.ts`

```typescript
const isDevelopment = process.env.NODE_ENV === 'development'

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public userMessage?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function formatErrorResponse(error: unknown, context: string) {
  console.error(`[${context}] Error:`, error)

  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: error.userMessage || 'An error occurred',
        ...(isDevelopment && { details: error.details })
      }
    }
  }

  // Unknown error - never expose details in production
  return {
    status: 500,
    body: {
      error: 'Internal server error',
      ...(isDevelopment && { details: String(error) })
    }
  }
}
```

### Usage in API Routes
```typescript
import { formatErrorResponse, AppError } from '@/lib/errors'

export async function POST(request: NextRequest) {
  try {
    // ... business logic

    if (!hasPermission) {
      throw new AppError(
        'Permission denied for user ' + userId, // Logged
        403,
        'You do not have permission to perform this action' // Shown to user
      )
    }

  } catch (error) {
    const { status, body } = formatErrorResponse(error, 'GenerateLetter')
    return NextResponse.json(body, { status })
  }
}
```

## Error Message Categories

### User-Friendly Messages
| Scenario | Generic Message |
|----------|----------------|
| Database error | "Unable to complete request. Please try again." |
| Not found | "Resource not found." |
| Unauthorized | "You must be logged in to access this resource." |
| Forbidden | "You do not have permission to perform this action." |
| Rate limited | "Too many requests. Please try again later." |
| Validation error | "Invalid input. Please check your data." |

### Development-Only Details
- Full error stack traces
- Database constraint violations
- SQL query details
- API response payloads

## Additional Improvements
1. **Error IDs**: Generate unique error IDs for correlation
   ```typescript
   const errorId = crypto.randomUUID()
   console.error(`[${errorId}] Error:`, error)
   return { error: 'An error occurred', errorId }
   ```

2. **Structured Logging**: Use proper logging library
   ```typescript
   logger.error('Generate letter failed', {
     userId,
     errorId,
     error: error.message,
     stack: error.stack
   })
   ```

3. **Error Monitoring**: Integrate Sentry or similar
   ```typescript
   Sentry.captureException(error, { user: { id: userId } })
   ```

## Acceptance Criteria
- [ ] Error utility created
- [ ] All API routes use error helper
- [ ] No internal details exposed in production
- [ ] Development mode shows full errors
- [ ] Consistent error format across all endpoints
- [ ] Error IDs for tracking
- [ ] Documentation on error handling pattern
