import type { EmailTemplate, TemplateData } from './types'

interface TemplateOutput {
  subject: string
  text: string
  html: string
}

const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: #1a1a2e; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
  .header h1 { margin: 0; font-size: 24px; }
  .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
  .footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
  .button { display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
  .highlight { background: #f0f9ff; padding: 15px; border-left: 4px solid #0284c7; margin: 20px 0; }
`

function wrapHtml(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Talk-To-My-Lawyer</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>Talk-To-My-Lawyer | Professional Legal Letter Services</p>
      <p>This is an automated message. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>`
}

const templates: Record<EmailTemplate, (data: TemplateData) => TemplateOutput> = {
  welcome: (data) => ({
    subject: 'Welcome to Talk-To-My-Lawyer',
    text: `
Welcome to Talk-To-My-Lawyer, ${data.userName || 'there'}!

Thank you for signing up. You now have access to professional legal letter generation services with attorney review.

Getting Started:
1. Create your first letter from the dashboard
2. Fill out the intake form with your situation details
3. Our AI will generate a professional draft
4. A licensed attorney will review and finalize your letter

Your first letter is free!

Visit your dashboard: ${data.actionUrl || 'https://talk-to-my-lawyer.com/dashboard'}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Welcome, ${data.userName || 'there'}!</h2>
      <p>Thank you for signing up for Talk-To-My-Lawyer. You now have access to professional legal letter generation services with attorney review.</p>

      <div class="highlight">
        <strong>Your first letter is free!</strong> Get started right away.
      </div>

      <h3>Getting Started</h3>
      <ol>
        <li>Create your first letter from the dashboard</li>
        <li>Fill out the intake form with your situation details</li>
        <li>Our AI will generate a professional draft</li>
        <li>A licensed attorney will review and finalize your letter</li>
      </ol>

      <p style="text-align: center;">
        <a href="${data.actionUrl || 'https://talk-to-my-lawyer.com/dashboard'}" class="button">Go to Dashboard</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `),
  }),

  'password-reset': (data) => ({
    subject: 'Reset Your Password - Talk-To-My-Lawyer',
    text: `
Password Reset Request

We received a request to reset your password. Click the link below to create a new password:

${data.actionUrl}

If you didn't request this, you can safely ignore this email.

This link will expire in 1 hour.

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Password Reset Request</h2>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>

      <p style="text-align: center;">
        <a href="${data.actionUrl}" class="button">Reset Password</a>
      </p>

      <p><small>If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.</small></p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `),
  }),

  'letter-approved': (data) => ({
    subject: `Your Letter Has Been Approved - ${data.letterTitle || 'Legal Letter'}`,
    text: `
Good news, ${data.userName || 'there'}!

Your letter "${data.letterTitle || 'Legal Letter'}" has been reviewed and approved by our attorney.

What's next:
- View the final letter in your dashboard
- Download as PDF
- Send directly to the recipient

View your letter: ${data.letterLink || data.actionUrl}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Your Letter Has Been Approved!</h2>
      <p>Good news, ${data.userName || 'there'}!</p>

      <div class="highlight">
        <strong>"${data.letterTitle || 'Legal Letter'}"</strong> has been reviewed and approved by our attorney.
      </div>

      <h3>What's next?</h3>
      <ul>
        <li>View the final letter in your dashboard</li>
        <li>Download as PDF</li>
        <li>Send directly to the recipient</li>
      </ul>

      <p style="text-align: center;">
        <a href="${data.letterLink || data.actionUrl}" class="button">View Your Letter</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `),
  }),

  'letter-rejected': (data) => ({
    subject: `Action Required: Letter Needs Revision - ${data.letterTitle || 'Legal Letter'}`,
    text: `
Hello ${data.userName || 'there'},

Your letter "${data.letterTitle || 'Legal Letter'}" requires some changes before it can be approved.

Reason: ${data.alertMessage || 'Please review the feedback in your dashboard.'}

Please visit your dashboard to review the feedback and make necessary updates.

View your letter: ${data.letterLink || data.actionUrl}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Your Letter Needs Revision</h2>
      <p>Hello ${data.userName || 'there'},</p>

      <p>Your letter <strong>"${data.letterTitle || 'Legal Letter'}"</strong> requires some changes before it can be approved.</p>

      <div class="highlight">
        <strong>Feedback:</strong><br>
        ${data.alertMessage || 'Please review the feedback in your dashboard.'}
      </div>

      <p style="text-align: center;">
        <a href="${data.letterLink || data.actionUrl}" class="button">Review Feedback</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `),
  }),

  'commission-earned': (data) => ({
    subject: `Commission Earned - $${(data.commissionAmount || 0).toFixed(2)}`,
    text: `
Congratulations, ${data.userName || 'there'}!

You've earned a new commission!

Amount: $${(data.commissionAmount || 0).toFixed(2)}

This has been added to your pending balance. View your earnings in the dashboard.

Dashboard: ${data.actionUrl}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Commission Earned!</h2>
      <p>Congratulations, ${data.userName || 'there'}!</p>

      <div class="highlight">
        <strong>New Commission:</strong> $${(data.commissionAmount || 0).toFixed(2)}
      </div>

      <p>This has been added to your pending balance. View your earnings in the dashboard.</p>

      <p style="text-align: center;">
        <a href="${data.actionUrl}" class="button">View Earnings</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `),
  }),

  'subscription-confirmation': (data) => ({
    subject: 'Subscription Confirmed - Talk-To-My-Lawyer',
    text: `
Thank you for your subscription, ${data.userName || 'there'}!

Plan: ${data.subscriptionPlan || 'Legal Letters Plan'}

You now have access to generate professional legal letters with attorney review.

Visit your dashboard to get started: ${data.actionUrl}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Subscription Confirmed!</h2>
      <p>Thank you for your subscription, ${data.userName || 'there'}!</p>

      <div class="highlight">
        <strong>Your Plan:</strong> ${data.subscriptionPlan || 'Legal Letters Plan'}
      </div>

      <p>You now have access to generate professional legal letters with attorney review.</p>

      <p style="text-align: center;">
        <a href="${data.actionUrl}" class="button">Go to Dashboard</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `),
  }),

  'subscription-renewal': (data) => ({
    subject: 'Subscription Renewal Reminder - Talk-To-My-Lawyer',
    text: `
Hello ${data.userName || 'there'},

Your ${data.subscriptionPlan || 'subscription'} is coming up for renewal soon.

Manage your subscription: ${data.actionUrl}

Best regards,
The Talk-To-My-Lawyer Team
    `.trim(),
    html: wrapHtml(`
      <h2>Subscription Renewal Reminder</h2>
      <p>Hello ${data.userName || 'there'},</p>

      <p>Your <strong>${data.subscriptionPlan || 'subscription'}</strong> is coming up for renewal soon.</p>

      <p style="text-align: center;">
        <a href="${data.actionUrl}" class="button">Manage Subscription</a>
      </p>

      <p>Best regards,<br>The Talk-To-My-Lawyer Team</p>
    `),
  }),

  'admin-alert': (data) => ({
    subject: `Admin Alert: ${data.alertMessage || 'Action Required'}`,
    text: `
Admin Alert

${data.alertMessage || 'An important event requires your attention.'}

Dashboard: ${data.actionUrl}
    `.trim(),
    html: wrapHtml(`
      <h2>Admin Alert</h2>

      <div class="highlight">
        ${data.alertMessage || 'An important event requires your attention.'}
      </div>

      <p style="text-align: center;">
        <a href="${data.actionUrl}" class="button">Go to Dashboard</a>
      </p>
    `),
  }),
}

export function renderTemplate(template: EmailTemplate, data: TemplateData): TemplateOutput {
  const templateFn = templates[template]
  if (!templateFn) {
    throw new Error(`Unknown email template: ${template}`)
  }
  return templateFn(data)
}

export { templates }
