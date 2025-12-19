# Legal Liability: Misleading Claims in PDF Footer

## Priority
🚨 **CRITICAL**

## Labels
`critical`, `security`, `legal`, `bug`

## Description
The PDF footer states "This document has been reviewed and approved by a licensed attorney" but the application uses admin reviewers who may not be licensed attorneys. This creates serious legal liability and potential regulatory violations.

## Location
- **File**: `app/api/letters/[id]/pdf/route.ts`
- **Line**: 66

## Current Behavior
```typescript
const footer = "This document has been reviewed and approved by a licensed attorney.";
```

## Risk
- Legal liability for unauthorized practice of law
- Consumer protection violations
- Potential state bar complaints
- False advertising claims

## Recommended Fix
Change footer text to be accurate:
```typescript
const footer = "This document has been reviewed and approved by our legal review team.";
```

Or alternatively:
```typescript
const footer = "This document has been reviewed and approved by our review team.";
```

## Acceptance Criteria
- [ ] PDF footer updated to remove "licensed attorney" claim
- [ ] All existing PDFs flagged for regeneration (if stored)
- [ ] Legal team reviews new footer language
- [ ] Terms of service updated to clarify reviewer qualifications
