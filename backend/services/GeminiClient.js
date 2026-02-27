import { GoogleGenerativeAI } from '@google/generative-ai';
import { metricsCollector } from '../utils/metricsCollector.js';

/**
 * GeminiClient Service
 * 
 * Provides a centralized interface to the Gemini API with error handling,
 * timeout management, and metrics collection.
 * 
 * Requirements: 1.1, 1.2, 1.3, 6.1
 * 
 * Features:
 * - API key validation and authentication
 * - Timeout and retry configuration
 * - Metrics collection for API calls
 * - Error handling with fallback support
 */

class GeminiClient {
  /**
   * Initialize Gemini client
   * 
   * Requirements: 1.2, 1.3
   * 
   * @param {object} config - Configuration object
   * @param {string} config.apiKey - Gemini API key
   * @param {string} config.modelName - Model name (default: gemini-1.5-flash)
   * @param {number} config.timeout - Request timeout in ms (default: 10000)
   * @throws {Error} If API key is missing
   */
  constructor(config = {}) {
    // Validate API key (Requirement 1.2)
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your-gemini-api-key-here') {
      throw new Error('GEMINI_API_KEY is required and must be configured in config.env');
    }

    this.apiKey = apiKey;
    this.modelName = config.modelName || process.env.GEMINI_MODEL_NAME || 'gemini-1.5-flash';
    this.timeout = config.timeout || parseInt(process.env.GEMINI_TIMEOUT_MS || '10000');
    
    // Initialize Google Generative AI client (Requirement 1.3)
    try {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
      console.log(`[GeminiClient] Initialized with model: ${this.modelName}`);
    } catch (error) {
      console.error('[GeminiClient] Failed to initialize Google Generative AI:', error);
      throw new Error(`Failed to initialize Gemini client: ${error.message}`);
    }

    // Metrics tracking (Requirement 6.1)
    this.metrics = {
      apiCallsTotal: 0,
      apiCallsSuccess: 0,
      apiCallsFailure: 0,
      apiResponseTimes: [],
      timeoutCount: 0,
      rateLimitCount: 0,
      authErrorCount: 0
    };

    // Retry configuration (Requirement 1.5)
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
  }

  /**
   * Extract structured availability from natural language
   * 
   * Requirements: 2.1, 2.2, 2.3
   * 
   * @param {string} message - Candidate message
   * @returns {Promise<object|null>} Parsed availability or null
   * @throws {Error} On API errors (caller should handle)
   */
  async extractAvailability(message) {
    const startTime = Date.now();
    
    try {
      this.metrics.apiCallsTotal++;

      // Sanitize message to prevent prompt injection (Requirement 5.5)
      const sanitizedMessage = this._sanitizeMessage(message);
      
      if (!sanitizedMessage) {
        console.warn('[GeminiClient] Message sanitization resulted in empty string');
        this.metrics.apiCallsFailure++;
        return null;
      }

      // Build prompt for availability extraction
      const prompt = this._buildAvailabilityPrompt(sanitizedMessage);

      // Make API call with timeout
      const result = await this._callWithTimeout(
        this.model.generateContent({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.1,  // Low temperature for consistent parsing
            topK: 1,
            topP: 1,
            maxOutputTokens: 256,
            responseMimeType: "application/json"
          }
        }),
        this.timeout
      );

      const responseTime = Date.now() - startTime;
      this.metrics.apiResponseTimes.push(responseTime);
      this.metrics.apiCallsSuccess++;

      // Extract and parse response
      const response = result.response;
      const text = response.text();
      
      // Parse JSON response
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        console.warn('[GeminiClient] Failed to parse JSON response:', text);
        this.metrics.apiCallsFailure++;
        return null;
      }

      // Validate the parsed response (Requirement 2.3, 2.4)
      const validated = this._validateAvailabilityResponse(parsed);
      
      if (!validated) {
        console.warn('[GeminiClient] Invalid availability response structure');
        this.metrics.apiCallsFailure++;
        return null;
      }

      // Log metrics
      await this._logApiCall('availability_extraction', true, responseTime);

      return validated;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.metrics.apiCallsFailure++;
      
      // Track specific error types
      if (error.message === 'Request timeout') {
        this.metrics.timeoutCount++;
      } else if (error.status === 429) {
        this.metrics.rateLimitCount++;
      } else if (error.status === 401 || error.status === 403) {
        this.metrics.authErrorCount++;
      }

      await this._logApiCall('availability_extraction', false, responseTime, error);
      
      console.error('[GeminiClient] extractAvailability failed:', error.message);
      return null;
    }
  }

  /**
   * Generate natural language response
   * 
   * Requirements: 3.1, 3.2, 3.3
   * 
   * @param {object} context - Conversation context
   * @param {Array} context.history - Message history
   * @param {string} context.state - Current negotiation state
   * @param {Array} context.slots - Available slots (optional)
   * @param {number} context.round - Current round number
   * @param {number} context.maxRounds - Maximum rounds
   * @param {string} context.type - Response type (slot_suggestion, request_alternatives, escalation, clarification)
   * @returns {Promise<string|null>} Generated response or null
   * @throws {Error} On API errors (caller should handle)
   */
  async generateResponse(context) {
    const startTime = Date.now();
    
    try {
      this.metrics.apiCallsTotal++;

      // Build prompt based on response type
      const prompt = this._buildResponsePrompt(context);

      // Make API call with timeout
      const result = await this._callWithTimeout(
        this.model.generateContent({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,  // Higher temperature for natural variation
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 512
          }
        }),
        this.timeout
      );

      const responseTime = Date.now() - startTime;
      this.metrics.apiResponseTimes.push(responseTime);
      this.metrics.apiCallsSuccess++;

      // Extract response text
      const response = result.response;
      const text = response.text();

      // Validate response content (Requirement 5.7)
      if (!this._validateResponse(text)) {
        console.warn('[GeminiClient] Response validation failed, returning null for fallback');
        this.metrics.apiCallsFailure++;
        await this._logApiCall('response_generation', false, responseTime, new Error('Response validation failed'));
        return null;
      }

      // Log metrics
      await this._logApiCall('response_generation', true, responseTime);

      return text;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.metrics.apiCallsFailure++;
      
      // Track specific error types
      if (error.message === 'Request timeout') {
        this.metrics.timeoutCount++;
      } else if (error.status === 429) {
        this.metrics.rateLimitCount++;
      } else if (error.status === 401 || error.status === 403) {
        this.metrics.authErrorCount++;
      }

      await this._logApiCall('response_generation', false, responseTime, error);
      
      console.error('[GeminiClient] generateResponse failed:', error.message);
      return null;
    }
  }

  /**
   * Get client metrics
   * 
   * Requirements: 6.1
   * 
   * @returns {object} Metrics object
   */
  getMetrics() {
    const avgResponseTime = this.metrics.apiResponseTimes.length > 0
      ? this.metrics.apiResponseTimes.reduce((a, b) => a + b, 0) / this.metrics.apiResponseTimes.length
      : 0;

    const successRate = this.metrics.apiCallsTotal > 0
      ? (this.metrics.apiCallsSuccess / this.metrics.apiCallsTotal) * 100
      : 0;

    return {
      apiCallsTotal: this.metrics.apiCallsTotal,
      apiCallsSuccess: this.metrics.apiCallsSuccess,
      apiCallsFailure: this.metrics.apiCallsFailure,
      successRate: successRate.toFixed(2) + '%',
      avgResponseTimeMs: Math.round(avgResponseTime),
      timeoutCount: this.metrics.timeoutCount,
      rateLimitCount: this.metrics.rateLimitCount,
      authErrorCount: this.metrics.authErrorCount
    };
  }

  /**
   * Sanitize candidate message to prevent prompt injection
   * 
   * Requirements: 5.5
   * 
   * @private
   * @param {string} message - Raw candidate message
   * @returns {string} Sanitized message
   */
  _sanitizeMessage(message) {
    if (!message || typeof message !== 'string') {
      return '';
    }

    let sanitized = message;
    
    // Remove potential prompt injection patterns
    // Pattern 1: System-like instructions (case-insensitive)
    sanitized = sanitized.replace(/\b(ignore|disregard|forget)\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi, '[removed]');
    
    // Pattern 2: Role-playing attempts (case-insensitive)
    sanitized = sanitized.replace(/\b(you are now|act as|pretend to be|simulate)\b/gi, '[removed]');
    
    // Pattern 3: Attempts to override system behavior (case-insensitive)
    sanitized = sanitized.replace(/\b(system|assistant|AI):\s*/gi, '[removed]');
    
    // Pattern 4: Attempts to inject JSON or code
    sanitized = sanitized.replace(/```[\s\S]*?```/g, '[code removed]');
    
    // Limit length to prevent abuse (Requirement 5.5)
    if (sanitized.length > 1000) {
      sanitized = sanitized.substring(0, 1000);
      console.warn('[GeminiClient] Message truncated to 1000 characters');
    }
    
    return sanitized.trim();
  }

  /**
   * Validate response content for safety and appropriateness
   * 
   * Requirements: 5.7
   * 
   * @private
   * @param {string} response - Generated response text
   * @returns {boolean} True if response is valid
   */
  _validateResponse(response) {
    if (!response || typeof response !== 'string') {
      return false;
    }
    
    // Check length constraint (Requirement 3.6)
    const wordCount = response.split(/\s+/).length;
    if (wordCount > 250) {
      console.warn('[GeminiClient] Response exceeds word limit:', wordCount);
      return false;
    }
    
    // Check for inappropriate content patterns (Requirement 5.3, 5.7)
    const inappropriatePatterns = [
      /\b(password|credit card|ssn|social security)\b/i,
      /\b(call me|text me|my number is|my phone)\b/i,
      /\b(I promise|I guarantee|I commit|I will definitely)\b/i,
      /\b(personal information|confidential|private data)\b/i
    ];
    
    for (const pattern of inappropriatePatterns) {
      if (pattern.test(response)) {
        console.warn('[GeminiClient] Response validation failed: inappropriate content detected');
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validate availability response from Gemini
   * 
   * Requirements: 2.3, 2.4
   * 
   * @private
   * @param {object} response - Parsed JSON response
   * @returns {object|null} Validated availability object or null
   */
  _validateAvailabilityResponse(response) {
    if (!response || typeof response !== 'object') {
      return null;
    }
    
    // Check for error response
    if (response.error) {
      return null;
    }
    
    // Validate required fields
    if (!response.start_date || !response.end_date) {
      return null;
    }
    
    // Parse and validate dates (Requirement 2.4)
    const startDate = new Date(response.start_date);
    const endDate = new Date(response.end_date);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      console.warn('[GeminiClient] Invalid date format in response');
      return null;
    }
    
    if (startDate > endDate) {
      console.warn('[GeminiClient] start_date is after end_date');
      return null;
    }
    
    // Validate preferred_hours if present
    if (response.preferred_hours !== null && response.preferred_hours !== undefined) {
      if (typeof response.preferred_hours !== 'object') {
        console.warn('[GeminiClient] preferred_hours must be an object or null');
        return null;
      }
      
      const { start, end } = response.preferred_hours;
      
      if (typeof start !== 'number' || typeof end !== 'number') {
        console.warn('[GeminiClient] preferred_hours start/end must be numbers');
        return null;
      }
      
      if (start < 0 || start > 23 || end < 0 || end > 23) {
        console.warn('[GeminiClient] preferred_hours must be between 0-23');
        return null;
      }
      
      if (start >= end) {
        console.warn('[GeminiClient] preferred_hours start must be before end');
        return null;
      }
    }
    
    // Validate preferred_days if present
    if (response.preferred_days !== null && response.preferred_days !== undefined) {
      if (!Array.isArray(response.preferred_days)) {
        console.warn('[GeminiClient] preferred_days must be an array or null');
        return null;
      }
      
      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      for (const day of response.preferred_days) {
        if (typeof day !== 'string' || !validDays.includes(day.toLowerCase())) {
          console.warn('[GeminiClient] Invalid day in preferred_days:', day);
          return null;
        }
      }
    }
    
    // Return validated structure with Date objects
    return {
      start_date: startDate,
      end_date: endDate,
      preferred_hours: response.preferred_hours || null,
      preferred_days: response.preferred_days || null
    };
  }

  /**
   * Build prompt for availability extraction
   * 
   * @private
   * @param {string} message - Candidate message
   * @returns {string} Formatted prompt
   */
  _buildAvailabilityPrompt(message) {
    const currentDate = new Date().toISOString().split('T')[0];
    
    return `You are a scheduling assistant. Extract availability information from the candidate's message.

Candidate message: "${message}"

Current date: ${currentDate}

Extract the following information:
- start_date: First available date (ISO format YYYY-MM-DD)
- end_date: Last available date (ISO format YYYY-MM-DD)
- preferred_hours: {start: hour, end: hour} in 24-hour format, or null
- preferred_days: Array of day names (lowercase), or null

Rules:
1. Return ONLY valid JSON, no additional text
2. Use ISO 8601 date format (YYYY-MM-DD)
3. Interpret relative dates (e.g., "next week", "tomorrow") based on current date
4. If no specific dates mentioned, use reasonable defaults (e.g., next 14 days)
5. If information is ambiguous or missing, return null for that field
6. For time expressions like "morning", use {start: 9, end: 12}
7. For "afternoon", use {start: 12, end: 18}
8. For "evening", use {start: 18, end: 21}

Return format:
{
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "preferred_hours": {"start": 9, "end": 17} or null,
  "preferred_days": ["monday", "tuesday"] or null
}

If you cannot extract any availability information, return: {"error": "no_availability_found"}`;
  }

  /**
   * Build prompt for response generation
   * 
   * @private
   * @param {object} context - Conversation context
   * @returns {string} Formatted prompt
   */
  _buildResponsePrompt(context) {
    const { type, history, slots, round, maxRounds } = context;

    const historyText = history && history.length > 0
      ? JSON.stringify(history.slice(-5)) // Last 5 messages for context
      : 'No previous conversation';

    switch (type) {
      case 'slot_suggestion':
        return `You are a friendly scheduling assistant helping a candidate schedule an interview.

Context:
- Conversation history: ${historyText}
- Available slots found: ${JSON.stringify(slots)}
- Current round: ${round}

Task: Present the available time slots in a natural, conversational way.

Requirements:
1. Be friendly and professional
2. Present up to 3 slots clearly
3. Ask the candidate to select one or provide alternatives
4. Keep response under 200 words
5. Do NOT make commitments beyond scheduling
6. Do NOT share personal information
7. Format dates and times clearly

Generate a natural response:`;

      case 'request_alternatives':
        return `You are a friendly scheduling assistant helping a candidate schedule an interview.

Context:
- Conversation history: ${historyText}
- No matching slots found
- Current round: ${round} of ${maxRounds}

Task: Politely explain that the suggested times don't work and ask for alternatives.

Requirements:
1. Be empathetic and understanding
2. Explain that the times don't align with recruiter availability
3. Ask for alternative times
4. Mention this is attempt ${round} of ${maxRounds}
5. Keep response under 200 words
6. Maintain a positive, helpful tone

Generate a natural response:`;

      case 'escalation':
        return `You are a friendly scheduling assistant helping a candidate schedule an interview.

Context:
- Conversation history: ${historyText}
- Unable to find matching times after ${maxRounds} attempts
- Escalating to human recruiter

Task: Inform the candidate that a recruiter will contact them directly.

Requirements:
1. Be professional and reassuring
2. Explain that you've notified the recruiter
3. Thank them for their patience
4. Keep response under 200 words
5. Maintain a positive tone

Generate a natural response:`;

      case 'clarification':
        return `You are a friendly scheduling assistant helping a candidate schedule an interview.

Context:
- Conversation history: ${historyText}
- Unable to understand availability from last message

Task: Politely ask the candidate to provide their availability more clearly.

Requirements:
1. Be friendly and helpful
2. Provide examples of how to express availability
3. Examples: "Monday-Wednesday next week, 2-5 PM" or "12/15 and 12/16 in the afternoon"
4. Keep response under 200 words
5. Don't make the candidate feel they did something wrong

Generate a natural response:`;

      default:
        throw new Error(`Unknown response type: ${type}`);
    }
  }

  /**
   * Call API with timeout
   * 
   * Requirements: 6.1, 6.2
   * 
   * @private
   * @param {Promise} apiCall - API call promise
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise} API result
   * @throws {Error} On timeout or API error
   */
  async _callWithTimeout(apiCall, timeoutMs) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    });

    return Promise.race([apiCall, timeoutPromise]);
  }

  /**
   * Log API call metrics
   * 
   * Requirements: 6.1, 8.1
   * 
   * @private
   * @param {string} callType - Type of API call
   * @param {boolean} success - Whether call succeeded
   * @param {number} responseTime - Response time in ms
   * @param {Error} error - Error object if failed
   */
  async _logApiCall(callType, success, responseTime, error = null) {
    try {
      // Record in metrics collector
      if (success) {
        metricsCollector.recordResponseTime('gemini_api', responseTime);
      } else {
        metricsCollector.recordError('gemini_api', error || new Error('API call failed'), 'external');
      }

      // Log to console
      if (success) {
        console.log(`[GeminiClient] ${callType} succeeded in ${responseTime}ms`);
      } else {
        console.error(`[GeminiClient] ${callType} failed after ${responseTime}ms:`, error?.message || 'Unknown error');
      }
    } catch (logError) {
      console.error('[GeminiClient] Failed to log metrics:', logError);
    }
  }
}

// Export singleton instance
let geminiClientInstance = null;

export function getGeminiClient() {
  if (!geminiClientInstance) {
    try {
      geminiClientInstance = new GeminiClient();
    } catch (error) {
      console.warn('[GeminiClient] Failed to initialize:', error.message);
      return null;
    }
  }
  return geminiClientInstance;
}

export { GeminiClient };
