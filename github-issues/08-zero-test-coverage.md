# Zero Test Coverage - Critical Paths Untested

## Priority
⚠️ **HIGH**

## Labels
`testing`, `technical-debt`, `high-priority`, `quality`

## Description
No test files exist in the codebase. Critical paths including payment processing, letter generation, role-based authorization, and free trial logic are completely untested.

## Current State
- No `__tests__` directories
- No `.test.ts` or `.spec.ts` files
- No testing framework configured
- No CI/CD test runner

## Risk
- Regressions introduced without detection
- Payment bugs could cause revenue loss
- Security vulnerabilities in auth not caught
- Refactoring is dangerous without test safety net
- Cannot confidently deploy changes

## Recommended Implementation

### 1. Setup Testing Infrastructure
```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
pnpm add -D @testing-library/user-event msw
```

### 2. Priority Test Coverage

**Critical (Must Have)**
- [ ] Payment webhook processing (`/api/stripe/webhook`)
- [ ] Letter status workflow and transitions
- [ ] Role-based authorization (subscriber/employee/admin)
- [ ] Free trial logic and credit deduction
- [ ] RLS policy enforcement

**High Priority**
- [ ] Letter generation API endpoint
- [ ] Coupon validation and usage
- [ ] Subscription allowance checks
- [ ] PDF generation
- [ ] Admin approval/rejection flow

**Medium Priority**
- [ ] Dashboard data fetching
- [ ] Form validation
- [ ] UI component rendering
- [ ] Error handling paths

### 3. Test Structure
```
__tests__/
├── api/
│   ├── generate-letter.test.ts
│   ├── stripe-webhook.test.ts
│   └── letters/
│       ├── approve.test.ts
│       └── reject.test.ts
├── lib/
│   ├── auth.test.ts
│   └── database-functions.test.ts
└── components/
    └── admin/
        └── letter-review.test.ts
```

### 4. Testing Patterns

**API Route Tests**
```typescript
describe('POST /api/generate-letter', () => {
  it('should deduct credit for paid user', async () => {
    // Mock authenticated user with subscription
    // Call endpoint
    // Assert credit deducted
    // Assert letter created
  })

  it('should prevent concurrent credit bypass', async () => {
    // Test race condition fix
  })
})
```

**Database Function Tests**
```typescript
describe('check_letter_allowance', () => {
  it('should return correct allowance for free trial', async () => {})
  it('should return false when credits exhausted', async () => {})
})
```

## Acceptance Criteria
- [ ] Testing framework configured (Vitest + React Testing Library)
- [ ] At least 60% coverage on critical paths
- [ ] CI/CD runs tests on every commit
- [ ] Test database setup with migrations
- [ ] Mock Stripe webhooks
- [ ] Mock OpenAI API calls
- [ ] Documentation on running tests
