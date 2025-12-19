# Excessive Console Logging (97 Statements)

## Priority
🔧 **LOW**

## Labels
`technical-debt`, `low-priority`, `logging`, `security`

## Description
There are 97 `console.log`, `console.error`, and `console.warn` statements throughout the application code. Production logs could expose sensitive data, and console logging lacks structure for proper monitoring.

## Issues with Console Logging

### 1. Security Risks
```typescript
// ❌ Could log sensitive data
console.log('User data:', user) // Might include email, tokens
console.log('Stripe event:', event) // Contains payment info
console.log('Letter content:', content) // PII data
```

### 2. No Log Levels
- Can't filter by severity
- Can't disable debug logs in production
- All logs treated equally

### 3. No Structured Data
- Hard to query/analyze
- Can't correlate across services
- No metadata (timestamps, request IDs, user context)

### 4. Production Noise
- Debug logs clutter production
- Increases log storage costs
- Makes critical errors harder to find

## Recommended Fix

### Option 1: Lightweight Logger Wrapper
**File to create**: `lib/logger.ts`

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

const levels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

class Logger {
  private shouldLog(level: LogLevel): boolean {
    return levels[level] >= levels[LOG_LEVEL]
  }

  private sanitize(data: any): any {
    // Remove sensitive fields
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data }
      const sensitiveFields = ['password', 'token', 'api_key', 'secret']

      for (const field of sensitiveFields) {
        if (field in sanitized) {
          sanitized[field] = '[REDACTED]'
        }
      }
      return sanitized
    }
    return data
  }

  debug(message: string, meta?: any) {
    if (this.shouldLog('debug')) {
      console.log(`[DEBUG] ${message}`, this.sanitize(meta))
    }
  }

  info(message: string, meta?: any) {
    if (this.shouldLog('info')) {
      console.log(`[INFO] ${message}`, this.sanitize(meta))
    }
  }

  warn(message: string, meta?: any) {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, this.sanitize(meta))
    }
  }

  error(message: string, error?: any, meta?: any) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, {
        error: error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error,
        ...this.sanitize(meta)
      })
    }
  }
}

export const logger = new Logger()
```

### Option 2: Use Pino (Production-Grade)
```bash
pnpm add pino pino-pretty
```

```typescript
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined,
  redact: ['password', 'token', 'api_key', 'secret', 'authorization']
})
```

### Migration Pattern
```typescript
// ❌ Before
console.log('Generating letter for user:', userId)

// ✅ After
logger.info('Generating letter', { userId })
```

```typescript
// ❌ Before
console.error('Failed to generate letter:', error)

// ✅ After
logger.error('Failed to generate letter', error, { userId, letterId })
```

## Migration Strategy

### Phase 1: Replace in Critical Paths (Priority)
- Payment processing
- Authentication
- Letter generation
- Stripe webhooks

### Phase 2: Replace in API Routes
- All `/api/*` endpoints

### Phase 3: Replace in Components
- Client-side logging (consider different strategy)

### Phase 4: Clean Up
- Remove unused debug logs
- Set appropriate log levels

## Environment Configuration
```env
# Development
LOG_LEVEL=debug

# Staging
LOG_LEVEL=info

# Production
LOG_LEVEL=warn
```

## Additional Improvements

### 1. Request Correlation
```typescript
export function withRequestId(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID()
  return logger.child({ requestId })
}
```

### 2. User Context
```typescript
export function withUser(userId: string) {
  return logger.child({ userId })
}
```

### 3. Performance Logging
```typescript
const start = Date.now()
// ... operation
logger.info('Letter generated', {
  duration: Date.now() - start,
  letterId
})
```

## Acceptance Criteria
- [ ] Logger utility created
- [ ] Sensitive data redaction implemented
- [ ] Critical paths migrated first
- [ ] All API routes use structured logging
- [ ] Log levels configurable via env var
- [ ] Production logs don't expose sensitive data
- [ ] Documentation on logging standards
- [ ] Consider log aggregation (Datadog, CloudWatch, etc.)
