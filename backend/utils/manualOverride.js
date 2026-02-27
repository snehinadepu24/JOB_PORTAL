/**
 * Manual Override Utility
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4
 * - Preserve existing manual accept/reject endpoints
 * - Add bypass logic for manually accepted candidates
 * - Update shortlist_status correctly for manual actions
 * - Ensure backward compatibility with existing features
 */

const { supabase } = require('../database/supabaseClient');

class ManualOverride {
  /**
   * Manually accept an application (bypasses automation)
   * 
   * Requirements: 12.1, 12.2, 12.3
   * 
   * @param {string} applicationId - UUID of the application
   * @param {string} employerId - UUID of the employer making the decision
   * @returns {Promise<Object>} Result of the operation
   */
  async manualAccept(applicationId, employerId) {
    try {
      // Get application details
      const { data: application, error: fetchError } = await supabase
        .from('applications')
        .select('*, jobs(*)')
        .eq('id', applicationId)
        .single();

      if (fetchError || !application) {
        return {
          success: false,
          error: 'Application not found'
        };
      }

      // Verify employer owns this application
      if (application.employer_id !== employerId) {
        return {
          success: false,
          error: 'Unauthorized to update this application'
        };
      }

      // Update application status to accepted
      // Set shortlist_status to 'shortlisted' to indicate manual acceptance
      // Set a flag to indicate this was a manual action (bypass automation)
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'accepted',
          shortlist_status: 'shortlisted',
          manual_override: true, // Flag to bypass automation
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (updateError) {
        return {
          success: false,
          error: updateError.message
        };
      }

      // Log the manual action
      await this.logManualAction(
        application.job_id,
        applicationId,
        employerId,
        'manual_accept',
        {
          application_id: applicationId,
          candidate_name: application.name,
          reason: 'Manual acceptance by recruiter'
        }
      );

      return {
        success: true,
        message: 'Application manually accepted',
        application_id: applicationId
      };
    } catch (error) {
      console.error('Error in manualAccept:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manually reject an application (bypasses automation)
   * 
   * Requirements: 12.1, 12.2, 12.4
   * 
   * @param {string} applicationId - UUID of the application
   * @param {string} employerId - UUID of the employer making the decision
   * @param {string} reason - Optional reason for rejection
   * @returns {Promise<Object>} Result of the operation
   */
  async manualReject(applicationId, employerId, reason = null) {
    try {
      // Get application details
      const { data: application, error: fetchError } = await supabase
        .from('applications')
        .select('*, jobs(*)')
        .eq('id', applicationId)
        .single();

      if (fetchError || !application) {
        return {
          success: false,
          error: 'Application not found'
        };
      }

      // Verify employer owns this application
      if (application.employer_id !== employerId) {
        return {
          success: false,
          error: 'Unauthorized to update this application'
        };
      }

      // Update application status to rejected
      // Set shortlist_status to 'rejected' to exclude from automation
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          status: 'rejected',
          shortlist_status: 'rejected',
          manual_override: true, // Flag to bypass automation
          rejection_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (updateError) {
        return {
          success: false,
          error: updateError.message
        };
      }

      // Log the manual action
      await this.logManualAction(
        application.job_id,
        applicationId,
        employerId,
        'manual_reject',
        {
          application_id: applicationId,
          candidate_name: application.name,
          reason: reason || 'Manual rejection by recruiter'
        }
      );

      return {
        success: true,
        message: 'Application manually rejected',
        application_id: applicationId
      };
    } catch (error) {
      console.error('Error in manualReject:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Manually shortlist an application (bypasses automation)
   * 
   * Requirements: 12.2, 12.3
   * 
   * @param {string} applicationId - UUID of the application
   * @param {string} employerId - UUID of the employer making the decision
   * @returns {Promise<Object>} Result of the operation
   */
  async manualShortlist(applicationId, employerId) {
    try {
      // Get application details
      const { data: application, error: fetchError } = await supabase
        .from('applications')
        .select('*, jobs(*)')
        .eq('id', applicationId)
        .single();

      if (fetchError || !application) {
        return {
          success: false,
          error: 'Application not found'
        };
      }

      // Verify employer owns this application
      if (application.employer_id !== employerId) {
        return {
          success: false,
          error: 'Unauthorized to update this application'
        };
      }

      // Check if job has reached shortlist limit
      const { data: shortlistedCount, error: countError } = await supabase
        .from('applications')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', application.job_id)
        .eq('shortlist_status', 'shortlisted');

      if (countError) {
        return {
          success: false,
          error: countError.message
        };
      }

      const job = application.jobs;
      const numberOfOpenings = job.number_of_openings || 5;

      if (shortlistedCount >= numberOfOpenings) {
        return {
          success: false,
          error: `Shortlist is full (${numberOfOpenings} openings). Please remove a candidate first.`
        };
      }

      // Get next available rank
      const { data: maxRankData, error: rankError } = await supabase
        .from('applications')
        .select('rank')
        .eq('job_id', application.job_id)
        .eq('shortlist_status', 'shortlisted')
        .order('rank', { ascending: false })
        .limit(1);

      const nextRank = (maxRankData && maxRankData.length > 0) 
        ? maxRankData[0].rank + 1 
        : 1;

      // Update application to shortlisted
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          shortlist_status: 'shortlisted',
          rank: nextRank,
          manual_override: true, // Flag to bypass automation
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (updateError) {
        return {
          success: false,
          error: updateError.message
        };
      }

      // Log the manual action
      await this.logManualAction(
        application.job_id,
        applicationId,
        employerId,
        'manual_shortlist',
        {
          application_id: applicationId,
          candidate_name: application.name,
          rank: nextRank,
          reason: 'Manual shortlist by recruiter'
        }
      );

      return {
        success: true,
        message: 'Application manually shortlisted',
        application_id: applicationId,
        rank: nextRank
      };
    } catch (error) {
      console.error('Error in manualShortlist:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if an application has manual override flag
   * 
   * @param {string} applicationId - UUID of the application
   * @returns {Promise<boolean>} True if manual override is set
   */
  async hasManualOverride(applicationId) {
    try {
      const { data: application, error } = await supabase
        .from('applications')
        .select('manual_override')
        .eq('id', applicationId)
        .single();

      if (error || !application) {
        return false;
      }

      return application.manual_override === true;
    } catch (error) {
      console.error('Error checking manual override:', error);
      return false;
    }
  }

  /**
   * Remove manual override flag (allow automation to take over)
   * 
   * @param {string} applicationId - UUID of the application
   * @returns {Promise<Object>} Result of the operation
   */
  async removeManualOverride(applicationId) {
    try {
      const { error } = await supabase
        .from('applications')
        .update({
          manual_override: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        message: 'Manual override removed'
      };
    } catch (error) {
      console.error('Error removing manual override:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Log manual action to automation_logs table
   * 
   * @param {string} jobId - UUID of the job
   * @param {string} applicationId - UUID of the application
   * @param {string} actorId - UUID of the user performing the action
   * @param {string} actionType - Type of manual action
   * @param {Object} details - Additional details
   */
  async logManualAction(jobId, applicationId, actorId, actionType, details) {
    try {
      await supabase
        .from('automation_logs')
        .insert([
          {
            job_id: jobId,
            application_id: applicationId,
            action_type: actionType,
            trigger_source: 'manual',
            actor_id: actorId,
            outcome: 'success',
            details: details,
            created_at: new Date().toISOString()
          }
        ]);
    } catch (error) {
      console.error('Error logging manual action:', error);
      // Don't throw - logging failure shouldn't break the operation
    }
  }

  /**
   * Get all applications with manual overrides for a job
   * 
   * @param {string} jobId - UUID of the job
   * @returns {Promise<Array>} List of applications with manual overrides
   */
  async getManualOverrides(jobId) {
    try {
      const { data: applications, error } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', jobId)
        .eq('manual_override', true)
        .order('updated_at', { ascending: false });

      if (error) {
        return [];
      }

      return applications || [];
    } catch (error) {
      console.error('Error getting manual overrides:', error);
      return [];
    }
  }

  /**
   * Check if automation should be bypassed for an application
   * 
   * This is used by automation components to check if they should skip processing
   * 
   * @param {string} applicationId - UUID of the application
   * @returns {Promise<boolean>} True if automation should be bypassed
   */
  async shouldBypassAutomation(applicationId) {
    return await this.hasManualOverride(applicationId);
  }
}

// Export singleton instance
module.exports = new ManualOverride();
