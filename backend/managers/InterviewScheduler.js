import { supabase } from '../database/supabaseClient.js';
import { interviewModel } from '../models/interviewSchema.js';
import { emailService } from '../services/EmailService.js';
import { isFeatureEnabled } from '../utils/featureFlags.js';
import { automationLogger } from '../utils/automationLogger.js';
import jwt from 'jsonwebtoken';

/**
 * Interview Scheduler
 * 
 * Automates interview invitation, slot selection, and confirmation workflow.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.9, 12.8, 12.9
 * 
 * Key Features:
 * - Automatic interview invitation sending
 * - Secure token generation for accept/reject actions
 * - Deadline-based automation (48 hours for confirmation)
 * - Integration with email service (placeholder for now)
 * - Automation logging
 * - Feature flag support for automation control
 */

class InterviewScheduler {
  /**
   * Send interview invitation to a shortlisted candidate
   * 
   * Creates an interview record with:
   * - status: "invitation_sent"
   * - confirmation_deadline: 48 hours from now
   * - Secure accept/reject tokens
   * 
   * Requirements: 3.1, 3.2, 3.3, 12.8, 12.9
   * 
   * @param {string} applicationId - UUID of the application
   * @returns {Promise<Object>} Created interview with tokens
   */
  async sendInvitation(applicationId) {
    try {
      // 1. Get application details
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('*')
        .eq('id', applicationId)
        .single();

      if (appError || !application) {
        throw new Error(`Application not found: ${appError?.message || 'Unknown error'}`);
      }

      // 2. Get job details
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', application.job_id)
        .single();

      if (jobError || !job) {
        throw new Error(`Job not found: ${jobError?.message || 'Unknown error'}`);
      }

      // Check if automation is enabled for this job
      if (!await isFeatureEnabled('global_automation', job.id)) {
        console.log(`[InterviewScheduler] Automation disabled for job ${job.id}`);
        return {
          success: false,
          reason: 'Automation is disabled for this job',
          message: 'Interview invitations must be sent manually for this job.'
        };
      }

      // 3. Check if interview already exists for this application
      const existingInterview = await interviewModel.getByApplicationId(applicationId);
      if (existingInterview.data) {
        console.log(`Interview already exists for application ${applicationId}`);
        return {
          success: true,
          data: existingInterview.data,
          message: 'Interview already exists'
        };
      }

      // 4. Set confirmation deadline to 48 hours from now
      const confirmationDeadline = new Date();
      confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);

      // 5. Create interview record
      const interviewResult = await interviewModel.create({
        application_id: applicationId,
        job_id: application.job_id,
        recruiter_id: job.posted_by,
        candidate_id: application.applicant_id,
        rank_at_time: application.rank,
        status: 'invitation_sent',
        confirmation_deadline: confirmationDeadline,
        no_show_risk: 0.5 // Default risk score
      });

      if (!interviewResult.success) {
        throw new Error('Failed to create interview record');
      }

      const interview = interviewResult.data;

      // 6. Generate secure accept/reject tokens
      const acceptToken = this.generateToken(interview.id, 'accept');
      const rejectToken = this.generateToken(interview.id, 'reject');

      // 7. Log automation action
      await automationLogger.log({
        jobId: job.id,
        actionType: 'invitation_sent',
        triggerSource: 'auto',
        actorId: null,
        details: {
          interview_id: interview.id,
          application_id: applicationId,
          candidate_id: application.applicant_id,
          confirmation_deadline: confirmationDeadline.toISOString(),
          rank_at_time: application.rank,
          recruiter_id: job.posted_by
        }
      });

      // 8. Queue invitation email with accept/reject links
      // Requirements: 11.1, 11.2, 11.3, 11.4
      await this.queueInvitationEmail(application, job, interview, acceptToken, rejectToken);

      return {
        success: true,
        data: {
          interview: interview,
          acceptToken: acceptToken,
          rejectToken: rejectToken,
          acceptLink: this.generateAcceptLink(interview.id, acceptToken),
          rejectLink: this.generateRejectLink(interview.id, rejectToken)
        },
        message: 'Interview invitation sent successfully'
      };
    } catch (error) {
      console.error('Error in sendInvitation:', error);
      throw error;
    }
  }

  /**
   * Generate secure token for interview actions (accept/reject)
   * 
   * Uses JWT with:
   * - interview_id: UUID of the interview
   * - action: 'accept' or 'reject'
   * - expiry: 7 days (as per requirement 14.4)
   * 
   * Requirements: 14.3, 14.4
   * 
   * @param {string} interviewId - UUID of the interview
   * @param {string} action - 'accept' or 'reject'
   * @returns {string} JWT token
   */
  generateToken(interviewId, action) {
    if (!['accept', 'reject'].includes(action)) {
      throw new Error(`Invalid action: ${action}. Must be 'accept' or 'reject'`);
    }

    const payload = {
      interview_id: interviewId,
      action: action,
      type: 'interview_action'
    };

    // Token expires in 7 days (requirement 14.4)
    const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
      expiresIn: '7d'
    });

    return token;
  }

  /**
   * Validate interview action token
   * 
   * Requirements: 14.3, 14.4
   * 
   * @param {string} interviewId - UUID of the interview
   * @param {string} token - JWT token to validate
   * @param {string} expectedAction - Expected action ('accept' or 'reject')
   * @returns {boolean} True if token is valid
   */
  validateToken(interviewId, token, expectedAction) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

      // Verify token type
      if (decoded.type !== 'interview_action') {
        return false;
      }

      // Verify interview ID matches
      if (decoded.interview_id !== interviewId) {
        return false;
      }

      // Verify action matches
      if (decoded.action !== expectedAction) {
        return false;
      }

      return true;
    } catch (error) {
      // Token is invalid or expired
      console.error('Token validation error:', error.message);
      return false;
    }
  }

  /**
   * Handle candidate accepting interview invitation
   * 
   * When a candidate clicks the accept link:
   * - Validates the token
   * - Updates interview status to "slot_pending"
   * - Sets slot_selection_deadline to 24 hours from now
   * - Logs the action
   * 
   * Requirements: 3.5
   * 
   * @param {string} interviewId - UUID of the interview
   * @param {string} token - Accept token from the link
   * @returns {Promise<Object>} Result with redirect URL
   */
  async handleAccept(interviewId, token) {
    try {
      // 1. Validate token
      if (!this.validateToken(interviewId, token, 'accept')) {
        return {
          success: false,
          error: 'Invalid or expired token',
          message: 'This link is invalid or has expired. Please contact the recruiter.'
        };
      }

      // 2. Get interview details
      const interviewResult = await interviewModel.getById(interviewId);
      if (!interviewResult.success || !interviewResult.data) {
        return {
          success: false,
          error: 'Interview not found',
          message: 'Interview not found. Please contact the recruiter.'
        };
      }

      const interview = interviewResult.data;

      // 3. Check if interview is in correct state
      if (interview.status !== 'invitation_sent') {
        return {
          success: false,
          error: 'Invalid interview state',
          message: `Interview is already ${interview.status}. This link can only be used once.`
        };
      }

      // 4. Set slot_selection_deadline to 24 hours from now
      const slotSelectionDeadline = new Date();
      slotSelectionDeadline.setHours(slotSelectionDeadline.getHours() + 24);

      // 5. Update interview status
      const updateResult = await interviewModel.update(interviewId, {
        status: 'slot_pending',
        slot_selection_deadline: slotSelectionDeadline
      });

      if (!updateResult.success) {
        throw new Error('Failed to update interview status');
      }

      // 6. Log automation action
      await automationLogger.log({
        jobId: interview.job_id,
        actionType: 'invitation_accepted',
        triggerSource: 'auto',
        actorId: interview.candidate_id,
        details: {
          interview_id: interviewId,
          candidate_id: interview.candidate_id,
          slot_selection_deadline: slotSelectionDeadline.toISOString(),
          previous_status: 'invitation_sent',
          new_status: 'slot_pending',
          application_id: interview.application_id
        }
      });

      // 7. Send slot selection email
      await this.sendSlotSelectionEmail(interviewId, updateResult.data);

      return {
        success: true,
        data: {
          interview: updateResult.data,
          redirect: `/interview/select-slot/${interviewId}`
        },
        message: 'Interview invitation accepted. Please select your preferred time slot.'
      };
    } catch (error) {
      console.error('Error in handleAccept:', error);
      throw error;
    }
  }

  /**
   * Handle candidate rejecting interview invitation
   * 
   * When a candidate clicks the reject link:
   * - Validates the token
   * - Updates interview status to "cancelled"
   * - Updates application shortlist_status to "rejected"
   * - Triggers buffer promotion to fill the vacated slot
   * - Logs the action
   * 
   * Requirements: 3.6
   * 
   * @param {string} interviewId - UUID of the interview
   * @param {string} token - Reject token from the link
   * @returns {Promise<Object>} Result with confirmation message
   */
  async handleReject(interviewId, token) {
    try {
      // 1. Validate token
      if (!this.validateToken(interviewId, token, 'reject')) {
        return {
          success: false,
          error: 'Invalid or expired token',
          message: 'This link is invalid or has expired. Please contact the recruiter.'
        };
      }

      // 2. Get interview details
      const interviewResult = await interviewModel.getById(interviewId);
      if (!interviewResult.success || !interviewResult.data) {
        return {
          success: false,
          error: 'Interview not found',
          message: 'Interview not found. Please contact the recruiter.'
        };
      }

      const interview = interviewResult.data;

      // 3. Check if interview is in correct state
      if (interview.status !== 'invitation_sent') {
        return {
          success: false,
          error: 'Invalid interview state',
          message: `Interview is already ${interview.status}. This link can only be used once.`
        };
      }

      // 4. Update interview status to cancelled
      const updateResult = await interviewModel.update(interviewId, {
        status: 'cancelled'
      });

      if (!updateResult.success) {
        throw new Error('Failed to update interview status');
      }

      // 5. Update application shortlist_status to rejected
      const { error: appUpdateError } = await supabase
        .from('applications')
        .update({ shortlist_status: 'rejected' })
        .eq('id', interview.application_id);

      if (appUpdateError) {
        console.error('Error updating application status:', appUpdateError);
        // Continue anyway - interview is already cancelled
      }

      // 6. Log automation action
      await automationLogger.log({
        jobId: interview.job_id,
        actionType: 'invitation_rejected',
        triggerSource: 'auto',
        actorId: interview.candidate_id,
        details: {
          interview_id: interviewId,
          candidate_id: interview.candidate_id,
          application_id: interview.application_id,
          vacated_rank: interview.rank_at_time,
          previous_status: 'invitation_sent',
          new_status: 'cancelled',
          reason: 'candidate_rejected'
        }
      });

      // 7. Trigger buffer promotion
      // Import ShortlistingManager dynamically to avoid circular dependency
      const { shortlistingManager } = await import('./ShortlistingManager.js');
      const promotionResult = await shortlistingManager.promoteFromBuffer(
        interview.job_id,
        interview.rank_at_time
      );

      if (promotionResult.success && promotionResult.data?.promotedApplication) {
        console.log(`Buffer promotion successful for job ${interview.job_id}`);
        // Send invitation to promoted candidate
        const promotedAppId = promotionResult.data.promotedApplication.id;
        try {
          await this.sendInvitation(promotedAppId);
        } catch (emailError) {
          console.error('Error sending invitation to promoted candidate:', emailError);
          // Don't fail the rejection flow if email fails
        }
      } else {
        console.log(`Buffer promotion not performed: ${promotionResult.reason}`);
      }

      return {
        success: true,
        data: {
          interview: updateResult.data,
          promotion: promotionResult
        },
        message: 'Thank you for your response. We appreciate you letting us know.'
      };
    } catch (error) {
      console.error('Error in handleReject:', error);
      throw error;
    }
  }

  /**
   * Generate accept link for interview invitation
   * 
   * @param {string} interviewId - UUID of the interview
   * @param {string} token - Accept token
   * @returns {string} Accept link URL
   */
  generateAcceptLink(interviewId, token) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${baseUrl}/interview/accept/${interviewId}/${token}`;
  }

  /**
   * Generate reject link for interview invitation
   * 
   * @param {string} interviewId - UUID of the interview
   * @param {string} token - Reject token
   * @returns {string} Reject link URL
   */
  generateRejectLink(interviewId, token) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return `${baseUrl}/interview/reject/${interviewId}/${token}`;
  }

  /**
   * Log automation action to automation_logs table
   * 
   * Requirements: 3.9, 8.7
   * 
   * @deprecated Use automationLogger.log() instead
   * @param {string} jobId - UUID of the job
   * @param {string} actionType - Type of action (e.g., 'invitation_sent')
   * @param {Object} details - Additional details about the action
   * @returns {Promise<void>}
   */
  async logAutomation(jobId, actionType, details) {
    // Delegate to automationLogger for consistency
    await automationLogger.log({
      jobId,
      actionType,
      triggerSource: 'auto',
      actorId: null,
      details
    });
  }

  /**
   * Queue invitation email
   * 
   * Sends interview invitation email with accept/reject links.
   * 
   * Requirements: 11.1, 11.2, 11.3, 11.4
   * 
   * @param {Object} application - Application record
   * @param {Object} job - Job record
   * @param {Object} interview - Interview record
   * @param {string} acceptToken - Accept token
   * @param {string} rejectToken - Reject token
   * @returns {Promise<void>}
   */
  async queueInvitationEmail(application, job, interview, acceptToken, rejectToken) {
    try {
      // Get candidate details
      const { data: candidate, error: candidateError } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', application.applicant_id)
        .single();

      if (candidateError || !candidate) {
        console.error('Error fetching candidate details:', candidateError);
        // Use application email as fallback
        candidate = {
          name: application.name || 'Candidate',
          email: application.email
        };
      }

      // Get company name from job or use default
      const companyName = job.company_name || process.env.COMPANY_NAME || 'Our Company';

      // Queue email
      await emailService.queueEmail({
        to: candidate.email,
        template: 'invitation',
        data: {
          candidate_name: candidate.name,
          job_title: job.title,
          company_name: companyName,
          accept_link: this.generateAcceptLink(interview.id, acceptToken),
          reject_link: this.generateRejectLink(interview.id, rejectToken),
          deadline: interview.confirmation_deadline,
          job_id: job.id
        }
      });

      console.log(`Invitation email queued for ${candidate.email}`);
    } catch (error) {
      console.error('Error queuing invitation email:', error);
      // Don't throw - email failure shouldn't break the invitation flow
    }
  }

  /**
   * Send slot selection email
   * 
   * Sends email to candidate with link to select interview time slot.
   * 
   * Requirements: 11.5
   * 
   * @param {string} interviewId - UUID of the interview
   * @param {Object} interview - Interview record
   * @returns {Promise<void>}
   */
  async sendSlotSelectionEmail(interviewId, interview) {
    try {
      // Get application and job details
      const { data: application } = await supabase
        .from('applications')
        .select('*, jobs(*)')
        .eq('id', interview.application_id)
        .single();

      if (!application) {
        console.error('Application not found for slot selection email');
        return;
      }

      // Get candidate details
      const { data: candidate } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', application.applicant_id)
        .single();

      if (!candidate) {
        console.error('Candidate not found for slot selection email');
        return;
      }

      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      // Queue email
      await emailService.queueEmail({
        to: candidate.email,
        template: 'slot_selection',
        data: {
          candidate_name: candidate.name,
          job_title: application.jobs.title,
          slot_selection_link: `${baseUrl}/interview/select-slot/${interviewId}`,
          deadline: interview.slot_selection_deadline,
          job_id: application.job_id
        }
      });

      console.log(`Slot selection email queued for ${candidate.email}`);
    } catch (error) {
      console.error('Error sending slot selection email:', error);
      // Don't throw - email failure shouldn't break the flow
    }
  }
}

// Export singleton instance
export const interviewScheduler = new InterviewScheduler();
export default InterviewScheduler;
