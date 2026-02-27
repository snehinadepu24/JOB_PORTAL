import cron from 'node-cron';
import { supabase } from '../database/supabaseClient.js';
import ShortlistingManager from './ShortlistingManager.js';

/**
 * BackgroundScheduler
 * 
 * Self-healing automation engine that runs periodic tasks to handle deadlines
 * and maintain system health.
 * 
 * Requirements: 8.1, 8.10
 * 
 * Key Features:
 * - Runs automated checks every 5 minutes using cron
 * - Executes multiple tasks in each cycle (deadline checking, buffer health, reminders)
 * - Implements fault isolation so individual task failures don't stop the cycle
 * - Logs all automation actions with timestamps
 * - Tracks metrics for monitoring
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
   * Requirements: 3.7, 3.8, 8.2, 8.3, 8.4
   * 
   * @returns {Promise<number>} Count of expired invitations
   */
  async checkConfirmationDeadlines() {
    // TODO: Implement in Task 10.2
    // Placeholder implementation
    return 0;
  }

  /**
   * Check for interviews with passed slot selection deadlines
   * 
   * Finds interviews with status="slot_pending" and slot_selection_deadline in the past.
   * Updates status to "expired" and triggers buffer promotion.
   * 
   * Requirements: 4.8, 8.2, 8.3, 8.4
   * 
   * @returns {Promise<number>} Count of expired slot selections
   */
  async checkSlotSelectionDeadlines() {
    // TODO: Implement in Task 10.3
    // Placeholder implementation
    return 0;
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
  async checkBufferHealth() {
    // TODO: Implement in Task 10.4
    // Placeholder implementation
    return 0;
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
    // TODO: Implement in Task 10.5
    // Placeholder implementation
    return 0;
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
