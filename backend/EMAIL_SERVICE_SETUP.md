# Email Service Setup Guide

## Overview

The AI Hiring Orchestrator includes a comprehensive email notification system that sends automated emails for:
- Interview invitations
- Slot selection reminders
- Interview confirmations
- 24-hour reminders
- Buffer promotion notifications

## Features

✓ Template-based emails with consistent branding
✓ Automatic retry logic (up to 3 attempts)
✓ Delivery status tracking
✓ Support for multiple email providers (SMTP, SendGrid, AWS SES)
✓ Graceful fallback (logs to console if not configured)

## Configuration

### Environment Variables

Add the following variables to your `backend/config/config.env` file:

```env
# Email Service Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourcompany.com

# Optional
COMPANY_NAME=Your Company Name
FRONTEND_URL=http://localhost:3000
```

### Provider-Specific Setup

#### Gmail (Recommended for Development)

1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to Google Account Settings → Security
   - Under "Signing in to Google", select "App passwords"
   - Generate a new app password for "Mail"
3. Use the generated password as `EMAIL_PASSWORD`

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
```

#### SendGrid

1. Sign up for SendGrid account
2. Create an API key
3. Configure SMTP settings:

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
EMAIL_FROM=noreply@yourcompany.com
```

#### AWS SES

1. Verify your domain or email address in AWS SES
2. Create SMTP credentials in AWS SES console
3. Configure settings:

```env
EMAIL_HOST=email-smtp.us-east-1.amazonaws.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-ses-smtp-username
EMAIL_PASSWORD=your-ses-smtp-password
EMAIL_FROM=noreply@yourcompany.com
```

#### Custom SMTP Server

```env
EMAIL_HOST=mail.yourcompany.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-username
EMAIL_PASSWORD=your-password
EMAIL_FROM=noreply@yourcompany.com
```

## Email Templates

The system includes 5 pre-built email templates:

### 1. Invitation Email
- **Trigger**: When candidate is shortlisted
- **Subject**: "Interview Invitation: [Job Title]"
- **Contains**: Job details, accept/reject buttons, deadline
- **Requirements**: 11.1, 11.2, 11.3, 11.4

### 2. Slot Selection Email
- **Trigger**: When candidate accepts invitation
- **Subject**: "Select Your Interview Time: [Job Title]"
- **Contains**: Slot selection link, deadline
- **Requirements**: 11.5

### 3. Confirmation Email
- **Trigger**: When interview slot is confirmed
- **Subject**: "Interview Confirmed: [Job Title]"
- **Contains**: Interview details, calendar invite, preparation tips
- **Requirements**: 11.6

### 4. Reminder Email
- **Trigger**: 24 hours before interview
- **Subject**: "Reminder: Interview Tomorrow - [Job Title]"
- **Contains**: Interview details, quick checklist
- **Requirements**: 11.7

### 5. Promotion Email
- **Trigger**: When buffer candidate is promoted
- **Subject**: "Great News! Interview Invitation: [Job Title]"
- **Contains**: Promotion message, accept/reject buttons
- **Requirements**: 11.8

## Testing

### Test Email Service

Run the simple test to verify email templates:

```bash
cd backend
node tests/emailService.simple.test.js
```

### Test with Real Email Sending

1. Configure environment variables
2. Run the test:

```bash
node tests/emailService.simple.test.js
```

3. Check your inbox for test emails

### Manual Testing

You can manually trigger emails through the InterviewScheduler:

```javascript
import { interviewScheduler } from './managers/InterviewScheduler.js';

// Send invitation
await interviewScheduler.sendInvitation('application-id');
```

## Retry Logic

The email service automatically retries failed sends:

- **Max Retries**: 3 attempts
- **Retry Delay**: 10 minutes between attempts
- **Total Duration**: Up to 30 minutes of retry attempts
- **Status Tracking**: All attempts logged to automation_logs table

### Retry Flow

1. First attempt: Immediate send
2. If fails: Queue for retry in 10 minutes
3. Second attempt: After 10 minutes
4. If fails: Queue for retry in 10 minutes
5. Third attempt: After 10 minutes
6. If fails: Mark as failed, log error

## Monitoring

### Email Delivery Logs

All email delivery attempts are logged to the `automation_logs` table:

```sql
SELECT * FROM automation_logs 
WHERE action_type = 'email_delivery' 
ORDER BY created_at DESC;
```

### Check Email Status

```sql
-- Successful sends
SELECT * FROM automation_logs 
WHERE action_type = 'email_delivery' 
  AND details->>'status' = 'sent';

-- Failed sends
SELECT * FROM automation_logs 
WHERE action_type = 'email_delivery' 
  AND details->>'status' = 'failed';

-- Queued for retry
SELECT * FROM automation_logs 
WHERE action_type = 'email_delivery' 
  AND details->>'status' = 'queued_retry';
```

## Troubleshooting

### Emails Not Sending

1. **Check environment variables**:
   ```bash
   echo $EMAIL_HOST
   echo $EMAIL_USER
   ```

2. **Verify SMTP credentials**:
   - Test login to your email provider
   - Ensure app password is correct (for Gmail)

3. **Check firewall/network**:
   - Ensure port 587 is not blocked
   - Try port 465 with `EMAIL_SECURE=true`

4. **Review logs**:
   ```bash
   # Check console output
   # Look for "Email sent successfully" or error messages
   ```

### Gmail "Less Secure Apps" Error

Gmail no longer supports "less secure apps". You MUST use an App Password:
1. Enable 2FA on your Google account
2. Generate an App Password
3. Use the App Password in `EMAIL_PASSWORD`

### SendGrid Rate Limits

Free tier has sending limits:
- 100 emails/day
- Upgrade for higher limits

### AWS SES Sandbox Mode

New AWS SES accounts start in sandbox mode:
- Can only send to verified email addresses
- Request production access to send to any email

## Production Recommendations

### Security

1. **Use environment variables**: Never commit credentials to git
2. **Rotate credentials**: Change passwords regularly
3. **Use dedicated email account**: Don't use personal email
4. **Enable TLS**: Use `EMAIL_SECURE=true` for port 465

### Performance

1. **Use job queue**: For high-volume sending, integrate with Bull/BullMQ
2. **Monitor delivery rates**: Track success/failure rates
3. **Implement circuit breaker**: Already included for external API calls

### Compliance

1. **Include unsubscribe link**: For marketing emails (not required for transactional)
2. **GDPR compliance**: Store email logs securely
3. **CAN-SPAM compliance**: Include physical address in footer

## Advanced Configuration

### Custom Templates

To add custom email templates, edit `backend/services/EmailService.js`:

```javascript
// Add new template method
customTemplate(data) {
  const subject = `Your Custom Subject: ${data.title}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <body>
      <h1>${data.title}</h1>
      <p>${data.message}</p>
    </body>
    </html>
  `;
  
  const text = `${data.title}\n\n${data.message}`;
  
  return { subject, html, text };
}

// Register in generateEmailFromTemplate
generateEmailFromTemplate(templateName, data) {
  const templates = {
    invitation: this.invitationTemplate,
    slot_selection: this.slotSelectionTemplate,
    confirmation: this.confirmationTemplate,
    reminder: this.reminderTemplate,
    promotion: this.promotionTemplate,
    custom: this.customTemplate  // Add your template
  };
  // ...
}
```

### Job Queue Integration

For production, integrate with a proper job queue:

```javascript
import Queue from 'bull';

const emailQueue = new Queue('email', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

emailQueue.process(async (job) => {
  const { to, template, data } = job.data;
  await emailService.queueEmail({ to, template, data });
});

// Queue email
await emailQueue.add({ to, template, data }, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 10 * 60 * 1000
  }
});
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review email service logs in automation_logs table
3. Test with simple SMTP test script
4. Contact system administrator

## Requirements Mapping

This email service implements the following requirements:

- **Requirement 11.1**: Interview invitation emails with job title
- **Requirement 11.2**: Job details and interview process overview
- **Requirement 11.3**: Unique accept links with tokens
- **Requirement 11.4**: Unique reject links with tokens
- **Requirement 11.5**: Slot selection emails with deadline
- **Requirement 11.6**: Confirmation emails with interview details
- **Requirement 11.7**: 24-hour reminder emails
- **Requirement 11.8**: Buffer promotion notification emails
- **Requirement 11.9**: Consistent branding and clear CTAs
- **Requirement 11.10**: Delivery tracking and retry logic (up to 3 times)
- **Requirement 13.3**: Email retry every 10 minutes for up to 2 hours
