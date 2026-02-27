import express from 'express';
import { calendarIntegrator } from '../services/CalendarIntegrator.js';
import { isAuthenticatedUser } from '../middlewares/auth.js';
import catchAsyncError from '../middlewares/catchAsyncError.js';
import { supabase } from '../database/supabaseClient.js';

const router = express.Router();

/**
 * Calendar Routes
 * 
 * Handles Google Calendar OAuth flow and calendar operations
 * 
 * Requirements: 6.1, 6.9
 */

/**
 * Initiate OAuth flow
 * 
 * GET /api/calendar/auth/initiate
 * 
 * Requirements: 6.1
 */
router.get('/auth/initiate', isAuthenticatedUser, catchAsyncError(async (req, res) => {
  try {
    const recruiterId = req.user.id;
    const authUrl = calendarIntegrator.getAuthUrl(recruiterId);

    res.status(200).json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * Handle OAuth callback
 * 
 * GET /api/calendar/auth/callback?code=...&state=...
 * 
 * Requirements: 6.1, 6.9
 */
router.get('/auth/callback', catchAsyncError(async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing authorization code or state'
      });
    }

    const recruiterId = state; // State contains recruiter ID
    const result = await calendarIntegrator.handleOAuthCallback(code, recruiterId);

    // Redirect to success page or dashboard
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/calendar/success`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/calendar/error?message=${encodeURIComponent(error.message)}`);
  }
}));

/**
 * Check calendar connection status
 * 
 * GET /api/calendar/status
 * 
 * Requirements: 6.1
 */
router.get('/status', isAuthenticatedUser, catchAsyncError(async (req, res) => {
  try {
    const recruiterId = req.user.id;
    const isConnected = await calendarIntegrator.isCalendarConnected(recruiterId);

    res.status(200).json({
      success: true,
      connected: isConnected
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * Get available time slots
 * 
 * GET /api/calendar/available-slots?startDate=...&endDate=...
 * 
 * Requirements: 4.1, 4.2, 4.3, 6.2
 */
router.get('/available-slots', isAuthenticatedUser, catchAsyncError(async (req, res) => {
  try {
    const recruiterId = req.user.id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing startDate or endDate parameters'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format'
      });
    }

    const slots = await calendarIntegrator.getAvailableSlots(recruiterId, start, end);

    res.status(200).json({
      success: true,
      slots: slots,
      count: slots.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * Disconnect calendar
 * 
 * DELETE /api/calendar/disconnect
 * 
 * Requirements: 6.1
 */
router.delete('/disconnect', isAuthenticatedUser, catchAsyncError(async (req, res) => {
  try {
    const recruiterId = req.user.id;

    // Delete calendar tokens from database
    const { error } = await supabase
      .from('calendar_tokens')
      .delete()
      .eq('user_id', recruiterId);

    if (error) {
      throw new Error(`Failed to disconnect calendar: ${error.message}`);
    }

    res.status(200).json({
      success: true,
      message: 'Calendar disconnected successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * Get circuit breaker status (admin only)
 * 
 * GET /api/calendar/circuit-breaker/status
 * 
 * Requirements: 13.6, 13.7
 */
router.get('/circuit-breaker/status', isAuthenticatedUser, catchAsyncError(async (req, res) => {
  try {
    const state = calendarIntegrator.circuitBreaker.getState();

    res.status(200).json({
      success: true,
      state: state,
      failureCount: calendarIntegrator.circuitBreaker.failureCount,
      threshold: calendarIntegrator.circuitBreaker.threshold
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

/**
 * Reset circuit breaker (admin only)
 * 
 * POST /api/calendar/circuit-breaker/reset
 * 
 * Requirements: 13.7
 */
router.post('/circuit-breaker/reset', isAuthenticatedUser, catchAsyncError(async (req, res) => {
  try {
    calendarIntegrator.circuitBreaker.reset();

    res.status(200).json({
      success: true,
      message: 'Circuit breaker reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}));

export default router;
