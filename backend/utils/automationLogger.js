/**
 * Automation Logger
 * 
 * Centralized logging utility for all automation actions.
 * Ensures consistent logging format with trigger_source, actor_id, and detailed context.
 * 
 * Requirements: 8.7, Observability section
 * 
 * Log Entry Format:
 * - job_id: UUID of the job (nullable for system-wide actions)
 * - action_type: Type of action (e.g., "invitation_sent", "buffer_promotion")
 * - trigger_source: "auto" | "manual" | "scheduled"
 * - actor_id: UUID of user who triggered action (null for automated actions)
 * - details: JSONB with context (candidate_id, interview_id, reason, etc.)
 * - created_at: Timestamp (auto-generated)
 */

import { supabase } from '../database/supabaseClient.js';

class AutomationLogger {
  /**
   * Log an automation action
   * 
   * @param {Object} params - Logging parameters
   * @param {string|null} params.jobId - Job UUID (null for system-wide actions)
   * @param {string} params.actionType - Type of action
   * @param {string} params.triggerSource - "auto" | "manual" | "scheduled"
   * @param {string|null} params.actorId - User UUID (null for automated actions)
   * @param {Object} params.details - Additional context as JSONB
   * @returns {Promise<void>}
   */
  async log({ jobId, actionType, triggerSource = 'auto', actorId = null, details = {} }) {
    try {
      // Validate trigger_source
      if (!['auto', 'manual', 'scheduled'].includes(triggerSource)) {
        console.error(`[AutomationLogger] Invalid trigger_source: ${triggerSource}`);
        triggerSource = 'auto'; // Default to auto
      }

      // Add timestamp to details if not present
      if (!details.timestamp) {
        details.timestamp = new Date().toISOString();
      }

      const { error } = await supabase
        .from('automation_logs')
        .insert([{
          job_id: jobId,
          action_type: actionType,
          trigger_source: triggerSource,
          actor_id: actorId,
          details: details
        }]);

      if (error) {
        console.error('[AutomationLogger] Error logging automation:', error);
        // Don't throw - logging failure shouldn't break the main flow
      }
    } catch (error) {
      console.error('[AutomationLogger] Error in log():', error);
      // Don't throw - logging failure shouldn't break the main flow
    }
  }

  /**
   * Get automation logs for a job with pagination
   * 
   * @param {string} jobId - Job UUID
   * @param {number} limit - Maximum number of logs to return (default: 50)
   * @param {number} offset - Number of logs to skip (default: 0)
   * @returns {Promise<Object>} Logs with pagination info
   */
  async getAutomationLogs(jobId, limit = 50, offset = 0) {
    try {
      // Get total count
      const { count, error: countError } = await supabase
        .from('automation_logs')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', jobId);

      if (countError) {
        throw new Error(`Error counting logs: ${countError.message}`);
      }

      // Get logs with pagination
      const { data: logs, error: logsError } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (logsError) {
        throw new Error(`Error fetching logs: ${logsError.message}`);
      }

      return {
        success: true,
        data: logs || [],
        pagination: {
          total: count || 0,
          limit: limit,
          offset: offset,
          hasMore: (offset + limit) < (count || 0)
        }
      };
    } catch (error) {
      console.error('[AutomationLogger] Error in getAutomationLogs:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        pagination: { total: 0, limit, offset, hasMore: false }
      };
    }
  }

  /**
   * Get automation logs filtered by action type
   * 
   * @param {string} jobId - Job UUID
   * @param {string} actionType - Type of action to filter by
   * @param {number} limit - Maximum number of logs to return (default: 50)
   * @returns {Promise<Object>} Filtered logs
   */
  async getAutomationLogsByType(jobId, actionType, limit = 50) {
    try {
      const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_id', jobId)
        .eq('action_type', actionType)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Error fetching logs by type: ${error.message}`);
      }

      return {
        success: true,
        data: logs || [],
        count: logs?.length || 0
      };
    } catch (error) {
      console.error('[AutomationLogger] Error in getAutomationLogsByType:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0
      };
    }
  }

  /**
   * Get recent automation logs across all jobs
   * 
   * @param {number} limit - Maximum number of logs to return (default: 100)
   * @returns {Promise<Object>} Recent logs
   */
  async getRecentAutomationLogs(limit = 100) {
    try {
      const { data: logs, error } = await supabase
        .from('automation_logs')
        .select(`
          *,
          jobs (
            id,
            title
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Error fetching recent logs: ${error.message}`);
      }

      return {
        success: true,
        data: logs || [],
        count: logs?.length || 0
      };
    } catch (error) {
      console.error('[AutomationLogger] Error in getRecentAutomationLogs:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0
      };
    }
  }

  /**
   * Get automation log statistics for a job
   * 
   * Returns count of logs grouped by action type.
   * 
   * @param {string} jobId - Job UUID
   * @returns {Promise<Object>} Statistics by action type
   */
  async getAutomationLogStats(jobId) {
    try {
      // Get all logs for the job
      const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('action_type, trigger_source')
        .eq('job_id', jobId);

      if (error) {
        throw new Error(`Error fetching logs for stats: ${error.message}`);
      }

      // Count by action type
      const statsByAction = {};
      const statsByTrigger = {};
      let totalCount = 0;

      if (logs) {
        logs.forEach(log => {
          // Count by action type
          if (!statsByAction[log.action_type]) {
            statsByAction[log.action_type] = 0;
          }
          statsByAction[log.action_type]++;

          // Count by trigger source
          if (!statsByTrigger[log.trigger_source]) {
            statsByTrigger[log.trigger_source] = 0;
          }
          statsByTrigger[log.trigger_source]++;

          totalCount++;
        });
      }

      return {
        success: true,
        data: {
          total: totalCount,
          by_action_type: statsByAction,
          by_trigger_source: statsByTrigger
        }
      };
    } catch (error) {
      console.error('[AutomationLogger] Error in getAutomationLogStats:', error);
      return {
        success: false,
        error: error.message,
        data: {
          total: 0,
          by_action_type: {},
          by_trigger_source: {}
        }
      };
    }
  }

  /**
   * Get logs for a specific interview
   * 
   * @param {string} interviewId - Interview UUID
   * @returns {Promise<Object>} Logs related to the interview
   */
  async getLogsForInterview(interviewId) {
    try {
      const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('*')
        .or(`details->>'interview_id'.eq.${interviewId}`)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error fetching interview logs: ${error.message}`);
      }

      return {
        success: true,
        data: logs || [],
        count: logs?.length || 0
      };
    } catch (error) {
      console.error('[AutomationLogger] Error in getLogsForInterview:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0
      };
    }
  }

  /**
   * Get logs for a specific candidate
   * 
   * @param {string} candidateId - Candidate UUID
   * @returns {Promise<Object>} Logs related to the candidate
   */
  async getLogsForCandidate(candidateId) {
    try {
      const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('*')
        .or(`details->>'candidate_id'.eq.${candidateId}`)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error fetching candidate logs: ${error.message}`);
      }

      return {
        success: true,
        data: logs || [],
        count: logs?.length || 0
      };
    } catch (error) {
      console.error('[AutomationLogger] Error in getLogsForCandidate:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0
      };
    }
  }

  /**
   * Get logs within a time range
   * 
   * @param {string} jobId - Job UUID (optional, null for all jobs)
   * @param {Date} startDate - Start of time range
   * @param {Date} endDate - End of time range
   * @returns {Promise<Object>} Logs within the time range
   */
  async getLogsByTimeRange(jobId, startDate, endDate) {
    try {
      let query = supabase
        .from('automation_logs')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      const { data: logs, error } = await query;

      if (error) {
        throw new Error(`Error fetching logs by time range: ${error.message}`);
      }

      return {
        success: true,
        data: logs || [],
        count: logs?.length || 0
      };
    } catch (error) {
      console.error('[AutomationLogger] Error in getLogsByTimeRange:', error);
      return {
        success: false,
        error: error.message,
        data: [],
        count: 0
      };
    }
  }
}

// Export singleton instance
export const automationLogger = new AutomationLogger();
export default AutomationLogger;
