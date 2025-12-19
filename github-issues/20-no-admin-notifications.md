# No Admin Notifications for Pending Reviews

## Priority
🔧 **LOW**

## Labels
`feature-missing`, `low-priority`, `enhancement`, `ux`

## Description
Admins have no notification system when letters are pending review. They must manually check the admin dashboard, leading to delayed reviews and poor user experience.

## Current Workflow
1. User submits letter for review
2. Letter status → `pending_review`
3. **Admin has no idea** ❌
4. Admin eventually checks dashboard
5. Admin sees pending letter
6. Admin reviews and approves/rejects

**Problem**: Step 3-4 could take hours or days

## User Impact
- Users wait unnecessarily for reviews
- SLA violations (if review time is promised)
- Poor user experience
- Competitive disadvantage

## Recommended Solutions

### Option 1: Email Notifications (Simplest)
When letter submitted:
```typescript
// In submit endpoint
await sendEmail({
  to: process.env.ADMIN_EMAIL,
  subject: 'New Letter Pending Review',
  html: `
    <p>Letter #${letter.id} submitted by ${user.email}</p>
    <a href="${APP_URL}/secure-admin-gateway/letters/${letter.id}">
      Review Now
    </a>
  `
})
```

**Pros**:
- Simple to implement
- Works immediately
- No UI changes needed

**Cons**:
- Email overload with high volume
- Not real-time
- Can be ignored/filtered

### Option 2: In-App Notifications
Add notification system to admin dashboard:

```typescript
// Notification badge on admin sidebar
<Badge variant="destructive">{pendingCount}</Badge>

// Notification center
<NotificationCenter>
  <Notification
    title="New letter pending review"
    time="2 minutes ago"
    link="/letters/123"
  />
</NotificationCenter>
```

**Pros**:
- Better UX
- Real-time updates possible
- Persistent notification state

**Cons**:
- More complex
- Requires notification infrastructure
- Admin must be logged in

### Option 3: Slack/Discord Webhook (Dev-Friendly)
```typescript
await fetch(process.env.SLACK_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: `🔔 New letter pending review`,
    blocks: [{
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Letter #${letter.id}*\nFrom: ${user.email}\n<${reviewUrl}|Review Now>`
      }
    }]
  })
})
```

**Pros**:
- Instant notifications
- Mobile push if Slack/Discord app installed
- Team visibility

**Cons**:
- Requires Slack/Discord setup
- External dependency

### Option 4: Push Notifications (Advanced)
Use Web Push API for browser notifications

**Pros**:
- Real-time
- Works even when tab not active
- Best UX

**Cons**:
- Complex implementation
- Requires service worker
- Browser permission needed

## Recommended Approach

**Phase 1**: Email notifications (quick win)
**Phase 2**: In-app notification badge
**Phase 3**: Real-time updates via websocket/SSE
**Phase 4**: Push notifications (optional)

## Implementation Details

### Email Template
**File to create**: `lib/email-templates/admin-review-notification.ts`

```typescript
export function adminReviewNotificationEmail(data: {
  letterId: string
  userEmail: string
  reviewUrl: string
}) {
  return {
    subject: '🔔 New Letter Pending Review',
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif;">
          <h2>New Letter Submitted</h2>
          <p><strong>Letter ID:</strong> ${data.letterId}</p>
          <p><strong>User:</strong> ${data.userEmail}</p>
          <p style="margin-top: 20px;">
            <a href="${data.reviewUrl}"
               style="background: #3b82f6; color: white; padding: 12px 24px;
                      text-decoration: none; border-radius: 6px;">
              Review Now
            </a>
          </p>
        </body>
      </html>
    `
  }
}
```

### Database Notification Log (Optional)
Track notification delivery:

```sql
CREATE TABLE admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'pending_review', 'letter_submitted', etc.
  letter_id UUID REFERENCES letters(id),
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  delivery_status TEXT -- 'sent', 'failed', 'bounced'
);
```

### Notification Preferences (Future)
Allow admins to configure notification preferences:
- Email on every submission
- Daily digest
- Only urgent (>24h pending)
- Specific letter types only

## Acceptance Criteria
- [ ] Email notification sent when letter submitted
- [ ] Email includes letter ID, user info, and review link
- [ ] Admin email(s) configurable via env var
- [ ] Support multiple admin emails (comma-separated)
- [ ] Graceful failure if email service down
- [ ] Notification tracking (optional)
- [ ] Consider digest mode for high volume
- [ ] Test email deliverability
- [ ] (Future) In-app notification badge
- [ ] (Future) Real-time updates
