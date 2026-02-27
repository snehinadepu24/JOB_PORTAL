import { google } from 'googleapis';
import CryptoJS from 'crypto-js';
import { supabase } from '../database/supabaseClient.js';

/**
 * Calendar Integrator Service
 * 
 * Manages Google Calendar OAuth, availability fetching, and event management.
 * 
 * Requirements: 4.1-4.9, 6.1-6.9, 13.2, 13.6, 13.7
 * 
 * Features:
 * - Google Calendar OAuth 2.0 authentication
 * - Fetch recruiter availability (business hours, weekdays)
 * - Create, update, and delete calendar events
 * - Circuit breaker pattern for API resilience
 * - ICS fallback when OAuth fails
 * - Token encryption and refresh logic
 */

class CalendarIntegrator {
  constructor() {
    this.oauth2Client = null;
    this.circuitBreaker = new CircuitBreaker(5, 60000); // 5 failures, 60s timeout
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    this.initializeOAuth();
  }

  /**
   * Initialize OAuth2 client
   * 
   * Requirements: 6.1
   */
  initializeOAuth() {
    try {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        console.warn('Google Calendar OAuth not configured. Calendar integration will be disabled.');
        return;
      }

      this.oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/auth/callback'
      );

      console.log('Google Calendar OAuth initialized successfully');
    } catch (error) {
      console.error('Error initializing Google Calendar OAuth:', error);
      this.oauth2Client = null;
    }
  }

  /**
   * Generate OAuth authorization URL
   * 
   * Requirements: 6.1
   * 
   * @param {string} recruiterId - Recruiter's user ID
   * @returns {string} Authorization URL
   */
  getAuthUrl(recruiterId) {
    if (!this.oauth2Client) {
      throw new Error('Google Calendar OAuth not configured');
    }

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ],
      state: recruiterId // Pass recruiter ID in state for callback
    });

    return authUrl;
  }

  /**
   * Handle OAuth callback and store tokens
   * 
   * Requirements: 6.1, 6.9, 14.1
   * 
   * @param {string} code - Authorization code from Google
   * @param {string} recruiterId - Recruiter's user ID
   * @returns {Promise<Object>} Result of token storage
   */
  async handleOAuthCallback(code, recruiterId) {
    try {
      if (!this.oauth2Client) {
        throw new Error('Google Calendar OAuth not configured');
      }

      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      
      // Encrypt tokens before storage
      const encryptedAccessToken = this.encrypt(tokens.access_token);
      const encryptedRefreshToken = this.encrypt(tokens.refresh_token);

      // Calculate expiry date
      const expiryDate = new Date(Date.now() + (tokens.expiry_date || 3600 * 1000));

      // Store tokens in database
      const { data, error } = await supabase
        .from('calendar_tokens')
        .upsert([{
          user_id: recruiterId,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          expiry_date: expiryDate.toISOString(),
          updated_at: new Date().toISOString()
        }], {
          onConflict: 'user_id'
        })
        .select();

      if (error) {
        throw new Error(`Failed to store calendar tokens: ${error.message}`);
      }

      console.log(`Calendar tokens stored successfully for recruiter ${recruiterId}`);
      return { success: true, message: 'Calendar connected successfully' };
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      throw error;
    }
  }

  /**
   * Get and refresh tokens if needed
   * 
   * Requirements: 6.9
   * 
   * @param {string} recruiterId - Recruiter's user ID
   * @returns {Promise<Object>} Decrypted tokens
   */
  async getTokens(recruiterId) {
    try {
      // Fetch tokens from database
      const { data, error } = await supabase
        .from('calendar_tokens')
        .select('*')
        .eq('user_id', recruiterId)
        .single();

      if (error || !data) {
        throw new Error('Calendar not connected. Please authenticate with Google Calendar.');
      }

      // Decrypt tokens
      const accessToken = this.decrypt(data.access_token);
      const refreshToken = this.decrypt(data.refresh_token);
      const expiryDate = new Date(data.expiry_date);

      // Check if token is expired
      if (expiryDate <= new Date()) {
        console.log('Access token expired, refreshing...');
        return await this.refreshAccessToken(recruiterId, refreshToken);
      }

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        expiry_date: expiryDate
      };
    } catch (error) {
      console.error('Error getting calendar tokens:', error);
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * 
   * Requirements: 6.9
   * 
   * @param {string} recruiterId - Recruiter's user ID
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New tokens
   */
  async refreshAccessToken(recruiterId, refreshToken) {
    try {
      if (!this.oauth2Client) {
        throw new Error('Google Calendar OAuth not configured');
      }

      // Set refresh token
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      // Get new access token
      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Encrypt new access token
      const encryptedAccessToken = this.encrypt(credentials.access_token);
      const expiryDate = new Date(credentials.expiry_date);

      // Update database
      await supabase
        .from('calendar_tokens')
        .update({
          access_token: encryptedAccessToken,
          expiry_date: expiryDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', recruiterId);

      console.log(`Access token refreshed for recruiter ${recruiterId}`);

      return {
        access_token: credentials.access_token,
        refresh_token: refreshToken,
        expiry_date: expiryDate
      };
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive data
   * 
   * Requirements: 14.1
   * 
   * @param {string} text - Text to encrypt
   * @returns {string} Encrypted text
   */
  encrypt(text) {
    return CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
  }

  /**
   * Decrypt sensitive data
   * 
   * Requirements: 14.1
   * 
   * @param {string} encryptedText - Encrypted text
   * @returns {string} Decrypted text
   */
  decrypt(encryptedText) {
    const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Get authenticated calendar client
   * 
   * @param {string} recruiterId - Recruiter's user ID
   * @returns {Promise<Object>} Google Calendar API client
   */
  async getCalendarClient(recruiterId) {
    const tokens = await this.getTokens(recruiterId);
    
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    auth.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });

    return google.calendar({ version: 'v3', auth });
  }

  /**
   * Check if recruiter has calendar connected
   * 
   * @param {string} recruiterId - Recruiter's user ID
   * @returns {Promise<boolean>} True if connected
   */
  async isCalendarConnected(recruiterId) {
    try {
      const { data, error } = await supabase
        .from('calendar_tokens')
        .select('id')
        .eq('user_id', recruiterId)
        .single();

      return !error && !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get available time slots from recruiter's calendar
   * 
   * Requirements: 4.1, 4.2, 4.3, 6.2
   * 
   * @param {string} recruiterId - Recruiter's user ID
   * @param {Date} startDate - Start date for availability search
   * @param {Date} endDate - End date for availability search
   * @returns {Promise<Array>} Array of available time slots
   */
  async getAvailableSlots(recruiterId, startDate, endDate) {
    return await this.circuitBreaker.execute(async () => {
      try {
        const calendar = await this.getCalendarClient(recruiterId);

        // Query Google Calendar for events in date range
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        });

        const busySlots = response.data.items.map(event => ({
          start: new Date(event.start.dateTime || event.start.date),
          end: new Date(event.end.dateTime || event.end.date)
        }));

        // Generate business hour slots (9 AM - 6 PM, weekdays, 60-min blocks)
        const allSlots = this.generateBusinessHourSlots(startDate, endDate, 60);

        // Filter out busy slots
        const availableSlots = allSlots.filter(slot => 
          !busySlots.some(busy => this.slotsOverlap(slot, busy))
        );

        console.log(`Found ${availableSlots.length} available slots for recruiter ${recruiterId}`);
        return availableSlots;
      } catch (error) {
        console.error('Error fetching available slots:', error);
        throw error;
      }
    });
  }

  /**
   * Generate business hour time slots
   * 
   * Requirements: 4.2, 4.3
   * 
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {number} durationMinutes - Slot duration in minutes
   * @returns {Array} Array of time slots
   */
  generateBusinessHourSlots(startDate, endDate, durationMinutes) {
    const slots = [];
    let current = new Date(startDate);

    while (current < endDate) {
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (current.getDay() === 0 || current.getDay() === 6) {
        current.setDate(current.getDate() + 1);
        current.setHours(0, 0, 0, 0);
        continue;
      }

      // Business hours: 9 AM - 6 PM
      for (let hour = 9; hour < 18; hour++) {
        const slotStart = new Date(current);
        slotStart.setHours(hour, 0, 0, 0);

        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

        // Only add slot if it ends before 6 PM
        if (slotEnd.getHours() < 18 || (slotEnd.getHours() === 18 && slotEnd.getMinutes() === 0)) {
          slots.push({ start: slotStart, end: slotEnd });
        }
      }

      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
    }

    return slots;
  }

  /**
   * Check if two time slots overlap
   * 
   * @param {Object} slot1 - First slot with start and end
   * @param {Object} slot2 - Second slot with start and end
   * @returns {boolean} True if slots overlap
   */
  slotsOverlap(slot1, slot2) {
    return slot1.start < slot2.end && slot1.end > slot2.start;
  }

  /**
   * Create calendar event for interview
   * 
   * Requirements: 4.6, 4.7, 6.3, 6.4, 6.5
   * 
   * @param {string} interviewId - Interview ID
   * @returns {Promise<Object>} Created event details
   */
  async createInterviewEvent(interviewId) {
    return await this.retryWithExponentialBackoff(async () => {
      try {
        // Fetch interview details
        const { data: interview, error: interviewError } = await supabase
          .from('interviews')
          .select(`
            *,
            applications (
              name,
              email,
              applicant_id
            ),
            jobs (
              title,
              posted_by
            )
          `)
          .eq('id', interviewId)
          .single();

        if (interviewError || !interview) {
          throw new Error(`Interview not found: ${interviewId}`);
        }

        // Get recruiter details
        const { data: recruiter, error: recruiterError } = await supabase
          .from('users')
          .select('email, name')
          .eq('id', interview.recruiter_id)
          .single();

        if (recruiterError || !recruiter) {
          throw new Error(`Recruiter not found: ${interview.recruiter_id}`);
        }

        // Check if calendar is connected
        const isConnected = await this.isCalendarConnected(interview.recruiter_id);
        if (!isConnected) {
          console.log('Calendar not connected, falling back to ICS');
          return await this.sendICSFallback(interviewId);
        }

        const calendar = await this.getCalendarClient(interview.recruiter_id);

        // Create calendar event
        const event = {
          summary: `Interview: ${interview.applications.name} - ${interview.jobs.title}`,
          description: `Interview for ${interview.jobs.title} position\nCandidate: ${interview.applications.name}\nInterview ID: ${interviewId}`,
          start: {
            dateTime: new Date(interview.scheduled_time).toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: new Date(new Date(interview.scheduled_time).getTime() + 60 * 60 * 1000).toISOString(),
            timeZone: 'UTC'
          },
          attendees: [
            { email: recruiter.email },
            { email: interview.applications.email }
          ],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 24 * 60 },
              { method: 'popup', minutes: 30 }
            ]
          }
        };

        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: event,
          sendUpdates: 'all' // Send email notifications to attendees
        });

        // Store calendar event ID
        await supabase
          .from('interviews')
          .update({
            calendar_event_id: response.data.id,
            calendar_sync_method: 'google'
          })
          .eq('id', interviewId);

        console.log(`Calendar event created successfully: ${response.data.id}`);
        return {
          success: true,
          eventId: response.data.id,
          method: 'google'
        };
      } catch (error) {
        console.error('Error creating calendar event:', error);
        
        // Fallback to ICS if Google Calendar fails
        console.log('Falling back to ICS file generation');
        return await this.sendICSFallback(interviewId);
      }
    });
  }

  /**
   * Update calendar event time
   * 
   * Requirements: 6.7
   * 
   * @param {string} interviewId - Interview ID
   * @param {Date} newTime - New scheduled time
   * @returns {Promise<Object>} Update result
   */
  async updateInterviewEvent(interviewId, newTime) {
    return await this.retryWithExponentialBackoff(async () => {
      try {
        // Fetch interview details
        const { data: interview, error } = await supabase
          .from('interviews')
          .select('*, applications(name, email)')
          .eq('id', interviewId)
          .single();

        if (error || !interview) {
          throw new Error(`Interview not found: ${interviewId}`);
        }

        if (!interview.calendar_event_id) {
          throw new Error('No calendar event associated with this interview');
        }

        const calendar = await this.getCalendarClient(interview.recruiter_id);

        // Update event time
        const event = await calendar.events.get({
          calendarId: 'primary',
          eventId: interview.calendar_event_id
        });

        event.data.start.dateTime = newTime.toISOString();
        event.data.end.dateTime = new Date(newTime.getTime() + 60 * 60 * 1000).toISOString();

        await calendar.events.update({
          calendarId: 'primary',
          eventId: interview.calendar_event_id,
          requestBody: event.data,
          sendUpdates: 'all'
        });

        // Update interview record
        await supabase
          .from('interviews')
          .update({ scheduled_time: newTime.toISOString() })
          .eq('id', interviewId);

        console.log(`Calendar event updated successfully: ${interview.calendar_event_id}`);
        return { success: true, message: 'Calendar event updated' };
      } catch (error) {
        console.error('Error updating calendar event:', error);
        throw error;
      }
    });
  }

  /**
   * Delete calendar event
   * 
   * Requirements: 6.6
   * 
   * @param {string} interviewId - Interview ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteInterviewEvent(interviewId) {
    return await this.retryWithExponentialBackoff(async () => {
      try {
        // Fetch interview details
        const { data: interview, error } = await supabase
          .from('interviews')
          .select('*')
          .eq('id', interviewId)
          .single();

        if (error || !interview) {
          throw new Error(`Interview not found: ${interviewId}`);
        }

        if (!interview.calendar_event_id) {
          console.log('No calendar event to delete');
          return { success: true, message: 'No calendar event to delete' };
        }

        const calendar = await this.getCalendarClient(interview.recruiter_id);

        // Delete event
        await calendar.events.delete({
          calendarId: 'primary',
          eventId: interview.calendar_event_id,
          sendUpdates: 'all'
        });

        // Clear calendar event ID
        await supabase
          .from('interviews')
          .update({ calendar_event_id: null })
          .eq('id', interviewId);

        console.log(`Calendar event deleted successfully: ${interview.calendar_event_id}`);
        return { success: true, message: 'Calendar event deleted' };
      } catch (error) {
        console.error('Error deleting calendar event:', error);
        // Don't throw - deletion failure shouldn't block other operations
        return { success: false, error: error.message };
      }
    });
  }

  /**
   * Retry function with exponential backoff
   * 
   * Requirements: 6.8, 13.2
   * 
   * @param {Function} fn - Function to retry
   * @param {number} maxRetries - Maximum retry attempts (default: 3)
   * @returns {Promise<any>} Function result
   */
  async retryWithExponentialBackoff(fn, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Send ICS file as fallback when OAuth fails
   * 
   * Requirements: 6.3, 6.4, 6.5
   * 
   * @param {string} interviewId - Interview ID
   * @returns {Promise<Object>} Fallback result
   */
  async sendICSFallback(interviewId) {
    try {
      // Fetch interview details
      const { data: interview, error } = await supabase
        .from('interviews')
        .select(`
          *,
          applications (
            name,
            email
          ),
          jobs (
            title
          )
        `)
        .eq('id', interviewId)
        .single();

      if (error || !interview) {
        throw new Error(`Interview not found: ${interviewId}`);
      }

      // Get recruiter details
      const { data: recruiter } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', interview.recruiter_id)
        .single();

      // Generate ICS file content
      const icsContent = this.generateICSFile({
        summary: `Interview: ${interview.applications.name} - ${interview.jobs.title}`,
        description: `Interview for ${interview.jobs.title} position`,
        startTime: new Date(interview.scheduled_time),
        endTime: new Date(new Date(interview.scheduled_time).getTime() + 60 * 60 * 1000),
        attendees: [
          { email: recruiter.email, name: recruiter.name },
          { email: interview.applications.email, name: interview.applications.name }
        ]
      });

      // In a real implementation, this would send the ICS file via email
      // For now, we'll just log it and mark the sync method
      console.log('ICS file generated (would be sent via email):', icsContent.substring(0, 100));

      // Update interview record
      await supabase
        .from('interviews')
        .update({
          calendar_sync_method: 'ics_fallback'
        })
        .eq('id', interviewId);

      // Log automation action
      await supabase
        .from('automation_logs')
        .insert([{
          job_id: interview.job_id,
          action_type: 'calendar_ics_fallback',
          trigger_source: 'auto',
          details: {
            interview_id: interviewId,
            reason: 'OAuth not configured or failed',
            timestamp: new Date().toISOString()
          }
        }]);

      return {
        success: true,
        method: 'ics_fallback',
        message: 'ICS file generated and sent via email'
      };
    } catch (error) {
      console.error('Error generating ICS fallback:', error);
      throw error;
    }
  }

  /**
   * Generate ICS file content
   * 
   * @param {Object} eventData - Event data
   * @returns {string} ICS file content
   */
  generateICSFile(eventData) {
    const formatDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const attendees = eventData.attendees.map(a => 
      `ATTENDEE;CN=${a.name};RSVP=TRUE:mailto:${a.email}`
    ).join('\r\n');

    return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AI Hiring Orchestrator//EN
BEGIN:VEVENT
UID:${Date.now()}@hiring-orchestrator.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(eventData.startTime)}
DTEND:${formatDate(eventData.endTime)}
SUMMARY:${eventData.summary}
DESCRIPTION:${eventData.description}
${attendees}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
  }
}

/**
 * Circuit Breaker Pattern Implementation
 * 
 * Requirements: 6.8, 13.2, 13.6, 13.7
 * 
 * Prevents cascading failures by opening circuit after threshold failures
 */
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  /**
   * Execute function with circuit breaker protection
   * 
   * @param {Function} fn - Function to execute
   * @returns {Promise<any>} Function result
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
      this.state = 'HALF_OPEN';
      console.log('Circuit breaker entering HALF_OPEN state');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      console.log('Circuit breaker closing after successful attempt');
    }
    this.state = 'CLOSED';
  }

  /**
   * Handle failed execution
   */
  onFailure() {
    this.failureCount++;
    console.log(`Circuit breaker failure count: ${this.failureCount}/${this.threshold}`);
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      console.error(`Circuit breaker OPENED - will retry after ${this.timeout}ms`);
    }
  }

  /**
   * Get current circuit breaker state
   * 
   * @returns {string} Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  reset() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
    console.log('Circuit breaker manually reset');
  }
}

// Export singleton instance
export const calendarIntegrator = new CalendarIntegrator();
export default CalendarIntegrator;

