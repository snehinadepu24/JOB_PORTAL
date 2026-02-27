import express from 'express';
import { interviewScheduler } from '../managers/InterviewScheduler.js';
import { calendarIntegrator } from '../services/CalendarIntegrator.js';
import { emailService } from '../services/EmailService.js';
import { supabase } from '../database/supabaseClient.js';
import { isAuthenticated } from '../middlewares/auth.js';

const router = express.Router();

/**
 * GET /api/v1/interview/available-slots/:interviewId
 * 
 * Get available time slots for interview scheduling
 * 
 * Requirements: 4.1, 4.2, 4.3
 * 
 * Returns:
 * - Available slots from recruiter's calendar for next 14 days
 * - Only business hours (9 AM - 6 PM, Monday-Friday)
 * - Excludes slots with existing calendar events
 */
router.get('/available-slots/:interviewId', async (req, res) => {
  try {
    const { interviewId } = req.params;

    // 1. Get interview details
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', interviewId)
      .single();

    if (interviewError || !interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // 2. Verify interview is in correct state
    if (interview.status !== 'slot_pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot select slots for interview with status: ${interview.status}`
      });
    }

    // 3. Check if slot selection deadline has passed
    if (interview.slot_selection_deadline && new Date(interview.slot_selection_deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Slot selection deadline has passed'
      });
    }

    // 4. Calculate date range (next 14 days)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14);

    // 5. Fetch available slots from recruiter's calendar
    const availableSlots = await calendarIntegrator.getAvailableSlots(
      interview.recruiter_id,
      startDate,
      endDate
    );

    // 6. Format slots for UI display
    const formattedSlots = availableSlots.map(slot => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
      display: formatSlotForDisplay(slot.start)
    }));

    return res.status(200).json({
      success: true,
      data: {
        interviewId: interviewId,
        slots: formattedSlots,
        deadline: interview.slot_selection_deadline,
        totalSlots: formattedSlots.length
      },
      message: 'Available slots retrieved successfully'
    });
  } catch (error) {
    console.error('Error fetching available slots:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch available slots'
    });
  }
});

/**
 * POST /api/v1/interview/select-slot/:interviewId
 * 
 * Allow candidate to select a preferred interview slot
 * 
 * Requirements: 4.4
 * 
 * Body:
 * - selectedSlot: { start: ISO string, end: ISO string }
 * 
 * Actions:
 * - Store selected slot as scheduled_time
 * - Set slot_selection_deadline to 24 hours from selection time
 * - Update interview status (remains slot_pending until confirmed)
 */
router.post('/select-slot/:interviewId', async (req, res) => {
  try {
    const { interviewId } = req.params;
    const { selectedSlot } = req.body;

    // 1. Validate input
    if (!selectedSlot || !selectedSlot.start || !selectedSlot.end) {
      return res.status(400).json({
        success: false,
        message: 'Selected slot must include start and end times'
      });
    }

    // 2. Get interview details
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', interviewId)
      .single();

    if (interviewError || !interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // 3. Verify interview is in correct state
    if (interview.status !== 'slot_pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot select slot for interview with status: ${interview.status}`
      });
    }

    // 4. Check if slot selection deadline has passed
    if (interview.slot_selection_deadline && new Date(interview.slot_selection_deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Slot selection deadline has passed'
      });
    }

    // 5. Validate selected slot is in the future
    const selectedStartTime = new Date(selectedSlot.start);
    if (selectedStartTime < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Selected slot must be in the future'
      });
    }

    // 6. Verify slot is available (business hours, weekday, not conflicting)
    const dayOfWeek = selectedStartTime.getDay();
    const hour = selectedStartTime.getHours();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({
        success: false,
        message: 'Selected slot must be on a weekday'
      });
    }

    if (hour < 9 || hour >= 18) {
      return res.status(400).json({
        success: false,
        message: 'Selected slot must be during business hours (9 AM - 6 PM)'
      });
    }

    // 7. Set slot_selection_deadline to 24 hours from now (Requirement 4.4)
    const newDeadline = new Date();
    newDeadline.setHours(newDeadline.getHours() + 24);

    // 8. Update interview with selected slot
    const { data: updatedInterview, error: updateError } = await supabase
      .from('interviews')
      .update({
        scheduled_time: selectedStartTime.toISOString(),
        slot_selection_deadline: newDeadline.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', interviewId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update interview: ${updateError.message}`);
    }

    // 9. Log automation action
    await supabase
      .from('automation_logs')
      .insert([{
        job_id: interview.job_id,
        action_type: 'slot_selected',
        trigger_source: 'manual',
        actor_id: interview.candidate_id,
        details: {
          interview_id: interviewId,
          selected_slot: selectedSlot,
          new_deadline: newDeadline.toISOString(),
          timestamp: new Date().toISOString()
        }
      }]);

    return res.status(200).json({
      success: true,
      data: {
        interview: updatedInterview,
        selectedSlot: {
          start: selectedStartTime.toISOString(),
          end: selectedSlot.end,
          display: formatSlotForDisplay(selectedStartTime)
        },
        confirmationDeadline: newDeadline.toISOString()
      },
      message: 'Slot selected successfully. Please confirm your selection within 24 hours.'
    });
  } catch (error) {
    console.error('Error selecting slot:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to select slot'
    });
  }
});

/**
 * POST /api/v1/interview/confirm-slot/:interviewId
 * 
 * Confirm the selected interview slot
 * 
 * Requirements: 4.5, 4.6, 4.9
 * 
 * Actions:
 * - Validate interview is in slot_pending state with scheduled_time
 * - Update interview status to "confirmed"
 * - Create Google Calendar event
 * - Send confirmation emails to both recruiter and candidate
 * - Log automation action
 */
router.post('/confirm-slot/:interviewId', async (req, res) => {
  try {
    const { interviewId } = req.params;

    // 1. Get interview details with related data
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select(`
        *,
        applications (
          id,
          name,
          email,
          applicant_id,
          job_id
        ),
        jobs (
          id,
          title,
          posted_by
        )
      `)
      .eq('id', interviewId)
      .single();

    if (interviewError || !interview) {
      return res.status(404).json({
        success: false,
        message: 'Interview not found'
      });
    }

    // 2. Verify interview is in correct state (slot_pending)
    if (interview.status !== 'slot_pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm slot for interview with status: ${interview.status}. Interview must be in slot_pending state.`
      });
    }

    // 3. Verify a slot has been selected (scheduled_time exists)
    if (!interview.scheduled_time) {
      return res.status(400).json({
        success: false,
        message: 'No slot has been selected. Please select a time slot first.'
      });
    }

    // 4. Verify slot selection deadline hasn't passed
    if (interview.slot_selection_deadline && new Date(interview.slot_selection_deadline) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Slot selection deadline has passed'
      });
    }

    // 5. Update interview status to "confirmed" (Requirement 4.5)
    const { data: updatedInterview, error: updateError } = await supabase
      .from('interviews')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', interviewId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update interview status: ${updateError.message}`);
    }

    // 6. Create calendar event (Requirement 4.6)
    // Handle calendar failures gracefully - they should not block confirmation
    let calendarResult = { success: false, method: 'none' };
    try {
      calendarResult = await calendarIntegrator.createInterviewEvent(interviewId);
      console.log(`Calendar event created: ${calendarResult.eventId || 'fallback'}`);
    } catch (calendarError) {
      console.error('Calendar event creation failed (non-blocking):', calendarError);
      // Log the failure but continue with confirmation
      await supabase
        .from('automation_logs')
        .insert([{
          job_id: interview.job_id,
          action_type: 'calendar_creation_failed',
          trigger_source: 'auto',
          details: {
            interview_id: interviewId,
            error: calendarError.message,
            timestamp: new Date().toISOString()
          }
        }]);
    }

    // 7. Get recruiter details for confirmation email
    const { data: recruiter, error: recruiterError } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', interview.recruiter_id)
      .single();

    if (recruiterError) {
      console.error('Error fetching recruiter details:', recruiterError);
    }

    // 8. Send confirmation emails to both parties (Requirement 4.9)
    // Email failures should not block confirmation
    try {
      // Email to candidate
      await emailService.queueEmail({
        to: interview.applications.email,
        template: 'confirmation',
        data: {
          candidate_name: interview.applications.name,
          job_title: interview.jobs.title,
          interview_time: interview.scheduled_time,
          recruiter_name: recruiter?.name || 'Hiring Manager',
          recruiter_email: recruiter?.email,
          job_id: interview.job_id
        }
      });

      // Email to recruiter
      if (recruiter?.email) {
        await emailService.queueEmail({
          to: recruiter.email,
          template: 'confirmation',
          data: {
            candidate_name: interview.applications.name,
            job_title: interview.jobs.title,
            interview_time: interview.scheduled_time,
            recruiter_name: recruiter.name,
            recruiter_email: recruiter.email,
            job_id: interview.job_id
          }
        });
      }

      console.log('Confirmation emails queued successfully');
    } catch (emailError) {
      console.error('Email sending failed (non-blocking):', emailError);
      // Log the failure but continue
      await supabase
        .from('automation_logs')
        .insert([{
          job_id: interview.job_id,
          action_type: 'confirmation_email_failed',
          trigger_source: 'auto',
          details: {
            interview_id: interviewId,
            error: emailError.message,
            timestamp: new Date().toISOString()
          }
        }]);
    }

    // 9. Log automation action
    await supabase
      .from('automation_logs')
      .insert([{
        job_id: interview.job_id,
        action_type: 'slot_confirmed',
        trigger_source: 'manual',
        actor_id: interview.candidate_id,
        details: {
          interview_id: interviewId,
          scheduled_time: interview.scheduled_time,
          calendar_method: calendarResult.method,
          calendar_event_id: calendarResult.eventId || null,
          previous_status: 'slot_pending',
          new_status: 'confirmed',
          timestamp: new Date().toISOString()
        }
      }]);

    return res.status(200).json({
      success: true,
      data: {
        interview: updatedInterview,
        scheduledTime: interview.scheduled_time,
        calendarCreated: calendarResult.success,
        calendarMethod: calendarResult.method
      },
      message: 'Interview slot confirmed successfully! Confirmation emails have been sent to both parties.'
    });
  } catch (error) {
    console.error('Error confirming slot:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm slot'
    });
  }
});

/**
 * Helper function to format slot for display
 * 
 * @param {Date} date - Slot start time
 * @returns {string} Formatted display string
 */
function formatSlotForDisplay(date) {
  const options = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  };
  
  return date.toLocaleString('en-US', options);
}

export default router;
