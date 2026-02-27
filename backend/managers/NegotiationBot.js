/**
 * NegotiationBot - Handles conversational slot negotiation when candidates have conflicts
 * 
 * Features:
 * - Session management with conversation history
 * - Availability parsing from candidate messages
 * - Slot matching against recruiter calendar
 * - Escalation after 3 rounds without resolution
 * - Feature flag support for automation control
 * 
 * Requirements: 5.1, 5.6, 12.8, 12.9
 */

import { supabase } from '../database/supabaseClient.js';
import { isFeatureEnabled } from '../utils/featureFlags.js';
import { automationLogger } from '../utils/automationLogger.js';
import { v4 as uuidv4 } from 'uuid';
import { getGeminiClient } from '../services/GeminiClient.js';

class NegotiationBot {
  constructor(calendarIntegrator, emailService, geminiClient = null) {
    this.calendarIntegrator = calendarIntegrator;
    this.emailService = emailService;
    this.geminiClient = geminiClient || getGeminiClient();
    this.MAX_ROUNDS = 3;
  }

  /**
   * Start a new negotiation session
   * 
   * Requirements: 12.8, 12.9
   * 
   * @param {string} interviewId - Interview UUID
   * @param {string} candidateMessage - Initial message from candidate
   * @returns {Promise<{sessionId: string, response: string}>}
   */
  async startNegotiation(interviewId, candidateMessage) {
    // Verify interview exists
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', interviewId)
      .single();

    if (interviewError || !interview) {
      throw new Error(`Interview not found: ${interviewId}`);
    }

    // Check if negotiation bot is enabled
    if (!await isFeatureEnabled('negotiation_bot', interview.job_id)) {
      console.log(`[NegotiationBot] Negotiation bot disabled for job ${interview.job_id}`);
      return {
        sessionId: null,
        response: 'Automated negotiation is not available for this position. Please contact the recruiter directly to discuss alternative interview times.'
      };
    }

    // Create negotiation session
    const sessionId = uuidv4();
    const initialHistory = [
      {
        role: 'candidate',
        message: candidateMessage,
        timestamp: new Date().toISOString()
      }
    ];

    const { data: session, error: sessionError } = await supabase
      .from('negotiation_sessions')
      .insert({
        id: sessionId,
        interview_id: interviewId,
        round: 1,
        state: 'awaiting_availability',
        history: initialHistory
      })
      .select()
      .single();

    if (sessionError) {
      throw new Error(`Failed to create negotiation session: ${sessionError.message}`);
    }

    // Process the initial message
    const response = await this.processMessage(session, candidateMessage);

    return {
      sessionId: session.id,
      response
    };
  }

  /**
   * Process a message in an existing negotiation session
   * @param {object} session - Negotiation session object
   * @param {string} message - Candidate message
   * @returns {Promise<string>} Bot response
   */
  async processMessage(session, message) {
    // Add candidate message to history if not already added
    const history = Array.isArray(session.history) ? session.history : [];
    const lastMessage = history[history.length - 1];
    
    if (!lastMessage || lastMessage.message !== message) {
      history.push({
        role: 'candidate',
        message,
        timestamp: new Date().toISOString()
      });
    }

    // Parse candidate availability
    const availability = await this.parseAvailability(message);

    if (!availability) {
      const response = await this.generateResponse('clarification', { history });
      
      history.push({
        role: 'bot',
        message: response,
        timestamp: new Date().toISOString()
      });

      await this.updateSession(session.id, { history });

      return response;
    }

    // Get interview details
    const { data: interview } = await supabase
      .from('interviews')
      .select('*, applications(*), jobs(*)')
      .eq('id', session.interview_id)
      .single();

    if (!interview) {
      throw new Error(`Interview not found: ${session.interview_id}`);
    }

    // Check recruiter calendar for overlapping slots
    const availableSlots = await this.calendarIntegrator.getAvailableSlots(
      interview.recruiter_id,
      availability.start_date,
      availability.end_date
    );

    // Find matching slots based on candidate preferences
    const matchingSlots = this.findMatchingSlots(availableSlots, availability);

    if (matchingSlots.length > 0) {
      // Found matching slots - suggest up to 3
      const suggestions = matchingSlots.slice(0, 3);
      const response = await this.generateResponse('slot_suggestions', { 
        slots: suggestions, 
        history 
      });

      history.push({
        role: 'bot',
        message: response,
        timestamp: new Date().toISOString()
      });

      await this.updateSession(session.id, {
        state: 'awaiting_selection',
        history,
        suggested_slots: suggestions
      });

      return response;
    } else {
      // No matching slots found
      const newRound = session.round + 1;

      if (newRound > this.MAX_ROUNDS) {
        // Escalate to recruiter
        await this.escalateToRecruiter(session, interview, history);

        const response = await this.generateResponse('escalation', { 
          history,
          round: newRound,
          maxRounds: this.MAX_ROUNDS
        });

        history.push({
          role: 'bot',
          message: response,
          timestamp: new Date().toISOString()
        });

        await this.updateSession(session.id, {
          round: newRound,
          state: 'escalated',
          history
        });

        return response;
      }

      // Ask for alternative times
      const response = await this.generateResponse('request_alternatives', {
        round: newRound,
        maxRounds: this.MAX_ROUNDS,
        history
      });

      history.push({
        role: 'bot',
        message: response,
        timestamp: new Date().toISOString()
      });

      await this.updateSession(session.id, {
        round: newRound,
        history
      });

      return response;
    }
  }

  /**
   * Parse availability from candidate message with Gemini integration
   * 
   * Requirements: 2.1, 2.2, 4.1, 9.4
   * 
   * @param {string} message - Candidate message
   * @returns {Promise<object|null>} Parsed availability or null if not found
   */
  async parseAvailability(message) {
    // Check if Gemini parsing is enabled
    if (this.geminiClient && await isFeatureEnabled('gemini_parsing')) {
      try {
        console.log('[NegotiationBot] Attempting Gemini-powered availability parsing');
        const geminiResult = await this.geminiClient.extractAvailability(message);
        
        if (geminiResult) {
          console.log('[NegotiationBot] Successfully parsed availability using Gemini');
          return geminiResult;
        }
        
        console.log('[NegotiationBot] Gemini returned null, falling back to regex parsing');
      } catch (error) {
        console.error('[NegotiationBot] Gemini parsing failed, falling back to regex:', error.message);
      }
    } else {
      console.log('[NegotiationBot] Gemini parsing disabled or client unavailable, using regex');
    }
    
    // Fallback to regex-based parsing
    return this.parseAvailabilityRegex(message);
  }

  /**
   * Parse availability from candidate message using regex patterns
   * @param {string} message - Candidate message
   * @returns {object|null} Parsed availability or null if not found
   */
  parseAvailabilityRegex(message) {
    // Simple pattern matching for dates and times
    // In production, consider using NLP library like compromise.js or chrono-node
    
    // Check for day names
    const dayPattern = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi;
    const days = message.match(dayPattern);
    
    // Check for time patterns (e.g., "2-5 PM", "9am", "afternoon")
    const timePattern = /(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?/gi;
    const times = message.match(timePattern);
    
    // Check for date patterns (e.g., "12/15", "12-15", "December 15")
    const datePattern = /(\d{1,2})[\/\-](\d{1,2})/g;
    const dates = message.match(datePattern);
    
    // Check for relative time expressions
    const hasNextWeek = /next week/i.test(message);
    const hasThisWeek = /this week/i.test(message);
    const hasAfternoon = /afternoon/i.test(message);
    const hasMorning = /morning/i.test(message);
    
    // If we found some time-related information, construct availability
    if (days || dates || hasNextWeek || hasThisWeek) {
      const now = new Date();
      let startDate = new Date(now);
      let endDate = new Date(now);
      
      if (hasNextWeek) {
        // Next week: start from next Monday
        const currentDay = now.getDay();
        const daysUntilMonday = currentDay === 0 ? 1 : (8 - currentDay);
        startDate = new Date(now);
        startDate.setDate(now.getDate() + daysUntilMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6); // End of next week (Sunday)
      } else if (hasThisWeek) {
        // This week: today to end of week
        const daysUntilSunday = 7 - now.getDay();
        endDate = new Date(now);
        endDate.setDate(now.getDate() + daysUntilSunday);
      } else {
        // Default: next 14 days
        endDate = new Date(now);
        endDate.setDate(now.getDate() + 14);
      }
      
      // Parse preferred hours if mentioned
      let preferredHours = null;
      if (hasAfternoon) {
        preferredHours = { start: 12, end: 18 };
      } else if (hasMorning) {
        preferredHours = { start: 9, end: 12 };
      } else if (times && times.length > 0) {
        // Try to extract hour range from times
        preferredHours = this.parseTimeRange(times);
      }
      
      return {
        start_date: startDate,
        end_date: endDate,
        preferred_hours: preferredHours,
        preferred_days: days ? days.map(d => d.toLowerCase()) : null
      };
    }
    
    return null;
  }

  /**
   * Parse time range from time strings
   * @param {Array<string>} times - Array of time strings
   * @returns {object|null} Time range with start and end hours
   */
  parseTimeRange(times) {
    if (!times || times.length === 0) return null;
    
    const hours = [];
    for (const timeStr of times) {
      const match = timeStr.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?/i);
      if (match) {
        let hour = parseInt(match[1]);
        const isPM = match[3] && match[3].toLowerCase() === 'pm';
        
        if (isPM && hour < 12) hour += 12;
        if (!isPM && hour === 12) hour = 0;
        
        hours.push(hour);
      }
    }
    
    if (hours.length >= 2) {
      return {
        start: Math.min(...hours),
        end: Math.max(...hours)
      };
    } else if (hours.length === 1) {
      return {
        start: hours[0],
        end: hours[0] + 2 // Default 2-hour window
      };
    }
    
    return null;
  }

  /**
   * Find slots matching candidate availability
   * @param {Array} availableSlots - Recruiter's available slots
   * @param {object} availability - Parsed candidate availability
   * @returns {Array} Matching slots
   */
  findMatchingSlots(availableSlots, availability) {
    return availableSlots.filter(slot => {
      const slotDate = new Date(slot.start);
      
      // Check if slot is within date range
      if (slotDate < availability.start_date || slotDate > availability.end_date) {
        return false;
      }
      
      // Check preferred days if specified
      if (availability.preferred_days && availability.preferred_days.length > 0) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const slotDay = dayNames[slotDate.getDay()];
        if (!availability.preferred_days.includes(slotDay)) {
          return false;
        }
      }
      
      // Check preferred hours if specified
      if (availability.preferred_hours) {
        const slotHour = slotDate.getHours();
        if (slotHour < availability.preferred_hours.start || slotHour >= availability.preferred_hours.end) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Generate response with Gemini integration
   * 
   * Requirements: 3.1, 3.2, 3.3, 4.2, 9.4
   * 
   * @param {string} type - Response type: 'clarification', 'slot_suggestions', 'request_alternatives', 'escalation'
   * @param {object} context - Context for response generation
   * @param {Array} context.slots - Available slots (for slot_suggestions)
   * @param {number} context.round - Current round number (for request_alternatives)
   * @param {number} context.maxRounds - Maximum rounds (for request_alternatives)
   * @param {Array} context.history - Conversation history (optional)
   * @returns {Promise<string>} Generated response
   */
  async generateResponse(type, context = {}) {
    // Check if Gemini response generation is enabled
    if (this.geminiClient && await isFeatureEnabled('gemini_responses')) {
      try {
        console.log('[NegotiationBot] Attempting Gemini-powered response generation');
        
        // Prepare context for Gemini
        const geminiContext = {
          type: this._mapResponseType(type),
          history: context.history || [],
          slots: context.slots || null,
          round: context.round || 1,
          maxRounds: context.maxRounds || this.MAX_ROUNDS,
          state: context.state || 'active'
        };
        
        const geminiResponse = await this.geminiClient.generateResponse(geminiContext);
        
        if (geminiResponse && this._validateGeneratedResponse(geminiResponse)) {
          console.log('[NegotiationBot] Successfully generated response using Gemini');
          return geminiResponse;
        }
        
        console.log('[NegotiationBot] Gemini returned invalid response, falling back to template');
      } catch (error) {
        console.error('[NegotiationBot] Gemini response generation failed, falling back to template:', error.message);
      }
    } else {
      console.log('[NegotiationBot] Gemini response generation disabled or client unavailable, using template');
    }
    
    // Fallback to template-based response
    return this.generateTemplateResponse(type, context);
  }

  /**
   * Map internal response type to Gemini response type
   * @private
   * @param {string} type - Internal response type
   * @returns {string} Gemini response type
   */
  _mapResponseType(type) {
    const typeMap = {
      'slot_suggestions': 'slot_suggestion',
      'request_alternatives': 'request_alternatives',
      'escalation': 'escalation',
      'clarification': 'clarification'
    };
    
    return typeMap[type] || type;
  }

  /**
   * Validate generated response from Gemini
   * @private
   * @param {string} response - Generated response
   * @returns {boolean} True if valid
   */
  _validateGeneratedResponse(response) {
    if (!response || typeof response !== 'string') {
      return false;
    }
    
    // Check minimum length
    if (response.trim().length < 10) {
      console.warn('[NegotiationBot] Response too short');
      return false;
    }
    
    // Check maximum word count (allow some buffer beyond 200 words)
    const wordCount = response.split(/\s+/).length;
    if (wordCount > 250) {
      console.warn('[NegotiationBot] Response exceeds word limit:', wordCount);
      return false;
    }
    
    return true;
  }

  /**
   * Generate template-based response (fallback when Gemini is unavailable)
   * 
   * Requirements: 4.2
   * 
   * @param {string} type - Response type: 'clarification', 'slot_suggestions', 'request_alternatives', 'escalation'
   * @param {object} context - Context for response generation
   * @param {Array} context.slots - Available slots (for slot_suggestions)
   * @param {number} context.round - Current round number (for request_alternatives)
   * @param {number} context.maxRounds - Maximum rounds (for request_alternatives)
   * @returns {string} Generated response
   */
  generateTemplateResponse(type, context = {}) {
    switch (type) {
      case 'clarification':
        return "I'd be happy to help find a suitable time. Could you please provide your available dates and times? For example: 'I'm available Monday-Wednesday next week, 2-5 PM' or 'I'm free on 12/15 and 12/16 in the afternoon'.";

      case 'slot_suggestions':
        if (!context.slots || context.slots.length === 0) {
          throw new Error('Slots required for slot_suggestions response type');
        }
        return this.formatSlotSuggestions(context.slots);

      case 'request_alternatives':
        const round = context.round || 1;
        const maxRounds = context.maxRounds || this.MAX_ROUNDS;
        return `Unfortunately, those times don't align with the recruiter's availability. Could you provide some alternative times? (Attempt ${round} of ${maxRounds})`;

      case 'escalation':
        return "I haven't been able to find a matching time after several attempts. I've notified the recruiter, who will reach out to you directly to schedule the interview. Thank you for your patience!";

      default:
        throw new Error(`Unknown response type: ${type}`);
    }
  }

  /**
   * Format slot suggestions for candidate
   * @param {Array} slots - Available slots
   * @returns {string} Formatted message
   */
  formatSlotSuggestions(slots) {
    const formatted = slots.map((slot, i) => {
      const date = new Date(slot.start);
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
      const timeStr = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${i + 1}. ${dateStr} at ${timeStr}`;
    }).join('\n');

    return `Great! I found these available times:\n\n${formatted}\n\nPlease reply with the number of your preferred slot (e.g., "1" or "option 2"), or let me know if none of these work for you.`;
  }

  /**
   * Escalate negotiation to recruiter
   * @param {object} session - Negotiation session
   * @param {object} interview - Interview details
   * @param {Array} history - Conversation history
   */
  async escalateToRecruiter(session, interview, history) {
    // Get recruiter details
    const { data: recruiter } = await supabase
      .from('users')
      .select('*')
      .eq('id', interview.recruiter_id)
      .single();

    if (!recruiter) {
      console.error('Recruiter not found:', interview.recruiter_id);
      return;
    }

    // Format conversation history for email
    const conversationText = history
      .map(msg => `${msg.role.toUpperCase()}: ${msg.message}`)
      .join('\n\n');

    // Queue escalation email
    await this.emailService.queueEmail({
      to: recruiter.email,
      template: 'negotiation_escalation',
      data: {
        recruiter_name: recruiter.name,
        candidate_name: interview.applications.name,
        job_title: interview.jobs.title,
        conversation_history: conversationText,
        interview_id: interview.id,
        candidate_email: interview.applications.email
      }
    });

    // Log automation action
    await automationLogger.log({
      jobId: interview.job_id,
      actionType: 'negotiation_escalated',
      triggerSource: 'auto',
      actorId: null,
      details: {
        interview_id: interview.id,
        session_id: session.id,
        rounds: session.round,
        candidate_id: interview.candidate_id,
        reason: 'max_rounds_exceeded'
      }
    });
  }

  /**
   * Update negotiation session
   * @param {string} sessionId - Session UUID
   * @param {object} updates - Fields to update
   */
  async updateSession(sessionId, updates) {
    const { error } = await supabase
      .from('negotiation_sessions')
      .update(updates)
      .eq('id', sessionId);

    if (error) {
      throw new Error(`Failed to update session: ${error.message}`);
    }
  }

  /**
   * Get negotiation session by ID
   * @param {string} sessionId - Session UUID
   * @returns {Promise<object>} Session object
   */
  async getSession(sessionId) {
    const { data: session, error } = await supabase
      .from('negotiation_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error || !session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return session;
  }

  /**
   * Get negotiation session by interview ID
   * @param {string} interviewId - Interview UUID
   * @returns {Promise<object|null>} Session object or null
   */
  async getSessionByInterview(interviewId) {
    const { data: session, error } = await supabase
      .from('negotiation_sessions')
      .select('*')
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return session;
  }

  /**
   * Log automation action
   * @deprecated Use automationLogger.log() instead
   * @param {string} jobId - Job UUID
   * @param {string} actionType - Type of action
   * @param {object} details - Action details
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
}

export default NegotiationBot;
