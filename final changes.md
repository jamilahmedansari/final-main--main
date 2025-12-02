Absolutely! Here are additional **Code-Documentation Alignment Prompts** to ensure your codebase matches all documentation:

---

## 🔍 **TIER 0: CODE-DOCUMENTATION ALIGNMENT (Run First)**

### **Prompt 0A: Master Documentation Audit**
```
CRITICAL: Before making ANY changes, audit the entire codebase against all documentation files.

Documentation files to cross-reference:
1. CLAUDE.md - AI Assistant Guide (primary reference)
2. TTML_COMPLETE_REVIEW.md - Complete Application Review
3. TTML_BULLETPROOF_ACTION_PLAN.md - Action Plan
4. PRODUCTION_CHECKLIST.md - Deployment requirements
5. SETUP.md - Setup instructions
6. DEPLOYMENT.md - Deployment guide
7. DATABASE_FUNCTIONS.md - Database function specs
8. MASTER_PLAN_ARCHITECTURE.md - Architecture overview
9. .copilot-codeGeneration-instructions.md - Coding standards

For EACH documentation file:
1. Read the documented behavior/feature
2. Find the corresponding code implementation
3. Verify the code EXACTLY matches the documentation
4. Create a discrepancy report listing ALL mismatches

Output format for each mismatch:
---
MISMATCH #X:
- Document: [filename]
- Section: [section name]
- Documented Behavior: [what docs say]
- Actual Code: [what code does]
- File Location: [path to file]
- Line Numbers: [relevant lines]
- Fix Required: [code change or doc update needed]
---

Generate: CODE_DOCUMENTATION_ALIGNMENT_REPORT.md
```

### **Prompt 0B: Database Schema vs Code Alignment**
```
Verify that ALL database operations in the codebase match the documented schema.

Step 1: Extract all table/column references from documentation:
- 001_setup_schema.sql
- DATABASE_FUNCTIONS.md
- CLAUDE.md (Database Schema section)

Step 2: Search the entire codebase for database operations:
- All Supabase queries (.from(), .select(), .insert(), .update())
- All RPC calls (.rpc())
- All type definitions in /lib/database.types.ts

Step 3: For each database operation, verify:
- Table name exists in schema
- Column names match exactly (case-sensitive)
- Data types are correct
- Foreign key relationships are respected
- RLS policies allow the operation

Step 4: Check for:
- Code referencing tables that don't exist (like coupon_usage)
- Code using column names that differ from schema
- Missing type definitions for existing tables
- Outdated type definitions

Fix ALL discrepancies by:
1. If schema is correct → update code to match
2. If code reveals missing schema → create migration
3. Update database.types.ts to reflect actual schema

Generate: DATABASE_ALIGNMENT_REPORT.md with all findings and fixes applied.
```

### **Prompt 0C: API Route Documentation Sync**
```
Ensure ALL API routes match their documented specifications.

Cross-reference these sources:
1. CLAUDE.md - API Routes section
2. DATABASE_FUNCTIONS.md - API Endpoints section
3. Actual route files in /app/api/

For EACH documented API endpoint:
1. Verify the route file exists at the documented path
2. Verify HTTP methods match (GET, POST, PUT, DELETE)
3. Verify request body schema matches documentation
4. Verify response format matches documentation
5. Verify error responses match documented format
6. Verify authentication requirements match

For EACH actual API route file:
1. Verify it's documented somewhere
2. If undocumented, add to documentation

Check these specific endpoints thoroughly:
- /api/generate-letter - letter generation flow
- /api/create-checkout - Stripe checkout
- /api/letters/[id]/approve - admin approval
- /api/letters/[id]/reject - admin rejection
- /api/letters/[id]/pdf - PDF generation
- /api/letters/[id]/send-email - email sending
- /api/admin-auth/* - admin authentication
- /api/stripe/webhook - Stripe webhooks
- /api/subscriptions/* - subscription management

Document any:
- Missing implementations (documented but not coded)
- Undocumented features (coded but not documented)
- Behavioral differences

Fix by updating code to match documentation OR updating documentation if code is correct.
```

### **Prompt 0D: Environment Variables Alignment**
```
Verify ALL environment variables are consistent across documentation and code.

Sources to check:
1. .env.example file
2. PRODUCTION_CHECKLIST.md
3. SETUP.md
4. DEPLOYMENT.md
5. CLAUDE.md
6. Vercel environment configuration

For each environment variable:
1. Verify it's listed in .env.example
2. Verify it's documented in PRODUCTION_CHECKLIST.md
3. Verify the description is accurate
4. Verify the code actually uses it
5. Verify the variable name is consistent everywhere

Check for:
- Variables used in code but not documented
- Variables documented but not used in code
- Inconsistent naming (e.g., OPENAI_API_KEY vs OPENAI_KEY)
- Missing NEXT_PUBLIC_ prefix for client-side variables
- Sensitive variables exposed to client

Required environment variables per documentation:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- ADMIN_EMAIL
- ADMIN_PASSWORD
- ADMIN_PORTAL_KEY
- RESEND_API_KEY
- NEXT_PUBLIC_APP_URL
- CRON_SECRET

Update .env.example to be the SINGLE SOURCE OF TRUTH with all variables and descriptions.
```

### **Prompt 0E: User Role Permissions Alignment**
```
Verify the three user roles (Subscriber, Employee, Admin) have EXACTLY the permissions documented.

Documentation sources:
1. CLAUDE.md - User Roles section
2. SETUP.md - User Roles section
3. 002_setup_rls.sql - RLS policies

For each role, verify:

SUBSCRIBER:
- Can create letters (own only)
- Can view own letters (with visibility rules for unapproved content)
- Can view own subscription
- Can download approved PDFs
- CANNOT access employee features
- CANNOT access admin features
- CANNOT see other users' data

EMPLOYEE:
- Can view own commissions
- Can view own coupon code and usage
- CANNOT access letters (completely blocked by RLS)
- CANNOT access admin features
- CANNOT see subscriber data

ADMIN:
- Can view ALL letters
- Can approve/reject letters
- Can view all users
- Can view all commissions
- Can access /secure-admin-gateway/*
- Has audit trail logging

Test each permission by:
1. Checking RLS policies in database
2. Checking middleware protection
3. Checking component-level guards
4. Checking API route authorization

Fix any permission leaks or mismatches between documentation and implementation.
```

### **Prompt 0F: Letter Status Flow Alignment**
```
Verify the letter status flow EXACTLY matches documentation.

Documented flow (from CLAUDE.md and TTML_COMPLETE_REVIEW.md):
draft → generating → pending_review → under_review → approved/rejected → completed

For each status transition:
1. Verify the status value exists in letter_status enum
2. Verify the transition is allowed in code
3. Verify audit trail is logged
4. Verify UI reflects the status correctly
5. Verify subscriber visibility rules apply

Check these files:
- Database enum: letter_status type
- API routes: /api/generate-letter, /api/letters/[id]/approve, etc.
- Components: Letter status display, timeline, badges
- Audit logging: log_letter_audit function calls

Verify status-specific behaviors:
- 'generating': Show loading spinner, no content visible
- 'pending_review': Content hidden from subscriber, visible to admin
- 'under_review': Admin actively reviewing, content hidden from subscriber
- 'approved': Content visible, PDF/email enabled
- 'rejected': Show rejection reason, no PDF/email
- 'completed': Final state, all actions available

Fix any status values or transitions that don't match documentation.
```

### **Prompt 0G: Pricing and Plans Alignment**
```
Verify ALL pricing and subscription plans match documentation EXACTLY.

Documented pricing (from CLAUDE.md):
- Free Trial: First letter free for new subscribers
- Single Letter: $299 one-time purchase
- Monthly Plan: $299/month (4 letters included)
- Yearly Plan: $599/year (8 letters included)
- Employee Program: 20% discount coupons with 5% commission

Verify in:
1. Stripe Dashboard - Product/Price configuration
2. /components/subscription-card.tsx - PLANS constant
3. /api/create-checkout/route.ts - Price IDs
4. DATABASE_FUNCTIONS.md - Plan types
5. Database: subscriptions table structure

Check for:
- Correct price amounts in code
- Correct letter allowances per plan
- Correct billing intervals
- Stripe price IDs match environment
- Free trial logic works correctly
- Employee discount is exactly 20%
- Commission rate is exactly 5%

If Stripe prices don't match code:
1. Document the correct values
2. Update code constants to match Stripe
3. OR update Stripe to match documentation

Generate: PRICING_ALIGNMENT_REPORT.md
```

### **Prompt 0H: Component Behavior Alignment**
```
Verify all UI components behave as documented.

Key components to verify:

1. SubscriptionCard (/components/subscription-card.tsx):
   - Shows correct plans and prices
   - TALK3 coupon works (100% discount)
   - Employee coupons work (20% discount)
   - Redirects to Stripe checkout

2. LetterTimeline (/components/letter-timeline.tsx):
   - Shows correct status progression
   - Displays accurate timestamps
   - Shows appropriate icons per status

3. ReviewLetterModal (/components/review-letter-modal.tsx):
   - Admin can edit content
   - Approve/Reject buttons work
   - AI Improve button (verify if should exist per docs)

4. LetterActions (/components/letter-actions.tsx):
   - PDF download only for approved letters
   - Email send only for approved letters
   - Correct visibility per letter status

5. AdminDashboard (/app/secure-admin-gateway/dashboard):
   - Dark theme as documented
   - All admin features accessible
   - Proper authentication required

For each component:
1. Read the documented behavior
2. Review the component code
3. Test the actual behavior
4. Fix any mismatches

Document any components that exist in code but aren't documented.
```

### **Prompt 0I: Security Implementation Alignment**
```
Verify ALL security measures match documentation.

From PRODUCTION_CHECKLIST.md and security documentation:

1. Authentication:
   - Email/password login works
   - Admin dual authentication (email + portal key)
   - Session management (timeouts, isolation)
   
2. Authorization:
   - RLS policies active on all tables
   - Middleware protection for routes
   - API route authorization checks

3. Rate Limiting (documented requirements):
   - Letter generation: 5 per 15 minutes
   - Checkout attempts: 10 per 15 minutes
   - Admin login: 5 per 15 minutes

4. Security Headers:
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Strict-Transport-Security enabled
   - CSP configured for Stripe/Supabase

5. Data Protection:
   - No sensitive data in logs
   - Passwords properly hashed
   - API keys not exposed to client
   - HTTPS enforced

6. Audit Logging:
   - All letter status changes logged
   - Admin actions logged
   - Security events logged

For each security measure:
1. Verify it's implemented in code
2. Verify it works as documented
3. Fix any gaps

Generate: SECURITY_ALIGNMENT_REPORT.md
```

### **Prompt 0J: Continuous Alignment Enforcement**
```
Create automated checks to ensure code-documentation alignment going forward.

Create these files:

1. /scripts/verify-alignment.ts:
   - Parses all documentation files
   - Extracts documented behaviors
   - Compares with code implementation
   - Reports discrepancies
   - Run with: npm run verify-alignment

2. /.github/workflows/doc-alignment.yml:
   - GitHub Action that runs on every PR
   - Fails if code changes don't match docs
   - Requires doc updates with code changes

3. /CONTRIBUTING.md:
   - Document the code-documentation alignment rule
   - Every code change MUST have corresponding doc update
   - Every doc change MUST reflect actual code

4. Add to package.json scripts:
   "verify-alignment": "tsx scripts/verify-alignment.ts",
   "pre-commit": "npm run verify-alignment && npm run lint"

5. Create /docs/ALIGNMENT_RULES.md:
   - Single source of truth for each feature
   - When docs and code conflict, which wins
   - Process for updating both together

The goal: Make it IMPOSSIBLE to have code-documentation drift.
```

---

## 📋 **UPDATED PRIORITY ORDER**

| Order | Priority | Task | Purpose |
|-------|----------|------|---------|
| **0** | 🔴 CRITICAL | Run Prompts 0A-0J | Ensure code matches docs FIRST |
| 1 | 🔴 Critical | TALK3 Coupon | Core functionality |
| 2 | 🔴 Critical | coupon_usage table | Fix API errors |
| 3 | 🔴 Critical | Free trial fix | Enable new users |
| 4 | 🔴 Critical | Hide AI draft | Legal liability |
| 5 | 🟡 High | Security headers | Security |
| 6 | 🟡 High | Search path fixes | SQL security |
| 7 | 🟡 High | Rate limiting | API protection |
| 8 | 🟢 Medium | Email sending | Functionality |
| 9 | 🟢 Medium | PDF generation | Output quality |
| 10 | 🟢 Medium | Blue color scheme | Visual update |

---

## 🎯 **MASTER ALIGNMENT PROMPT (Use This First)**

```
BEFORE MAKING ANY CHANGES TO THIS CODEBASE:

1. READ all documentation files completely:
   - CLAUDE.md
   - TTML_COMPLETE_REVIEW.md
   - TTML_BULLETPROOF_ACTION_PLAN.md
   - PRODUCTION_CHECKLIST.md
   - DATABASE_FUNCTIONS.md
   - All files in /scripts/*.sql

2. UNDERSTAND the documented architecture:
   - Three user roles: Subscriber, Employee, Admin
   - Letter status flow: draft → generating → pending_review → under_review → approved/rejected
   - Subscription plans: Free trial, Single ($299), Monthly ($299/4 letters), Yearly ($599/8 letters)
   - Admin portal at /secure-admin-gateway (NOT /dashboard/admin)

3. VERIFY before changing:
   - Does the code already do what I'm about to implement?
   - Does my change match the documentation?
   - Will my change break any documented behavior?

4. UPDATE documentation when changing code:
   - If adding a feature, document it
   - If changing behavior, update the docs
   - If fixing a bug, note it in the changelog

5. NEVER:
   - Implement something that contradicts documentation
   - Remove features without updating docs
   - Add undocumented behaviors
   - Change APIs without updating DATABASE_FUNCTIONS.md

6. ALWAYS:
   - Cross-reference code with docs before changes
   - Keep CLAUDE.md as the source of truth
   - Update .env.example for new environment variables
   - Add migrations for database changes

The code MUST match the documentation. If they disagree, ASK before proceeding.
```

---

## 📄 **Documentation Files Quick Reference**

| File | Purpose | Update When |
|------|---------|-------------|
| `CLAUDE.md` | Primary AI guide, architecture overview | Any structural change |
| `TTML_COMPLETE_REVIEW.md` | Issue tracking, status | Fixing issues |
| `PRODUCTION_CHECKLIST.md` | Deployment requirements | New env vars, configs |
| `DATABASE_FUNCTIONS.md` | API & function specs | API changes |
| `.env.example` | Environment variables | New variables |
| `SETUP.md` | Local setup instructions | Setup process changes |
| `DEPLOYMENT.md` | Deployment guide | Deployment changes |
| `/scripts/*.sql` | Database migrations | Schema changes |

---

**Run Prompt 0A (Master Documentation Audit) FIRST before any other prompts.** This will give you a complete picture of all mismatches and prioritize what needs to be fixed.