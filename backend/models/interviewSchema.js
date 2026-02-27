import { supabase } from '../database/supabaseClient.js';

/**
 * Interview Model
 * 
 * Manages interview records with CRUD operations and status transition validation.
 * 
 * Requirements: 3.2, 3.3
 * 
 * Interview Status Values:
 * - invitation_sent: Initial state when invitation is sent
 * - slot_pending: Candidate accepted, waiting for slot selection
 * - confirmed: Interview slot confirmed
 * - completed: Interview conducted
 * - cancelled: Interview cancelled
 * - no_show: Candidate didn't attend
 * - expired: Invitation or slot selection deadline passed
 * 
 * Valid Status Transitions:
 * - invitation_sent → slot_pending (candidate accepts)
 * - invitation_sent → cancelled (candidate rejects)
 * - invitation_sent → expired (deadline passed)
 * - slot_pending → confirmed (slot selected)
 * - slot_pending → expired (deadline passed)
 * - confirmed → completed (interview conducted)
 * - confirmed → no_show (candidate doesn't attend)
 * - confirmed → cancelled (manual cancellation)
 */

// Valid status transitions map
const VALID_TRANSITIONS = {
  invitation_sent: ['slot_pending', 'cancelled', 'expired'],
  slot_pending: ['confirmed', 'expired'],
  confirmed: ['completed', 'no_show', 'cancelled']
};

// All valid status values
const VALID_STATUSES = [
  'invitation_sent',
  'slot_pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
  'expired'
];

class InterviewModel {
  /**
   * Create a new interview record
   * 
   * @param {Object} interviewData - Interview data
   * @param {string} interviewData.application_id - UUID of the application
   * @param {string} interviewData.job_id - UUID of the job
   * @param {string} interviewData.recruiter_id - UUID of the recruiter
   * @param {string} interviewData.candidate_id - UUID of the candidate
   * @param {number} interviewData.rank_at_time - Candidate rank when interview created
   * @param {string} [interviewData.status='invitation_sent'] - Initial status
   * @param {Date} [interviewData.confirmation_deadline] - Deadline for confirmation
   * @param {Date} [interviewData.slot_selection_deadline] - Deadline for slot selection
   * @param {Date} [interviewData.scheduled_time] - Scheduled interview time
   * @param {string} [interviewData.calendar_event_id] - Google Calendar event ID
   * @param {string} [interviewData.calendar_sync_method='google'] - Calendar sync method
   * @param {number} [interviewData.no_show_risk=0.5] - No-show risk score (0-1)
   * @returns {Promise<Object>} Created interview record
   */
  async create(interviewData) {
    try {
      // Validate required fields
      const requiredFields = ['application_id', 'job_id', 'recruiter_id', 'candidate_id', 'rank_at_time'];
      for (const field of requiredFields) {
        if (!interviewData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate status if provided
      const status = interviewData.status || 'invitation_sent';
      if (!VALID_STATUSES.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      // Validate no_show_risk if provided
      if (interviewData.no_show_risk !== undefined) {
        if (interviewData.no_show_risk < 0 || interviewData.no_show_risk > 1) {
          throw new Error('no_show_risk must be between 0 and 1');
        }
      }

      // Prepare interview data
      const interview = {
        application_id: interviewData.application_id,
        job_id: interviewData.job_id,
        recruiter_id: interviewData.recruiter_id,
        candidate_id: interviewData.candidate_id,
        rank_at_time: interviewData.rank_at_time,
        status: status,
        confirmation_deadline: interviewData.confirmation_deadline || null,
        slot_selection_deadline: interviewData.slot_selection_deadline || null,
        scheduled_time: interviewData.scheduled_time || null,
        calendar_event_id: interviewData.calendar_event_id || null,
        calendar_sync_method: interviewData.calendar_sync_method || 'google',
        no_show_risk: interviewData.no_show_risk !== undefined ? interviewData.no_show_risk : 0.5
      };

      const { data, error } = await supabase
        .from('interviews')
        .insert([interview])
        .select()
        .single();

      if (error) {
        throw new Error(`Error creating interview: ${error.message}`);
      }

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error in InterviewModel.create:', error);
      throw error;
    }
  }

  /**
   * Get interview by ID
   * 
   * @param {string} interviewId - UUID of the interview
   * @returns {Promise<Object>} Interview record
   */
  async getById(interviewId) {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', interviewId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Interview not found');
        }
        throw new Error(`Error fetching interview: ${error.message}`);
      }

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error in InterviewModel.getById:', error);
      throw error;
    }
  }

  /**
   * Get all interviews for a job
   * 
   * @param {string} jobId - UUID of the job
   * @param {Object} [filters] - Optional filters
   * @param {string} [filters.status] - Filter by status
   * @returns {Promise<Object>} Array of interview records
   */
  async getByJobId(jobId, filters = {}) {
    try {
      let query = supabase
        .from('interviews')
        .select('*')
        .eq('job_id', jobId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error fetching interviews: ${error.message}`);
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error('Error in InterviewModel.getByJobId:', error);
      throw error;
    }
  }

  /**
   * Get all interviews for a candidate
   * 
   * @param {string} candidateId - UUID of the candidate
   * @param {Object} [filters] - Optional filters
   * @param {string} [filters.status] - Filter by status
   * @returns {Promise<Object>} Array of interview records
   */
  async getByCandidateId(candidateId, filters = {}) {
    try {
      let query = supabase
        .from('interviews')
        .select('*')
        .eq('candidate_id', candidateId);

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error fetching interviews: ${error.message}`);
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error('Error in InterviewModel.getByCandidateId:', error);
      throw error;
    }
  }

  /**
   * Get interview by application ID
   * 
   * @param {string} applicationId - UUID of the application
   * @returns {Promise<Object>} Interview record
   */
  async getByApplicationId(applicationId) {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('application_id', applicationId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        throw new Error(`Error fetching interview: ${error.message}`);
      }

      return {
        success: true,
        data: data && data.length > 0 ? data[0] : null
      };
    } catch (error) {
      console.error('Error in InterviewModel.getByApplicationId:', error);
      throw error;
    }
  }

  /**
   * Update interview with status transition validation
   * 
   * @param {string} interviewId - UUID of the interview
   * @param {Object} updates - Fields to update
   * @param {string} [updates.status] - New status (validated against current status)
   * @param {Date} [updates.scheduled_time] - Scheduled interview time
   * @param {Date} [updates.confirmation_deadline] - Confirmation deadline
   * @param {Date} [updates.slot_selection_deadline] - Slot selection deadline
   * @param {string} [updates.calendar_event_id] - Calendar event ID
   * @param {string} [updates.calendar_sync_method] - Calendar sync method
   * @param {number} [updates.no_show_risk] - No-show risk score
   * @returns {Promise<Object>} Updated interview record
   */
  async update(interviewId, updates) {
    try {
      // Get current interview to validate status transition
      const currentInterview = await this.getById(interviewId);
      
      if (!currentInterview.success || !currentInterview.data) {
        throw new Error('Interview not found');
      }

      const currentStatus = currentInterview.data.status;

      // Validate status transition if status is being updated
      if (updates.status && updates.status !== currentStatus) {
        if (!this.isValidTransition(currentStatus, updates.status)) {
          throw new Error(
            `Invalid status transition: ${currentStatus} → ${updates.status}. ` +
            `Valid transitions from ${currentStatus}: ${VALID_TRANSITIONS[currentStatus]?.join(', ') || 'none'}`
          );
        }
      }

      // Validate no_show_risk if provided
      if (updates.no_show_risk !== undefined) {
        if (updates.no_show_risk < 0 || updates.no_show_risk > 1) {
          throw new Error('no_show_risk must be between 0 and 1');
        }
      }

      // Perform update
      const { data, error } = await supabase
        .from('interviews')
        .update(updates)
        .eq('id', interviewId)
        .select()
        .single();

      if (error) {
        throw new Error(`Error updating interview: ${error.message}`);
      }

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error in InterviewModel.update:', error);
      throw error;
    }
  }

  /**
   * Delete interview
   * 
   * @param {string} interviewId - UUID of the interview
   * @returns {Promise<Object>} Success status
   */
  async delete(interviewId) {
    try {
      const { error } = await supabase
        .from('interviews')
        .delete()
        .eq('id', interviewId);

      if (error) {
        throw new Error(`Error deleting interview: ${error.message}`);
      }

      return {
        success: true,
        message: 'Interview deleted successfully'
      };
    } catch (error) {
      console.error('Error in InterviewModel.delete:', error);
      throw error;
    }
  }

  /**
   * Validate status transition
   * 
   * @param {string} currentStatus - Current interview status
   * @param {string} newStatus - New status to transition to
   * @returns {boolean} True if transition is valid
   */
  isValidTransition(currentStatus, newStatus) {
    // Allow staying in the same status
    if (currentStatus === newStatus) {
      return true;
    }

    // Check if transition is in valid transitions map
    const validNextStatuses = VALID_TRANSITIONS[currentStatus];
    return validNextStatuses && validNextStatuses.includes(newStatus);
  }

  /**
   * Get interviews with expired deadlines
   * 
   * Helper method for background scheduler to find interviews that need expiration
   * 
   * @returns {Promise<Object>} Object with expired confirmation and slot selection interviews
   */
  async getExpiredInterviews() {
    try {
      const now = new Date().toISOString();

      // Get interviews with expired confirmation deadlines
      const { data: expiredConfirmation, error: confirmError } = await supabase
        .from('interviews')
        .select('*')
        .eq('status', 'invitation_sent')
        .lt('confirmation_deadline', now);

      if (confirmError) {
        throw new Error(`Error fetching expired confirmations: ${confirmError.message}`);
      }

      // Get interviews with expired slot selection deadlines
      const { data: expiredSlots, error: slotError } = await supabase
        .from('interviews')
        .select('*')
        .eq('status', 'slot_pending')
        .lt('slot_selection_deadline', now);

      if (slotError) {
        throw new Error(`Error fetching expired slots: ${slotError.message}`);
      }

      return {
        success: true,
        expiredConfirmation: expiredConfirmation || [],
        expiredSlots: expiredSlots || []
      };
    } catch (error) {
      console.error('Error in InterviewModel.getExpiredInterviews:', error);
      throw error;
    }
  }

  /**
   * Get upcoming interviews within specified hours
   * 
   * Helper method for reminder emails
   * 
   * @param {number} hours - Number of hours to look ahead
   * @returns {Promise<Object>} Array of upcoming interviews
   */
  async getUpcomingInterviews(hours = 24) {
    try {
      const now = new Date();
      const futureTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('status', 'confirmed')
        .gte('scheduled_time', now.toISOString())
        .lte('scheduled_time', futureTime.toISOString())
        .order('scheduled_time', { ascending: true });

      if (error) {
        throw new Error(`Error fetching upcoming interviews: ${error.message}`);
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error('Error in InterviewModel.getUpcomingInterviews:', error);
      throw error;
    }
  }

  /**
   * Get interviews by status
   * 
   * @param {string} status - Status to filter by
   * @returns {Promise<Object>} Array of interviews with specified status
   */
  async getByStatus(status) {
    try {
      if (!VALID_STATUSES.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error fetching interviews: ${error.message}`);
      }

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error('Error in InterviewModel.getByStatus:', error);
      throw error;
    }
  }

  /**
   * Get all valid status values
   * 
   * @returns {Array<string>} Array of valid status values
   */
  getValidStatuses() {
    return [...VALID_STATUSES];
  }

  /**
   * Get valid transitions for a status
   * 
   * @param {string} status - Current status
   * @returns {Array<string>} Array of valid next statuses
   */
  getValidTransitions(status) {
    return VALID_TRANSITIONS[status] ? [...VALID_TRANSITIONS[status]] : [];
  }
}

// Export singleton instance
export const interviewModel = new InterviewModel();
export default InterviewModel;
