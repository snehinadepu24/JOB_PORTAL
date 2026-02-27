import cron from 'node-cron';
import { supabase } from '../database/supabaseClient.js';
import { isFeatureEnabled } from '../utils/featureFlags.js';
import ShortlistingManager from './ShortlistingManager.js';

/**
 * BackgroundScheduler
 * 
 * Self-healing automation engine that runs periodic tasks to handle deadlines
 * and maintain system health.
 * 
 * Requirements: 8.1, 8.10, 12.8, 12.9
 * 
 * Key Features:
 * - Runs automated checks every 5 minutes using cron
 * - Executes multiple tasks in each cycle (deadline checking, buffer health, reminders)
 * - Implements fault isolation so individual task failures don't stop the cycle
 * - Logs all automation actions with timestamps
 * - Tracks metrics for monitoring
 * - Respects feature flags for automation control
 * 
 * Tasks executed in each cycle:
 * - checkConfirmationDeadlines(): Expire interviews with passed confirmation deadlines
 * - checkSlotSelectionDeadlines(): Expire interviews with passed slot selection deadlines
 * - checkBufferHealth(): Ensure buffer pools are at target size
 * - sendInterviewReminders(): Send reminders 24 hours before interviews
 */
class BackgroundScheduler {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
    this.shortlistingManager = new ShortlistingManager();
  }

  /**
   * Start the background scheduler
   * 
   * Sets up a cron job that runs every 5 minutes.
   * Prevents overlapping cycles by checking isRunning flag.
   * 
   * Requirements: 8.1
   */
  start() {
    // Run every 5 minutes: */5 * * * *
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      if (this.isRunning) {
        console.log('[BackgroundScheduler] Previous cycle still running, skipping...');
        return;
      }

      this.isRunning = true;
      console.log('[BackgroundScheduler] Starting automation cycle...');

      try {
        await this.runCycle();
      } catch (error) {
        console.error('[BackgroundScheduler] Cycle error:', error);
        await this.alertAdmin('Background scheduler cycle failed', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log('[BackgroundScheduler] Started (runs every 5 minutes)');
  }

  /**
   * Stop the background scheduler
   * 
   * Stops the cron job and cleans up resources.
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('[BackgroundScheduler] Stopped');
    }
  }

  /**
   * Run a complete automation cycle
   * 
   * Executes all background tasks with fault isolation.
   * Each task is wrapped in try-catch so failures don't stop the cycle.
   * 
   * Requirements: 8.10
   * 
   * @returns {Promise<Object>} Cycle results with metrics
   */
  async runCycle() {
    const startTime = Date.now();
    const results = {
      expired_invitations: 0,
      expired_slots: 0,
      buffer_promotions: 0,
      buffer_backfills: 0,
      reminders_sent: 0,
      risk_updates: 0,
      errors: []
    };

    // Task 1: Check confirmation deadlines (fault isolated)
    try {
      results.expired_invitations = await this.checkConfirmationDeadlines();
    } catch (error) {
      console.error('[BackgroundScheduler] Error in checkConfirmationDeadlines:', error);
      results.errors.push({ 
        task: 'confirmation_deadlines', 
        error: error.message 
      });
    }

    // Task 2: Check slot selection deadlines (fault isolated)
    try {
      results.expired_slots = await this.checkSlotSelectionDeadlines();
    } catch (error) {
      console.error('[BackgroundScheduler] Error in checkSlotSelectionDeadlines:', error);
      results.errors.push({ 
        task: 'slot_deadlines', 
        error: error.message 
      });
    }

    // Task 3: Check buffer health (fault isolated)
    try {
      results.buffer_backfills = await this.checkBufferHealth();
    } catch (error) {
      console.error('[BackgroundScheduler] Error in checkBufferHealth:', error);
      results.errors.push({ 
        task: 'buffer_health', 
        error: error.message 
      });
    }

    // Task 4: Send interview reminders (fault isolated)
    try {
      results.reminders_sent = await this.sendInterviewReminders();
    } catch (error) {
      console.error('[BackgroundScheduler] Error in sendInterviewReminders:', error);
      results.errors.push({ 
        task: 'reminders', 
        error: error.message 
      });
    }

    // Task 5: Update no-show risk scores (fault isolated)
    try {
      results.risk_updates = await this.updateRiskScores();
    } catch (error) {
      console.error('[BackgroundScheduler] Error in updateRiskScores:', error);
      results.errors.push({ 
        task: 'risk_updates', 
        error: error.message 
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[BackgroundScheduler] Cycle completed in ${duration}ms`, results);

    // Log cycle summary
    await this.logCycleSummary(results, duration);

    // Alert if too many errors
    if (results.errors.length > 3) {
      await this.alertAdmin('High error rate in background scheduler', results);
    }

    return results;
  }

  /**
   * Check for interviews with passed confirmation deadlines
   * 
   * Finds interviews with status="invitation_sent" and confirmation_deadline in the past.
   * Updates status to "expired" and triggers buffer promotion.
   * 
   * Requirements: 3.7, 3.8, 8.2, 8.3, 8.4, 12.8, 12.9
   * 
   * @returns {Promise<number>} Count of expired invitations
   */
  async checkConfirmationDeadlines() {
    try {
      // Check if global automation is enabled
      if (!await isFeatureEnabled('global_automation')) {
        console.log('[BackgroundScheduler] Global automation disabled, skipping confirmation deadline checks');
        return 0;
      }

      // Find interviews with passed confirmation_deadline
      const { data: expiredInterviews, error: queryError } = await supabase
        .from('interviews')
        .select('*')
        .eq('status', 'invitation_sent')
        .lt('confirmation_deadline', new Date().toISOString());

      if (queryError) {
        throw new Error(`Error querying expired interviews: ${queryError.message}`);
      }

      if (!expiredInterviews || expiredInterviews.length === 0) {
        return 0;
      }

      let count = 0;
      for (const interview of expiredInterviews) {
        try {
          // Check if automation is enabled for this specific job
          if (!await isFeatureEnabled('global_automation', interview.job_id)) {
            console.log(`[BackgroundScheduler] Automation disabled for job ${interview.job_id}, skipping interview ${interview.id}`);
            continue;
          }
          // Update interview status to "expired"
          const { error: updateInterviewError } = await supabase
            .from('interviews')
            .update({ status: 'expired' })
            .eq('id', interview.id);

          if (updateInterviewError) {
            console.error(`Error updating interview ${interview.id}:`, updateInterviewError);
            continue;
          }

          // Update application shortlist_status to "rejected"
          const { error: updateAppError } = await supabase
            .from('applications')
            .update({ shortlist_status: 'rejected' })
            .eq('id', interview.application_id);

          if (updateAppError) {
            console.error(`Error updating application ${interview.application_id}:`, updateAppError);
            continue;
          }

          // Trigger buffer promotion
          await this.shortlistingManager.promoteFromBuffer(
            interview.job_id,
            interview.rank_at_time
          );

          // Log automation action
          await this.logAutomation(interview.job_id, 'invitation_expired', {
            interview_id: interview.id,
            application_id: interview.application_id,
            candidate_id: interview.candidate_id,
            rank_at_time: interview.rank_at_time,
            confirmation_deadline: interview.confirmation_deadline
          });

          count++;
        } catch (error) {
          console.error(`Error processing expired interview ${interview.id}:`, error);
          // Continue with next interview (fault isolation)
        }
      }

      return count;
    } catch (error) {
      console.error('[BackgroundScheduler] Error in checkConfirmationDeadlines:', error);
      throw error;
    }
  }

  /**
   * Check for interviews with passed slot selection deadlines
   * 
   * Finds interviews with status="slot_pending" and slot_selection_deadline in the past.
   * Updates status to "expired" and triggers buffer promotion.
   * 
   * Requirements: 4.8, 8.2, 8.3, 8.4, 12.8, 12.9
   * 
   * @returns {Promise<number>} Count of expired slot selections
   */
  async checkSlotSelectionDeadlines() {
    try {
      // Check if global automation is enabled
      if (!await isFeatureEnabled('global_automation')) {
        console.log('[BackgroundScheduler] Global automation disabled, skipping slot selection deadline checks');
        return 0;
      }

      // Find interviews with passed slot_selection_deadline
      const { data: expiredSlots, error: queryError } = await supabase
        .from('interviews')
        .select('*')
        .eq('status', 'slot_pending')
        .lt('slot_selection_deadline', new Date().toISOString());

      if (queryError) {
        throw new Error(`Error querying expired slot selections: ${queryError.message}`);
      }

      if (!expiredSlots || expiredSlots.length === 0) {
        return 0;
      }

      let count = 0;
      for (const interview of expiredSlots) {
        try {
          // Check if automation is enabled for this specific job
          if (!await isFeatureEnabled('global_automation', interview.job_id)) {
            console.log(`[BackgroundScheduler] Automation disabled for job ${interview.job_id}, skipping interview ${interview.id}`);
            continue;
          }
          // Update interview status to "expired"
          const { error: updateInterviewError } = await supabase
            .from('interviews')
            .update({ status: 'expired' })
            .eq('id', interview.id);

          if (updateInterviewError) {
            console.error(`Error updating interview ${interview.id}:`, updateInterviewError);
            continue;
          }

          // Update application shortlist_status to "rejected"
          const { error: updateAppError } = await supabase
            .from('applications')
            .update({ shortlist_status: 'rejected' })
            .eq('id', interview.application_id);

          if (updateAppError) {
            console.error(`Error updating application ${interview.application_id}:`, updateAppError);
            continue;
          }

          // Trigger buffer promotion
          await this.shortlistingManager.promoteFromBuffer(
            interview.job_id,
            interview.rank_at_time
          );

          // Log automation action
          await this.logAutomation(interview.job_id, 'slot_selection_expired', {
            interview_id: interview.id,
            application_id: interview.application_id,
            candidate_id: interview.candidate_id,
            rank_at_time: interview.rank_at_time,
            slot_selection_deadline: interview.slot_selection_deadline
          });

          count++;
        } catch (error) {
          console.error(`Error processing expired slot selection ${interview.id}:`, error);
          // Continue with next interview (fault isolation)
        }
      }

      return count;
    } catch (error) {
      console.error('[BackgroundScheduler] Error in checkSlotSelectionDeadlines:', error);
      throw error;
    }
  }

  /**
   * Check buffer health for all active jobs
   * 
   * Ensures buffer pools are at target size for all active jobs.
   * Backfills buffer when below target.
   * 
   * Requirements: 8.5, 8.6
   * 
   * @returns {Promise<number>} Count of buffer backfills performed
   */
  /**
   * Check buffer health for all active jobs
   * 
   * Finds all active jobs (applications_closed = true) and checks if their
   * buffer pools are at target size. Backfills buffer from pending candidates
   * when below target.
   * 
   * Requirements: 8.5, 8.6, 12.8, 12.9
   * 
   * @returns {Promise<number>} Count of jobs that needed buffer backfilling
   */
  async checkBufferHealth() {
    // Check if global automation is enabled
    if (!await isFeatureEnabled('global_automation')) {
      console.log('[BackgroundScheduler] Global automation disabled, skipping buffer health checks');
      return 0;
    }

    // Get all active jobs (applications_closed = true, not expired)
    const { data: activeJobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, number_of_openings, shortlisting_buffer')
      .eq('expired', false)
      .eq('applications_closed', true);

    if (jobsError) {
      console.error('[BackgroundScheduler] Error fetching active jobs:', jobsError);
      throw jobsError;
    }

    if (!activeJobs || activeJobs.length === 0) {
      return 0;
    }

    let backfillCount = 0;

    for (const job of activeJobs) {
      try {
        // Check if automation is enabled for this specific job
        if (!await isFeatureEnabled('auto_promotion', job.id)) {
          console.log(`[BackgroundScheduler] Auto-promotion disabled for job ${job.id}, skipping buffer health check`);
          continue;
        }
        // Count current buffer candidates
        const { count: currentBuffer, error: countError } = await supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', job.id)
          .eq('shortlist_status', 'buffer');

        if (countError) {
          console.error(`[BackgroundScheduler] Error counting buffer for job ${job.id}:`, countError);
          continue;
        }

        const targetBuffer = job.shortlisting_buffer || job.number_of_openings;

        // If buffer is below target, backfill
        if ((currentBuffer || 0) < targetBuffer) {
          console.log(`[BackgroundScheduler] Buffer below target for job ${job.id}: ${currentBuffer}/${targetBuffer}`);
          
          await this.shortlistingManager.backfillBuffer(job.id);
          
          // Log automation action
          await this.logAutomation(job.id, 'buffer_backfill', {
            reason: 'buffer_below_target',
            previous_buffer_size: currentBuffer || 0,
            target_buffer_size: targetBuffer,
            timestamp: new Date().toISOString()
          });

          backfillCount++;
        }
      } catch (error) {
        console.error(`[BackgroundScheduler] Error checking buffer for job ${job.id}:`, error);
        // Continue with other jobs (fault isolation)
      }
    }

    return backfillCount;
  }

  /**
   * Send interview reminders
   * 
   * Finds interviews scheduled in 24 hours and sends reminder emails
   * to both candidate and recruiter.
   * 
   * Requirements: 11.7
   * 
   * @returns {Promise<number>} Count of reminders sent
   */
  async sendInterviewReminders() {
    try {
      // Calculate time window: 23-25 hours from now (to catch interviews in ~24 hours)
      const now = new Date();
      const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23 hours from now
      const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);   // 25 hours from now

      // Find confirmed interviews scheduled in the 24-hour window
      const { data: upcomingInterviews, error: queryError } = await supabase
        .from('interviews')
        .select(`
          *,
          applications (
            id,
            name,
            email,
            applicant_id
          ),
          jobs (
            id,
            title
          )
        `)
        .eq('status', 'confirmed')
        .gte('scheduled_time', windowStart.toISOString())
        .lte('scheduled_time', windowEnd.toISOString());

      if (queryError) {
        console.error('[BackgroundScheduler] Error querying upcoming interviews:', queryError);
        throw queryError;
      }

      if (!upcomingInterviews || upcomingInterviews.length === 0) {
        return 0;
      }

      let reminderCount = 0;

      for (const interview of upcomingInterviews) {
        try {
          // Check if reminder already sent (to avoid duplicate reminders)
          const { data: existingReminder, error: checkError } = await supabase
            .from('automation_logs')
            .select('id')
            .eq('action_type', 'interview_reminder_sent')
            .eq('details->>interview_id', interview.id)
            .single();

          if (existingReminder) {
            console.log(`[BackgroundScheduler] Reminder already sent for interview ${interview.id}`);
            continue;
          }

          // Get recruiter details
          const { data: recruiter, error: recruiterError } = await supabase
            .from('users')
            .select('name, email')
            .eq('id', interview.recruiter_id)
            .single();

          if (recruiterError) {
            console.error(`[BackgroundScheduler] Error fetching recruiter ${interview.recruiter_id}:`, recruiterError);
            continue;
          }

          // Import EmailService dynamically to avoid circular dependency
          const { emailService } = await import('../services/EmailService.js');

          // Send reminder to candidate
          await emailService.queueEmail({
            to: interview.applications.email,
            template: 'reminder',
            data: {
              candidate_name: interview.applications.name,
              job_title: interview.jobs.title,
              interview_time: interview.scheduled_time
            }
          });

          // Send reminder to recruiter (using same template with recruiter's name)
          await emailService.queueEmail({
            to: recruiter.email,
            template: 'reminder',
            data: {
              candidate_name: interview.applications.name,
              job_title: interview.jobs.title,
              interview_time: interview.scheduled_time,
              recruiter_name: recruiter.name,
              no_show_risk: interview.no_show_risk
            }
          });

          // Log that reminder was sent
          await this.logAutomation(interview.job_id, 'interview_reminder_sent', {
            interview_id: interview.id,
            candidate_id: interview.candidate_id,
            recruiter_id: interview.recruiter_id,
            scheduled_time: interview.scheduled_time,
            no_show_risk: interview.no_show_risk,
            timestamp: new Date().toISOString()
          });

          reminderCount++;
          console.log(`[BackgroundScheduler] Sent reminder for interview ${interview.id}`);
        } catch (error) {
          console.error(`[BackgroundScheduler] Error sending reminder for interview ${interview.id}:`, error);
          // Continue with other interviews (fault isolation)
        }
      }

      return reminderCount;
    } catch (error) {
      console.error('[BackgroundScheduler] Error in sendInterviewReminders:', error);
      throw error;
    }
  }

  /**
   * Update no-show risk scores for confirmed interviews
   * 
   * Recalculates risk scores daily for all confirmed interviews
   * scheduled in the future. This allows risk scores to be updated
   * as new behavioral data becomes available.
   * 
   * Requirements: 7.6
   * 
   * @returns {Promise<number>} Count of risk scores updated
   */
  async updateRiskScores() {
    try {
      // Get all confirmed interviews scheduled in the future
      const { data: confirmedInterviews, error: queryError } = await supabase
        .from('interviews')
        .select('id, candidate_id, job_id, no_show_risk')
        .eq('status', 'confirmed')
        .gt('scheduled_time', new Date().toISOString());

      if (queryError) {
        console.error('[BackgroundScheduler] Error querying confirmed interviews:', queryError);
        throw queryError;
      }

      if (!confirmedInterviews || confirmedInterviews.length === 0) {
        return 0;
      }

      let updateCount = 0;
      const axios = (await import('axios')).default;
      const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

      for (const interview of confirmedInterviews) {
        try {
          // Call Python service to recalculate risk
          const response = await axios.post(
            `${pythonServiceUrl}/api/python/analyze-risk`,
            {
              interview_id: interview.id,
              candidate_id: interview.candidate_id
            },
            {
              timeout: 5000 // 5 second timeout per request
            }
          );

          if (response.data && typeof response.data.no_show_risk === 'number') {
            const newRiskScore = response.data.no_show_risk;
            const oldRiskScore = interview.no_show_risk;

            // Update risk score in database
            const { error: updateError } = await supabase
              .from('interviews')
              .update({ 
                no_show_risk: newRiskScore,
                updated_at: new Date().toISOString()
              })
              .eq('id', interview.id);

            if (updateError) {
              console.error(`[BackgroundScheduler] Error updating risk for interview ${interview.id}:`, updateError);
              continue;
            }

            // Log risk update if score changed significantly (>0.1 difference)
            if (Math.abs(newRiskScore - oldRiskScore) > 0.1) {
              await this.logAutomation(interview.job_id, 'risk_score_updated', {
                interview_id: interview.id,
                candidate_id: interview.candidate_id,
                old_risk: oldRiskScore,
                new_risk: newRiskScore,
                risk_level: response.data.risk_level,
                timestamp: new Date().toISOString()
              });
            }

            updateCount++;
            console.log(`[BackgroundScheduler] Updated risk for interview ${interview.id}: ${oldRiskScore} -> ${newRiskScore}`);
          }
        } catch (error) {
          console.error(`[BackgroundScheduler] Error updating risk for interview ${interview.id}:`, error.message);
          // Continue with other interviews (fault isolation)
        }
      }

      return updateCount;
    } catch (error) {
      console.error('[BackgroundScheduler] Error in updateRiskScores:', error);
      throw error;
    }
  }

  /**
   * Log cycle summary to automation_logs table
   * 
   * Records cycle execution metrics for monitoring and debugging.
   * 
   * Requirements: 8.7
   * 
   * @param {Object} results - Cycle results with task counts and errors
   * @param {number} duration - Cycle duration in milliseconds
   */
  async logCycleSummary(results, duration) {
    try {
      await supabase
        .from('automation_logs')
        .insert({
          job_id: null,
          action_type: 'background_cycle',
          trigger_source: 'scheduled',
          actor_id: null,
          details: {
            duration_ms: duration,
            results: results,
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('[BackgroundScheduler] Error logging cycle summary:', error);
    }
  }

  /**
   * Log automation action to automation_logs table
   * 
   * Records automation actions for monitoring and debugging.
   * 
   * Requirements: 8.7
   * 
   * @param {string} jobId - Job ID (can be null for system-wide actions)
   * @param {string} actionType - Type of action performed
   * @param {Object} details - Action details
   */
  async logAutomation(jobId, actionType, details) {
    try {
      await supabase
        .from('automation_logs')
        .insert({
          job_id: jobId,
          action_type: actionType,
          trigger_source: 'scheduled',
          actor_id: null,
          details: details
        });
    } catch (error) {
      console.error('[BackgroundScheduler] Error logging automation:', error);
    }
  }

  /**
   * Alert system administrator
   * 
   * Sends alert notification when critical errors occur.
   * 
   * @param {string} subject - Alert subject
   * @param {*} details - Alert details (error object or results)
   */
  async alertAdmin(subject, details) {
    try {
      // Log to console for now
      console.error('[BackgroundScheduler] ADMIN ALERT:', subject, details);
      
      // TODO: Implement email notification to admin
      // await emailService.sendAdminAlert(subject, details);
      
      // Log to automation_logs
      await supabase
        .from('automation_logs')
        .insert({
          job_id: null,
          action_type: 'admin_alert',
          trigger_source: 'auto',
          actor_id: null,
          details: {
            subject: subject,
            details: typeof details === 'object' ? JSON.stringify(details) : String(details),
            timestamp: new Date().toISOString()
          }
        });
    } catch (error) {
      console.error('[BackgroundScheduler] Error sending admin alert:', error);
    }
  }
}

// Export singleton instance
export const backgroundScheduler = new BackgroundScheduler();
export default BackgroundScheduler;
