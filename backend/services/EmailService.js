import nodemailer from 'nodemailer';
import { supabase } from '../database/supabaseClient.js';

/**
 * Email Service
 * 
 * Handles email sending with templates and retry logic.
 * 
 * Requirements: 11.1-11.10, 13.3
 * 
 * Features:
 * - Template-based emails with consistent branding
 * - Email queue with retry logic (up to 3 attempts)
 * - Delivery status tracking
 * - Support for multiple email providers (SMTP, SendGrid, AWS SES)
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.emailQueue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
    this.retryDelay = 10 * 60 * 1000; // 10 minutes in milliseconds
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter based on environment configuration
   * 
   * Supports:
   * - SMTP (default)
   * - SendGrid (via SMTP)
   * - AWS SES (via SMTP)
   */
  initializeTransporter() {
    try {
      // Check if email is configured
      if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
        console.warn('Email service not configured. Emails will be logged to console only.');
        this.transporter = null;
        return;
      }

      // Create SMTP transporter
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      console.log('Email service initialized successfully');
    } catch (error) {
      console.error('Error initializing email service:', error);
      this.transporter = null;
    }
  }

  /**
   * Queue an email for sending with retry logic
   * 
   * Requirements: 11.10, 13.3
   * 
   * @param {Object} emailData - Email data
   * @param {string} emailData.to - Recipient email address
   * @param {string} emailData.template - Template name
   * @param {Object} emailData.data - Template data
   * @param {number} emailData.retryCount - Current retry count (internal)
   * @returns {Promise<Object>} Result of queuing operation
   */
  async queueEmail(emailData) {
    try {
      const { to, template, data, retryCount = 0 } = emailData;

      // Validate input
      if (!to || !template || !data) {
        throw new Error('Missing required email data: to, template, or data');
      }

      // Generate email content from template
      const emailContent = this.generateEmailFromTemplate(template, data);

      // Attempt to send immediately
      const sendResult = await this.sendEmail({
        to,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      });

      if (sendResult.success) {
        // Log successful delivery
        await this.logEmailDelivery(to, template, 'sent', null, data);
        return { success: true, message: 'Email sent successfully' };
      } else {
        // Queue for retry if not exceeded max retries
        if (retryCount < this.maxRetries) {
          await this.scheduleRetry({
            to,
            template,
            data,
            retryCount: retryCount + 1,
            error: sendResult.error
          });
          
          await this.logEmailDelivery(to, template, 'queued_retry', sendResult.error, data);
          return { 
            success: false, 
            message: `Email queued for retry (attempt ${retryCount + 1}/${this.maxRetries})`,
            error: sendResult.error
          };
        } else {
          // Max retries exceeded
          await this.logEmailDelivery(to, template, 'failed', sendResult.error, data);
          return { 
            success: false, 
            message: 'Email delivery failed after maximum retries',
            error: sendResult.error
          };
        }
      }
    } catch (error) {
      console.error('Error queuing email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email using configured transporter
   * 
   * @param {Object} mailOptions - Mail options
   * @param {string} mailOptions.to - Recipient email
   * @param {string} mailOptions.subject - Email subject
   * @param {string} mailOptions.html - HTML content
   * @param {string} mailOptions.text - Plain text content
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(mailOptions) {
    try {
      // If transporter not configured, log to console
      if (!this.transporter) {
        console.log('=== EMAIL (Not Sent - No Transporter) ===');
        console.log('To:', mailOptions.to);
        console.log('Subject:', mailOptions.subject);
        console.log('Content:', mailOptions.text || mailOptions.html);
        console.log('=====================================');
        return { success: true, message: 'Email logged (transporter not configured)' };
      }

      // Send email
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: mailOptions.to,
        subject: mailOptions.subject,
        text: mailOptions.text,
        html: mailOptions.html
      });

      console.log('Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule email retry
   * 
   * Requirements: 11.10, 13.3
   * 
   * @param {Object} emailData - Email data with retry count
   * @returns {Promise<void>}
   */
  async scheduleRetry(emailData) {
    // In a production system, this would use a proper job queue (Bull, BullMQ, etc.)
    // For now, we'll use setTimeout as a simple implementation
    setTimeout(async () => {
      console.log(`Retrying email delivery (attempt ${emailData.retryCount}/${this.maxRetries})`);
      await this.queueEmail(emailData);
    }, this.retryDelay);
  }

  /**
   * Log email delivery status
   * 
   * @param {string} to - Recipient email
   * @param {string} template - Template name
   * @param {string} status - Delivery status (sent, queued_retry, failed)
   * @param {string} error - Error message if failed
   * @param {Object} data - Template data
   * @returns {Promise<void>}
   */
  async logEmailDelivery(to, template, status, error, data) {
    try {
      await supabase
        .from('automation_logs')
        .insert([{
          job_id: data.job_id || null,
          action_type: 'email_delivery',
          trigger_source: 'auto',
          actor_id: null,
          details: {
            recipient: to,
            template: template,
            status: status,
            error: error,
            timestamp: new Date().toISOString()
          }
        }]);
    } catch (error) {
      console.error('Error logging email delivery:', error);
      // Don't throw - logging failure shouldn't break email sending
    }
  }

  /**
   * Generate email content from template
   * 
   * Requirements: 11.1-11.9
   * 
   * @param {string} templateName - Template name
   * @param {Object} data - Template data
   * @returns {Object} Email content with subject, html, and text
   */
  generateEmailFromTemplate(templateName, data) {
    const templates = {
      invitation: this.invitationTemplate,
      slot_selection: this.slotSelectionTemplate,
      confirmation: this.confirmationTemplate,
      reminder: this.reminderTemplate,
      promotion: this.promotionTemplate,
      negotiation_escalation: this.negotiationEscalationTemplate
    };

    const template = templates[templateName];
    if (!template) {
      throw new Error(`Unknown email template: ${templateName}`);
    }

    return template(data);
  }

  /**
   * Interview Invitation Email Template
   * 
   * Requirements: 11.1, 11.2, 11.3, 11.4
   * 
   * @param {Object} data - Template data
   * @param {string} data.candidate_name - Candidate's name
   * @param {string} data.job_title - Job title
   * @param {string} data.company_name - Company name
   * @param {string} data.accept_link - Accept link URL
   * @param {string} data.reject_link - Reject link URL
   * @param {string} data.deadline - Confirmation deadline
   * @returns {Object} Email content
   */
  invitationTemplate(data) {
    const subject = `Interview Invitation: ${data.job_title}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .accept-button { background-color: #4CAF50; color: white; }
    .reject-button { background-color: #f44336; color: white; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Interview Invitation</h1>
    </div>
    <div class="content">
      <p>Dear ${data.candidate_name},</p>
      
      <p>Congratulations! We are pleased to invite you for an interview for the position of <strong>${data.job_title}</strong> at ${data.company_name || 'our company'}.</p>
      
      <p><strong>Interview Process Overview:</strong></p>
      <ul>
        <li>Duration: Approximately 60 minutes</li>
        <li>Format: One-on-one interview with the hiring manager</li>
        <li>Topics: Your experience, skills, and fit for the role</li>
      </ul>
      
      <p>Please respond to this invitation by <strong>${new Date(data.deadline).toLocaleString()}</strong>.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.accept_link}" class="button accept-button">Accept Interview</a>
        <a href="${data.reject_link}" class="button reject-button">Decline Interview</a>
      </div>
      
      <p>If you accept, you'll be able to select a convenient time slot from our available times.</p>
      
      <p>We look forward to meeting you!</p>
      
      <p>Best regards,<br>The Hiring Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>If you have any questions, please contact the hiring team directly.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Interview Invitation: ${data.job_title}

Dear ${data.candidate_name},

Congratulations! We are pleased to invite you for an interview for the position of ${data.job_title} at ${data.company_name || 'our company'}.

Interview Process Overview:
- Duration: Approximately 60 minutes
- Format: One-on-one interview with the hiring manager
- Topics: Your experience, skills, and fit for the role

Please respond to this invitation by ${new Date(data.deadline).toLocaleString()}.

Accept Interview: ${data.accept_link}
Decline Interview: ${data.reject_link}

If you accept, you'll be able to select a convenient time slot from our available times.

We look forward to meeting you!

Best regards,
The Hiring Team

---
This is an automated message. Please do not reply to this email.
If you have any questions, please contact the hiring team directly.
    `;

    return { subject, html, text };
  }

  /**
   * Slot Selection Email Template
   * 
   * Requirements: 11.5
   * 
   * @param {Object} data - Template data
   * @param {string} data.candidate_name - Candidate's name
   * @param {string} data.job_title - Job title
   * @param {string} data.slot_selection_link - Slot selection link
   * @param {string} data.deadline - Slot selection deadline
   * @returns {Object} Email content
   */
  slotSelectionTemplate(data) {
    const subject = `Select Your Interview Time: ${data.job_title}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .button { display: inline-block; padding: 12px 24px; margin: 10px 0; text-decoration: none; border-radius: 5px; font-weight: bold; background-color: #2196F3; color: white; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Select Your Interview Time</h1>
    </div>
    <div class="content">
      <p>Dear ${data.candidate_name},</p>
      
      <p>Thank you for accepting our interview invitation for the <strong>${data.job_title}</strong> position!</p>
      
      <p>Please select your preferred interview time slot from our available times. You have until <strong>${new Date(data.deadline).toLocaleString()}</strong> to make your selection.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.slot_selection_link}" class="button">Select Time Slot</a>
      </div>
      
      <p>If none of the available times work for you, please let us know and we'll do our best to accommodate your schedule.</p>
      
      <p>Best regards,<br>The Hiring Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Select Your Interview Time: ${data.job_title}

Dear ${data.candidate_name},

Thank you for accepting our interview invitation for the ${data.job_title} position!

Please select your preferred interview time slot from our available times. You have until ${new Date(data.deadline).toLocaleString()} to make your selection.

Select Time Slot: ${data.slot_selection_link}

If none of the available times work for you, please let us know and we'll do our best to accommodate your schedule.

Best regards,
The Hiring Team

---
This is an automated message. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Interview Confirmation Email Template
   * 
   * Requirements: 11.6
   * 
   * @param {Object} data - Template data
   * @param {string} data.candidate_name - Candidate's name
   * @param {string} data.job_title - Job title
   * @param {string} data.interview_time - Scheduled interview time
   * @param {string} data.recruiter_name - Recruiter's name
   * @param {string} data.recruiter_email - Recruiter's email
   * @returns {Object} Email content
   */
  confirmationTemplate(data) {
    const subject = `Interview Confirmed: ${data.job_title}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .info-box { background-color: #e8f5e9; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Interview Confirmed</h1>
    </div>
    <div class="content">
      <p>Dear ${data.candidate_name},</p>
      
      <p>Your interview for the <strong>${data.job_title}</strong> position has been confirmed!</p>
      
      <div class="info-box">
        <p><strong>Interview Details:</strong></p>
        <p>📅 Date & Time: <strong>${new Date(data.interview_time).toLocaleString()}</strong></p>
        <p>⏱️ Duration: 60 minutes</p>
        <p>👤 Interviewer: ${data.recruiter_name || 'Hiring Manager'}</p>
        ${data.recruiter_email ? `<p>📧 Contact: ${data.recruiter_email}</p>` : ''}
      </div>
      
      <p><strong>What to Prepare:</strong></p>
      <ul>
        <li>Review the job description and requirements</li>
        <li>Prepare examples of your relevant experience</li>
        <li>Have questions ready about the role and company</li>
        <li>Ensure you have a quiet space for the interview</li>
      </ul>
      
      <p>A calendar invitation has been sent to you separately. You will also receive a reminder 24 hours before the interview.</p>
      
      <p>We look forward to speaking with you!</p>
      
      <p>Best regards,<br>The Hiring Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>If you need to reschedule, please contact ${data.recruiter_email || 'the hiring team'} as soon as possible.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Interview Confirmed: ${data.job_title}

Dear ${data.candidate_name},

Your interview for the ${data.job_title} position has been confirmed!

Interview Details:
- Date & Time: ${new Date(data.interview_time).toLocaleString()}
- Duration: 60 minutes
- Interviewer: ${data.recruiter_name || 'Hiring Manager'}
${data.recruiter_email ? `- Contact: ${data.recruiter_email}` : ''}

What to Prepare:
- Review the job description and requirements
- Prepare examples of your relevant experience
- Have questions ready about the role and company
- Ensure you have a quiet space for the interview

A calendar invitation has been sent to you separately. You will also receive a reminder 24 hours before the interview.

We look forward to speaking with you!

Best regards,
The Hiring Team

---
This is an automated message. Please do not reply to this email.
If you need to reschedule, please contact ${data.recruiter_email || 'the hiring team'} as soon as possible.
    `;

    return { subject, html, text };
  }

  /**
   * Interview Reminder Email Template
   * 
   * Requirements: 11.7
   * 
   * @param {Object} data - Template data
   * @param {string} data.candidate_name - Candidate's name
   * @param {string} data.job_title - Job title
   * @param {string} data.interview_time - Scheduled interview time
   * @returns {Object} Email content
   */
  reminderTemplate(data) {
    const subject = `Reminder: Interview Tomorrow - ${data.job_title}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .reminder-box { background-color: #fff3e0; padding: 15px; border-left: 4px solid #FF9800; margin: 20px 0; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Interview Reminder</h1>
    </div>
    <div class="content">
      <p>Dear ${data.candidate_name},</p>
      
      <p>This is a friendly reminder about your upcoming interview!</p>
      
      <div class="reminder-box">
        <p><strong>Interview Details:</strong></p>
        <p>📅 Date & Time: <strong>${new Date(data.interview_time).toLocaleString()}</strong></p>
        <p>💼 Position: <strong>${data.job_title}</strong></p>
        <p>⏱️ Duration: 60 minutes</p>
      </div>
      
      <p><strong>Quick Checklist:</strong></p>
      <ul>
        <li>✓ Review the job description</li>
        <li>✓ Prepare your questions</li>
        <li>✓ Test your internet connection (if virtual)</li>
        <li>✓ Have a copy of your resume handy</li>
      </ul>
      
      <p>We're looking forward to meeting you tomorrow!</p>
      
      <p>Best regards,<br>The Hiring Team</p>
    </div>
    <div class="footer">
      <p>This is an automated reminder. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Reminder: Interview Tomorrow - ${data.job_title}

Dear ${data.candidate_name},

This is a friendly reminder about your upcoming interview!

Interview Details:
- Date & Time: ${new Date(data.interview_time).toLocaleString()}
- Position: ${data.job_title}
- Duration: 60 minutes

Quick Checklist:
✓ Review the job description
✓ Prepare your questions
✓ Test your internet connection (if virtual)
✓ Have a copy of your resume handy

We're looking forward to meeting you tomorrow!

Best regards,
The Hiring Team

---
This is an automated reminder. Please do not reply to this email.
    `;

    return { subject, html, text };
  }

  /**
   * Buffer Promotion Email Template
   * 
   * Requirements: 11.8
   * 
   * @param {Object} data - Template data
   * @param {string} data.candidate_name - Candidate's name
   * @param {string} data.job_title - Job title
   * @param {string} data.accept_link - Accept link URL
   * @param {string} data.reject_link - Reject link URL
   * @param {string} data.deadline - Confirmation deadline
   * @returns {Object} Email content
   */
  promotionTemplate(data) {
    const subject = `Great News! Interview Invitation: ${data.job_title}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #9C27B0; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .button { display: inline-block; padding: 12px 24px; margin: 10px 5px; text-decoration: none; border-radius: 5px; font-weight: bold; }
    .accept-button { background-color: #4CAF50; color: white; }
    .reject-button { background-color: #f44336; color: white; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Interview Opportunity!</h1>
    </div>
    <div class="content">
      <p>Dear ${data.candidate_name},</p>
      
      <p>Great news! A position has opened up, and we would like to invite you for an interview for the <strong>${data.job_title}</strong> role.</p>
      
      <p>Your application stood out to us, and we believe you would be a great fit for this position.</p>
      
      <p><strong>Interview Process Overview:</strong></p>
      <ul>
        <li>Duration: Approximately 60 minutes</li>
        <li>Format: One-on-one interview with the hiring manager</li>
        <li>Topics: Your experience, skills, and fit for the role</li>
      </ul>
      
      <p>Please respond to this invitation by <strong>${new Date(data.deadline).toLocaleString()}</strong>.</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${data.accept_link}" class="button accept-button">Accept Interview</a>
        <a href="${data.reject_link}" class="button reject-button">Decline Interview</a>
      </div>
      
      <p>If you accept, you'll be able to select a convenient time slot from our available times.</p>
      
      <p>We look forward to meeting you!</p>
      
      <p>Best regards,<br>The Hiring Team</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>If you have any questions, please contact the hiring team directly.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Great News! Interview Invitation: ${data.job_title}

Dear ${data.candidate_name},

Great news! A position has opened up, and we would like to invite you for an interview for the ${data.job_title} role.

Your application stood out to us, and we believe you would be a great fit for this position.

Interview Process Overview:
- Duration: Approximately 60 minutes
- Format: One-on-one interview with the hiring manager
- Topics: Your experience, skills, and fit for the role

Please respond to this invitation by ${new Date(data.deadline).toLocaleString()}.

Accept Interview: ${data.accept_link}
Decline Interview: ${data.reject_link}

If you accept, you'll be able to select a convenient time slot from our available times.

We look forward to meeting you!

Best regards,
The Hiring Team

---
This is an automated message. Please do not reply to this email.
If you have any questions, please contact the hiring team directly.
    `;

    return { subject, html, text };
  }

  /**
   * Negotiation Escalation Email Template
   * 
   * Requirements: 5.5, 5.7
   * 
   * @param {Object} data - Template data
   * @param {string} data.recruiter_name - Recruiter's name
   * @param {string} data.candidate_name - Candidate's name
   * @param {string} data.candidate_email - Candidate's email
   * @param {string} data.job_title - Job title
   * @param {string} data.conversation_history - Full conversation history
   * @param {string} data.interview_id - Interview UUID
   * @returns {Object} Email content
   */
  negotiationEscalationTemplate(data) {
    const subject = `Action Required: Interview Scheduling Escalation - ${data.candidate_name}`;
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #FF5722; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .alert-box { background-color: #fff3e0; padding: 15px; border-left: 4px solid #FF9800; margin: 20px 0; }
    .conversation-box { background-color: #f5f5f5; padding: 15px; border: 1px solid #ddd; margin: 20px 0; font-family: monospace; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Interview Scheduling Escalation</h1>
    </div>
    <div class="content">
      <p>Dear ${data.recruiter_name},</p>
      
      <div class="alert-box">
        <p><strong>Action Required:</strong> The automated negotiation bot was unable to find a suitable interview time after 3 rounds of negotiation.</p>
      </div>
      
      <p><strong>Candidate Details:</strong></p>
      <ul>
        <li>Name: <strong>${data.candidate_name}</strong></li>
        <li>Email: <strong>${data.candidate_email}</strong></li>
        <li>Position: <strong>${data.job_title}</strong></li>
        <li>Interview ID: ${data.interview_id}</li>
      </ul>
      
      <p><strong>Conversation History:</strong></p>
      <div class="conversation-box">${data.conversation_history}</div>
      
      <p><strong>Next Steps:</strong></p>
      <ol>
        <li>Review the conversation history above to understand the candidate's availability constraints</li>
        <li>Contact the candidate directly at <a href="mailto:${data.candidate_email}">${data.candidate_email}</a></li>
        <li>Work with the candidate to find a mutually convenient time</li>
        <li>Manually schedule the interview in the system</li>
      </ol>
      
      <p>The candidate has been notified that you will reach out directly to schedule the interview.</p>
      
      <p>Best regards,<br>AI Hiring Orchestrator</p>
    </div>
    <div class="footer">
      <p>This is an automated escalation notification.</p>
      <p>For technical issues, please contact the system administrator.</p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Action Required: Interview Scheduling Escalation - ${data.candidate_name}

Dear ${data.recruiter_name},

⚠️ ACTION REQUIRED: The automated negotiation bot was unable to find a suitable interview time after 3 rounds of negotiation.

Candidate Details:
- Name: ${data.candidate_name}
- Email: ${data.candidate_email}
- Position: ${data.job_title}
- Interview ID: ${data.interview_id}

Conversation History:
${data.conversation_history}

Next Steps:
1. Review the conversation history above to understand the candidate's availability constraints
2. Contact the candidate directly at ${data.candidate_email}
3. Work with the candidate to find a mutually convenient time
4. Manually schedule the interview in the system

The candidate has been notified that you will reach out directly to schedule the interview.

Best regards,
AI Hiring Orchestrator

---
This is an automated escalation notification.
For technical issues, please contact the system administrator.
    `;

    return { subject, html, text };
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default EmailService;
