# GitHub Issues for Talk-To-My-Lawyer

This directory contains 33 comprehensive GitHub issue templates ready to be created in your repository.

## How to Create These Issues

### Option 1: Manual Copy-Paste (Recommended)
1. Go to your GitHub repository
2. Click "Issues" → "New Issue"
3. Open each markdown file
4. Copy the entire contents
5. Paste into GitHub's issue form
6. Add appropriate labels (GitHub will suggest based on content)
7. Click "Submit new issue"

### Option 2: Using GitHub CLI (Faster)
If you have GitHub CLI installed locally:

```bash
# Install gh if needed
# brew install gh  (macOS)
# or download from: https://cli.github.com/

# Authenticate
gh auth login

# Create all issues from this directory
for file in github-issues/*.md; do
  if [[ "$file" != "github-issues/README.md" ]]; then
    gh issue create --title "$(head -n 1 $file | sed 's/^# //')" --body-file "$file"
  fi
done
```

### Option 3: GitHub API Script
Create a Node.js script to bulk-create:

```javascript
// create-issues.js
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'your-username';
const REPO_NAME = 'talk-to-my-lawyer';

async function createIssue(title, body) {
  const response = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body })
    }
  );
  return response.json();
}

// Read all markdown files and create issues
const issuesDir = path.join(__dirname, 'github-issues');
const files = fs.readdirSync(issuesDir)
  .filter(f => f.endsWith('.md') && f !== 'README.md');

for (const file of files) {
  const content = fs.readFileSync(path.join(issuesDir, file), 'utf8');
  const title = content.split('\n')[0].replace(/^# /, '');
  await createIssue(title, content);
  console.log(`Created: ${title}`);
}
```

## Issue Index

### 🚨 CRITICAL (1 issue)
| # | Title | File |
|---|-------|------|
| 01 | Legal Liability: Misleading Claims in PDF Footer | `01-legal-liability-pdf-footer.md` |

### ⚠️ HIGH PRIORITY (7 issues)
| # | Title | File |
|---|-------|------|
| 02 | Race Condition in Letter Allowance Check | `02-race-condition-allowance-check.md` |
| 03 | Free Trial Abuse: Infinite Letter Generation | `03-free-trial-abuse.md` |
| 04 | Missing Audit Logging in Submit Endpoint | `04-missing-audit-logging.md` |
| 05 | Email Sending Not Implemented | `05-email-not-implemented.md` |
| 06 | Missing Subscription Cancellation Flow | `06-missing-subscription-cancellation.md` |
| 07 | Database Schema Mismatch: Missing subscription_id | `07-database-schema-mismatch.md` |
| 08 | Zero Test Coverage | `08-zero-test-coverage.md` |

### 📋 MEDIUM PRIORITY (16 issues)
| # | Title | File |
|---|-------|------|
| 09 | Inconsistent Rate Limiting | `09-inconsistent-rate-limiting.md` |
| 10 | Service Role Client Bypasses RLS | `10-service-role-bypass-rls.md` |
| 11 | Silent Failures in Stripe Webhook | `11-silent-webhook-failures.md` |
| 12 | No Validation for Letter Status Transitions | `12-no-status-transition-validation.md` |
| 13 | Missing Database Indexes | `13-missing-database-indexes.md` |
| 14 | N+1 Query Problem in Dashboard | `14-n-plus-one-dashboard-queries.md` |
| 15 | Duplicate Subscription Credit Fields | `15-duplicate-subscription-fields.md` |
| 24 | Test Mode Creates Real Database Records | `24-test-mode-production-impact.md` |
| 26 | Missing Environment Variable Validation | `26-missing-env-validation.md` |
| 30 | Confusion Between is_super_user and admin Role | `30-is-super-user-confusion.md` |
| 31 | No Error Handling for Missing Profile | `31-missing-profile-error-handling.md` |

### 🔧 LOW PRIORITY (9 issues)
| # | Title | File |
|---|-------|------|
| 16 | Missing Loading States in Dashboard Pages | `16-no-loading-states.md` |
| 17 | Inconsistent Error Messages Expose Internal Details | `17-inconsistent-error-messages.md` |
| 18 | Excessive Console Logging (97 Statements) | `18-excessive-console-logging.md` |
| 19 | Missing Letter Deletion Feature | `19-no-letter-deletion.md` |
| 20 | No Admin Notifications for Pending Reviews | `20-no-admin-notifications.md` |
| 21 | Incomplete TODO: Admin Sidebar Role Fetching | `21-incomplete-todo-admin-sidebar.md` |
| 22 | Inconsistent Plan Type Naming | `22-inconsistent-plan-naming.md` |
| 23 | Missing ENUM Type for plan_type Column | `23-missing-enum-plan-type.md` |
| 25 | Hardcoded APP_URL Instead of Dynamic Detection | `25-hardcoded-app-url.md` |
| 27 | Confusing Letter Status Display | `27-confusing-letter-status-display.md` |
| 28 | No Pagination on Letters List | `28-no-pagination-letters-list.md` |
| 29 | Missing Employee Dashboard Features | `29-missing-employee-features.md` |
| 32 | Documentation Parameter Mismatch | `32-parameter-name-mismatch.md` |
| 33 | Outdated Migration Comments | `33-outdated-migration-comments.md` |

## Issue Categories

### Security & Legal
- #01 - Legal liability in PDF
- #02 - Race condition
- #03 - Free trial abuse
- #09 - Rate limiting
- #10 - RLS bypass
- #17 - Error message disclosure

### Database & Data Integrity
- #07 - Schema mismatch
- #13 - Missing indexes
- #15 - Duplicate fields
- #22 - Plan naming inconsistency
- #23 - Missing ENUM type
- #33 - Outdated migrations

### Core Functionality
- #04 - Missing audit logging
- #05 - Email not implemented
- #06 - Subscription cancellation
- #08 - Test coverage
- #12 - Status transition validation
- #19 - Letter deletion

### Performance
- #14 - N+1 queries
- #28 - No pagination

### Developer Experience
- #18 - Console logging
- #21 - TODO comments
- #26 - Env validation
- #31 - Error handling
- #32 - Documentation mismatch

### User Experience
- #16 - Loading states
- #20 - Admin notifications
- #25 - Hardcoded URLs
- #27 - Confusing status display
- #29 - Employee features

### Architecture & Design
- #11 - Webhook failures
- #24 - Test mode impact
- #30 - Role confusion

## Recommended Implementation Order

### Phase 1: Critical Fixes (Week 1)
1. Issue #01 - Fix PDF legal claims (1 hour)
2. Issue #02 - Fix race condition (4 hours)
3. Issue #03 - Prevent free trial abuse (3 hours)

### Phase 2: High-Risk Security (Week 2)
4. Issue #04 - Add audit logging (2 hours)
5. Issue #07 - Fix schema mismatch (2 hours)
6. Issue #09 - Consistent rate limiting (1 hour)
7. Issue #10 - Review RLS bypass (3 hours)

### Phase 3: Core Features (Week 3-4)
8. Issue #05 - Implement email sending (8 hours)
9. Issue #06 - Subscription cancellation (6 hours)
10. Issue #12 - Status transition validation (4 hours)
11. Issue #13 - Database indexes (2 hours)

### Phase 4: Quality & Polish (Week 5-6)
12. Issue #11 - Webhook resilience (4 hours)
13. Issue #14 - Fix N+1 queries (2 hours)
14. Issue #15 - Consolidate fields (3 hours)
15. Issue #26 - Env validation (3 hours)
16. Issue #30 - Fix role confusion (4 hours)
17. Issue #31 - Error handling (3 hours)

### Phase 5: UX Improvements (Week 7-8)
18-33. Low priority issues (2-4 hours each)

## Labels to Create in GitHub

Create these labels in your repository for better organization:

```
critical (red)
high-priority (orange)
medium-priority (yellow)
low-priority (green)
security (purple)
bug (red)
enhancement (blue)
performance (yellow)
database (teal)
documentation (gray)
technical-debt (brown)
ui/ux (pink)
testing (lime)
```

## Milestones Suggestion

Create these milestones:
- **v1.0 - Production Ready** (Issues #1-7)
- **v1.1 - Core Features** (Issues #5-6, #8, #12)
- **v1.2 - Polish & Performance** (Issues #11, #13-15, #26, #30-31)
- **v2.0 - Enhanced UX** (Issues #16-21, #27-29)

## Notes

- Each issue has clear acceptance criteria
- Code examples are provided where applicable
- Multiple solution options presented for complex issues
- Security implications highlighted
- Performance impact estimated

## Questions?

If you have questions about any issue:
1. Read the full issue description
2. Check the "Recommended Fix" section
3. Review "Acceptance Criteria"
4. Consider multiple options provided

Good luck fixing these issues! 🚀
