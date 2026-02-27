import { supabase } from '../database/supabaseClient.js';
import { isFeatureEnabled } from '../utils/featureFlags.js';

/**
 * ShortlistingManager
 * 
 * Manages dynamic shortlisting, buffer pools, and auto-promotion logic.
 * 
 * Requirements: 2.3-2.6, 2.8-2.11, 12.8, 12.9
 * 
 * Key Responsibilities:
 * - Auto-shortlist top N candidates based on fit_score
 * - Maintain buffer pool of next-best candidates
 * - Promote buffer candidates when shortlisted candidates drop out
 * - Backfill buffer pool to maintain target size
 * - Respect feature flags for automation control
 */
class ShortlistingManager {
  /**
   * Auto-shortlist top N candidates and create buffer pool
   * 
   * Ranking Trigger Rules:
   * - Triggered when: total applications >= number_of_openings AND applications_closed = true
   * - OR recruiter manually clicks "Start Automation" button
   * - Ranking runs once per job (idempotent)
   * 
   * Requirements: 12.8, 12.9
   * 
   * @param {string} jobId - UUID of the job
   * @returns {Promise<Object>} Result with shortlisted and buffer counts
   */
  async autoShortlist(jobId) {
    try {
      // Check if auto-shortlisting is enabled
      if (!await isFeatureEnabled('auto_shortlisting', jobId)) {
        console.log(`[ShortlistingManager] Auto-shortlisting disabled for job ${jobId}`);
        return {
          success: false,
          reason: 'Auto-shortlisting is disabled for this job',
          message: 'Automation is disabled. Please use manual shortlisting.'
        };
      }

      // 1. Get job with number_of_openings and shortlisting_buffer
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        throw new Error(`Job not found: ${jobError?.message || 'Unknown error'}`);
      }

      // 2. Get all applications ordered by fit_score DESC
      const { data: applications, error: appsError } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', jobId)
        .order('fit_score', { ascending: false });

      if (appsError) {
        throw new Error(`Error fetching applications: ${appsError.message}`);
      }

      if (!applications || applications.length === 0) {
        return {
          success: true,
          shortlisted: 0,
          buffer: 0,
          message: 'No applications to shortlist'
        };
      }

      const numberOfOpenings = job.number_of_openings;
      const bufferSize = job.shortlisting_buffer || numberOfOpenings;

      // 3. Shortlist top N (where N = number_of_openings)
      const topN = applications.slice(0, numberOfOpenings);
      
      for (let i = 0; i < topN.length; i++) {
        const { error: updateError } = await supabase
          .from('applications')
          .update({
            shortlist_status: 'shortlisted',
            rank: i + 1
          })
          .eq('id', topN[i].id);

        if (updateError) {
          console.error(`Error shortlisting application ${topN[i].id}:`, updateError);
        }
      }

      // 4. Place next N in buffer
      const bufferN = applications.slice(
        numberOfOpenings,
        numberOfOpenings + bufferSize
      );

      for (let i = 0; i < bufferN.length; i++) {
        const { error: updateError } = await supabase
          .from('applications')
          .update({
            shortlist_status: 'buffer',
            rank: numberOfOpenings + i + 1
          })
          .eq('id', bufferN[i].id);

        if (updateError) {
          console.error(`Error adding to buffer ${bufferN[i].id}:`, updateError);
        }
      }

      // 5. Mark remaining as pending
      const remaining = applications.slice(numberOfOpenings + bufferSize);
      
      for (const app of remaining) {
        const { error: updateError } = await supabase
          .from('applications')
          .update({
            shortlist_status: 'pending',
            rank: null
          })
          .eq('id', app.id);

        if (updateError) {
          console.error(`Error updating pending status ${app.id}:`, updateError);
        }
      }

      // Log automation action
      await this.logAutomation(jobId, 'auto_shortlist', {
        shortlisted_count: topN.length,
        buffer_count: bufferN.length,
        total_applications: applications.length
      });

      return {
        success: true,
        shortlisted: topN.length,
        buffer: bufferN.length,
        message: `Shortlisted ${topN.length} candidates, ${bufferN.length} in buffer`
      };
    } catch (error) {
      console.error('Error in autoShortlist:', error);
      throw error;
    }
  }

  /**
   * Promote highest-ranked buffer candidate to fill vacated shortlist position
   * 
   * Promotion Rules:
   * - Auto-backfill from buffer when: shortlisted candidate rejects/expires/no-shows BEFORE interview completion
   * - After interview confirmation: No auto-backfill (recruiter must manually decide)
   * - Cutoff deadline: Promotions stop 24 hours before first scheduled interview
   * 
   * Requirements: 12.8, 12.9
   * 
   * @param {string} jobId - UUID of the job
   * @param {number} vacatedRank - The rank position that was vacated
   * @returns {Promise<Object>} Promoted candidate or null if buffer empty
   */
  async promoteFromBuffer(jobId, vacatedRank) {
    try {
      // Check if auto-promotion is enabled
      if (!await isFeatureEnabled('auto_promotion', jobId)) {
        console.log(`[ShortlistingManager] Auto-promotion disabled for job ${jobId}`);
        return {
          success: false,
          reason: 'Auto-promotion is disabled for this job'
        };
      }

      // Check if promotion is allowed
      const canPromoteResult = await this.canPromote(jobId);
      if (!canPromoteResult.allowed) {
        console.log(`Promotion not allowed for job ${jobId}: ${canPromoteResult.reason}`);
        await this.logAutomation(jobId, 'promotion_blocked', {
          reason: canPromoteResult.reason,
          vacated_rank: vacatedRank
        });
        return {
          success: false,
          reason: canPromoteResult.reason
        };
      }

      // 1. Get highest-ranked buffer candidate
      const { data: bufferCandidates, error: bufferError } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', jobId)
        .eq('shortlist_status', 'buffer')
        .order('rank', { ascending: true })
        .limit(1);

      if (bufferError) {
        throw new Error(`Error fetching buffer candidates: ${bufferError.message}`);
      }

      if (!bufferCandidates || bufferCandidates.length === 0) {
        await this.logAutomation(jobId, 'buffer_empty', {
          message: 'No buffer candidates available for promotion',
          vacated_rank: vacatedRank
        });
        return {
          success: false,
          reason: 'No buffer candidates available'
        };
      }

      const bufferCandidate = bufferCandidates[0];

      // 2. Promote to shortlisted
      const { error: promoteError } = await supabase
        .from('applications')
        .update({
          shortlist_status: 'shortlisted',
          rank: vacatedRank
        })
        .eq('id', bufferCandidate.id);

      if (promoteError) {
        throw new Error(`Error promoting candidate: ${promoteError.message}`);
      }

      // 3. Backfill buffer
      await this.backfillBuffer(jobId);

      // 4. Log automation action
      await this.logAutomation(jobId, 'buffer_promotion', {
        candidate_id: bufferCandidate.applicant_id,
        application_id: bufferCandidate.id,
        new_rank: vacatedRank,
        previous_rank: bufferCandidate.rank
      });

      return {
        success: true,
        candidate: bufferCandidate,
        message: `Promoted candidate to rank ${vacatedRank}`
      };
    } catch (error) {
      console.error('Error in promoteFromBuffer:', error);
      throw error;
    }
  }

  /**
   * Backfill buffer pool to maintain target size
   * 
   * Adds the next highest-ranked pending candidate to buffer pool
   * 
   * @param {string} jobId - UUID of the job
   * @returns {Promise<Object>} Result with backfilled count
   */
  async backfillBuffer(jobId) {
    try {
      // 1. Get job details
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        throw new Error(`Job not found: ${jobError?.message || 'Unknown error'}`);
      }

      const targetBufferSize = job.shortlisting_buffer || job.number_of_openings;

      // 2. Count current buffer candidates
      const { data: currentBuffer, error: bufferCountError } = await supabase
        .from('applications')
        .select('id')
        .eq('job_id', jobId)
        .eq('shortlist_status', 'buffer');

      if (bufferCountError) {
        throw new Error(`Error counting buffer: ${bufferCountError.message}`);
      }

      const currentBufferSize = currentBuffer?.length || 0;
      const slotsToFill = targetBufferSize - currentBufferSize;

      if (slotsToFill <= 0) {
        return {
          success: true,
          backfilled: 0,
          message: 'Buffer is at target size'
        };
      }

      // 3. Get highest-ranked pending candidates
      const { data: pendingCandidates, error: pendingError } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', jobId)
        .eq('shortlist_status', 'pending')
        .order('fit_score', { ascending: false })
        .limit(slotsToFill);

      if (pendingError) {
        throw new Error(`Error fetching pending candidates: ${pendingError.message}`);
      }

      if (!pendingCandidates || pendingCandidates.length === 0) {
        return {
          success: true,
          backfilled: 0,
          message: 'No pending candidates available for backfill'
        };
      }

      // 4. Get the highest current rank to determine next buffer ranks
      const { data: allRanked, error: rankedError } = await supabase
        .from('applications')
        .select('rank')
        .eq('job_id', jobId)
        .not('rank', 'is', null)
        .order('rank', { ascending: false })
        .limit(1);

      if (rankedError) {
        throw new Error(`Error fetching ranks: ${rankedError.message}`);
      }

      let nextRank = (allRanked && allRanked.length > 0) 
        ? allRanked[0].rank + 1 
        : job.number_of_openings + 1;

      // 5. Add candidates to buffer
      let backfilledCount = 0;
      for (const candidate of pendingCandidates) {
        const { error: updateError } = await supabase
          .from('applications')
          .update({
            shortlist_status: 'buffer',
            rank: nextRank
          })
          .eq('id', candidate.id);

        if (updateError) {
          console.error(`Error backfilling candidate ${candidate.id}:`, updateError);
        } else {
          backfilledCount++;
          nextRank++;
        }
      }

      // Log automation action
      if (backfilledCount > 0) {
        await this.logAutomation(jobId, 'buffer_backfill', {
          backfilled_count: backfilledCount,
          target_buffer_size: targetBufferSize,
          current_buffer_size: currentBufferSize + backfilledCount
        });
      }

      return {
        success: true,
        backfilled: backfilledCount,
        message: `Backfilled ${backfilledCount} candidates to buffer`
      };
    } catch (error) {
      console.error('Error in backfillBuffer:', error);
      throw error;
    }
  }

  /**
   * Check if promotion from buffer is allowed
   * 
   * Promotion Rules:
   * - Promotions stop 24 hours before first scheduled interview
   * - After interview confirmation: No auto-backfill
   * 
   * @param {string} jobId - UUID of the job
   * @returns {Promise<Object>} Object with allowed flag and reason
   */
  async canPromote(jobId) {
    try {
      // Check if there are any confirmed interviews within 24 hours
      const twentyFourHoursFromNow = new Date();
      twentyFourHoursFromNow.setHours(twentyFourHoursFromNow.getHours() + 24);

      const { data: upcomingInterviews, error: interviewError } = await supabase
        .from('interviews')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'confirmed')
        .lte('scheduled_time', twentyFourHoursFromNow.toISOString())
        .order('scheduled_time', { ascending: true })
        .limit(1);

      if (interviewError) {
        console.error('Error checking interviews:', interviewError);
        // Allow promotion if we can't check (fail open)
        return {
          allowed: true,
          reason: 'Unable to verify interview schedule'
        };
      }

      if (upcomingInterviews && upcomingInterviews.length > 0) {
        return {
          allowed: false,
          reason: 'Promotion blocked: Interview scheduled within 24 hours'
        };
      }

      return {
        allowed: true,
        reason: 'Promotion allowed'
      };
    } catch (error) {
      console.error('Error in canPromote:', error);
      // Fail open - allow promotion if check fails
      return {
        allowed: true,
        reason: 'Unable to verify promotion eligibility'
      };
    }
  }

  /**
   * Log automation action to automation_logs table
   * 
   * @param {string} jobId - UUID of the job
   * @param {string} actionType - Type of action
   * @param {Object} details - Additional details about the action
   * @returns {Promise<void>}
   */
  async logAutomation(jobId, actionType, details) {
    try {
      const { error } = await supabase
        .from('automation_logs')
        .insert([
          {
            job_id: jobId,
            action_type: actionType,
            trigger_source: 'auto',
            details: details
          }
        ]);

      if (error) {
        console.error('Error logging automation:', error);
      }
    } catch (error) {
      console.error('Error in logAutomation:', error);
    }
  }

  /**
   * Get shortlist status for a job
   * 
   * @param {string} jobId - UUID of the job
   * @returns {Promise<Object>} Shortlist status with counts
   */
  async getShortlistStatus(jobId) {
    try {
      const { data: applications, error } = await supabase
        .from('applications')
        .select('shortlist_status')
        .eq('job_id', jobId);

      if (error) {
        throw new Error(`Error fetching applications: ${error.message}`);
      }

      const statusCounts = {
        shortlisted: 0,
        buffer: 0,
        pending: 0,
        rejected: 0,
        expired: 0
      };

      applications?.forEach(app => {
        if (statusCounts.hasOwnProperty(app.shortlist_status)) {
          statusCounts[app.shortlist_status]++;
        }
      });

      return {
        success: true,
        ...statusCounts,
        total: applications?.length || 0
      };
    } catch (error) {
      console.error('Error in getShortlistStatus:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const shortlistingManager = new ShortlistingManager();
export default ShortlistingManager;
