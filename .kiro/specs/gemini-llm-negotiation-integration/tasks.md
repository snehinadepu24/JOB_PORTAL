# Implementation Plan: Gemini LLM Negotiation Integration

## Overview

This implementation integrates Google's Gemini LLM into the NegotiationBot to enhance natural language understanding and response generation. The integration maintains backward compatibility through fallback mechanisms and uses feature flags for gradual rollout.

## Tasks

- [ ] 1. Set up Gemini API configuration and client infrastructure
  - [x] 1.1 Install @google/generative-ai npm package
    - Add package to backend/package.json
    - Run npm install
    - _Requirements: 1.1_
  
  - [~] 1.2 Add Gemini environment variables to config.env
    - Add GEMINI_API_KEY, GEMINI_MODEL_NAME, GEMINI_TIMEOUT_MS
    - Document configuration in backend/config/README.md (if exists)
    - _Requirements: 1.1, 1.4_
  
  - [~] 1.3 Create GeminiClient service class
    - Implement constructor with API key validation
    - Initialize Google Generative AI client
    - Set up timeout and retry configuration
    - _Requirements: 1.2, 1.3, 6.1_
  
  - [ ]* 1.4 Write unit tests for GeminiClient initialization
    - Test successful initialization with valid API key
    - Test error thrown when API key is missing
    - Test configuration parameter handling
    - _Requirements: 7.1_

- [ ] 2. Implement availability parsing with Gemini
  - [~] 2.1 Create extractAvailability method in GeminiClient
    - Build availability extraction prompt with date context
    - Call Gemini API with JSON response format
    - Parse and validate JSON response
    - Return structured availability or null on error
    - _Requirements: 2.1, 2.2, 2.3, 5.1_
  
  - [~] 2.2 Implement input sanitization for prompt injection protection
    - Create sanitizeMessage function to remove injection patterns
    - Apply sanitization before sending to Gemini
    - Log sanitization events
    - _Requirements: 5.5_
  
  - [~] 2.3 Implement response validation for availability data
    - Create validateAvailabilityResponse function
    - Validate date formats and ranges
    - Validate preferred_hours and preferred_days
    - Return null for invalid responses
    - _Requirements: 2.4, 5.6_
  
  - [~] 2.4 Enhance NegotiationBot.parseAvailability with Gemini integration
    - Check feature flag for Gemini parsing
    - Call GeminiClient.extractAvailability
    - Implement fallback to existing regex parsing on error
    - Log which parsing method was used
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 2.8, 4.1, 9.4_
  
  - [~] 2.5 Rename existing parseAvailability to parseAvailabilityRegex
    - Preserve existing regex-based logic as fallback
    - Ensure no functionality changes
    - _Requirements: 4.1_
  
  - [ ]* 2.6 Write unit tests for availability parsing
    - Test Gemini parsing with mocked API responses
    - Test fallback to regex on API failure
    - Test input sanitization
    - Test response validation
    - _Requirements: 7.2, 7.5_
  
  - [ ]* 2.7 Write property test for availability parsing
    - **Property 1: Round-trip consistency**
    - **Validates: Requirements 2.9**
    - Test that parsing then formatting then parsing produces equivalent results
    - _Requirements: 7.6_

- [~] 3. Checkpoint - Verify availability parsing works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement response generation with Gemini
  - [~] 4.1 Create generateResponse method in GeminiClient
    - Accept context object with history, state, slots, round info
    - Build appropriate prompt based on response type
    - Call Gemini API with higher temperature for natural variation
    - Return generated text or null on error
    - _Requirements: 3.1, 3.2, 3.8_
  
  - [~] 4.2 Implement prompt templates for different response types
    - Create SLOT_SUGGESTION_PROMPT template
    - Create REQUEST_ALTERNATIVES_PROMPT template
    - Create ESCALATION_PROMPT template
    - Create CLARIFICATION_PROMPT template
    - Include safety instructions in all prompts
    - _Requirements: 3.3, 3.4, 3.5, 3.7, 5.2, 5.3, 5.4_
  
  - [~] 4.3 Implement response validation for generated text
    - Create validateResponse function
    - Check word count limit (200 words max)
    - Check for inappropriate content patterns
    - Return false for invalid responses
    - _Requirements: 3.6, 5.7_
  
  - [~] 4.4 Enhance NegotiationBot with generateResponse method
    - Check feature flag for Gemini responses
    - Call GeminiClient.generateResponse with context
    - Validate generated response
    - Implement fallback to existing template responses
    - Log which generation method was used
    - _Requirements: 3.1, 4.2, 9.4_
  
  - [~] 4.5 Refactor existing response generation into generateTemplateResponse
    - Extract template-based logic from processMessage
    - Preserve existing response formats as fallback
    - Ensure no functionality changes
    - _Requirements: 4.2_
  
  - [~] 4.6 Integrate generateResponse into NegotiationBot.processMessage
    - Replace inline response generation with generateResponse calls
    - Pass appropriate context for each response type
    - Handle slot suggestions, alternative requests, escalations, clarifications
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [ ]* 4.7 Write unit tests for response generation
    - Test response generation with mocked Gemini API
    - Test fallback to templates on API failure
    - Test response validation
    - Test different response types
    - _Requirements: 7.3, 7.4_
  
  - [ ]* 4.8 Write property test for response length limits
    - **Property 2: Response length constraint**
    - **Validates: Requirements 3.6, 7.7**
    - Test that all generated responses stay within 200 word limit
    - _Requirements: 7.7_

- [~] 5. Checkpoint - Verify response generation works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement error handling and fallback mechanisms
  - [~] 6.1 Add timeout handling to GeminiClient
    - Implement Promise.race with timeout
    - Return null on timeout to trigger fallback
    - Log timeout events
    - _Requirements: 6.2_
  
  - [~] 6.2 Add rate limiting to GeminiClient
    - Create RateLimiter class for client-side rate limiting
    - Implement exponential backoff for rate limit errors
    - Track rate limit hits in metrics
    - _Requirements: 1.5_
  
  - [~] 6.3 Implement comprehensive error logging
    - Log all API errors with error codes and context
    - Log fallback activations with reason
    - Log validation failures
    - Include session and interview IDs in logs
    - _Requirements: 4.3, 4.5, 8.5_
  
  - [ ]* 6.4 Write integration tests for fallback behavior
    - Test fallback when Gemini API is unavailable
    - Test fallback on timeout
    - Test fallback on validation failure
    - Verify regex/template responses work correctly
    - _Requirements: 7.4_

- [ ] 7. Implement feature flags for gradual rollout
  - [~] 7.1 Add Gemini feature flags to feature flags system
    - Add gemini_enabled master flag
    - Add gemini_parsing flag
    - Add gemini_responses flag
    - Configure percentage-based rollout support
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [~] 7.2 Integrate feature flag checks in NegotiationBot
    - Check flags before calling Gemini methods
    - Use existing isFeatureEnabled utility
    - Ensure graceful degradation when flags are off
    - _Requirements: 9.1, 9.2_
  
  - [ ]* 7.3 Write tests for feature flag integration
    - Test behavior with flags enabled
    - Test behavior with flags disabled
    - Test percentage-based rollout
    - _Requirements: 9.2_

- [ ] 8. Implement monitoring and metrics collection
  - [~] 8.1 Add Gemini metrics tracking to GeminiClient
    - Track API calls (total, success, failure)
    - Track response times
    - Track parsing vs response generation calls
    - Track fallback activations
    - Implement getMetrics method
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [~] 8.2 Integrate with automation logging system
    - Log Gemini API calls to automationLogger
    - Include call type, success status, response time
    - Include session and interview context
    - Log model name and token counts if available
    - _Requirements: 8.1, 8.6_
  
  - [~] 8.3 Add Gemini metrics to metricsCollector
    - Expose Gemini metrics through metrics API
    - Track daily API call counts
    - Track success rates
    - Track average response times
    - _Requirements: 8.2, 8.3_
  
  - [~] 8.4 Enhance negotiation session history with metadata
    - Add metadata field to history entries
    - Track which generation method was used (gemini/template)
    - Track model name and response time
    - Preserve existing history format
    - _Requirements: 9.4_
  
  - [~] 8.5 Implement business metrics tracking
    - Track negotiation success rate for Gemini-enabled sessions
    - Track negotiation success rate for regex-only sessions
    - Enable A/B testing comparison
    - _Requirements: 9.5_

- [~] 9. Checkpoint - Verify monitoring and metrics work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement security measures
  - [~] 10.1 Implement API key security checks
    - Validate API key format on initialization
    - Never log API key values
    - Add warnings for insecure key storage
    - _Requirements: 1.2, 1.3_
  
  - [~] 10.2 Enhance prompt injection protection
    - Strengthen sanitizeMessage function
    - Add detection for role-playing attempts
    - Add detection for instruction override attempts
    - Limit message length to prevent overflow
    - _Requirements: 5.5_
  
  - [~] 10.3 Implement PII protection in prompts
    - Ensure no email addresses in prompts
    - Ensure no phone numbers in prompts
    - Use candidate IDs instead of names where possible
    - _Requirements: 5.3_
  
  - [ ]* 10.4 Write security tests for prompt injection
    - Test sanitization of injection patterns
    - Test handling of malicious inputs
    - Test PII filtering
    - _Requirements: 7.5_

- [ ] 11. Integration and final wiring
  - [~] 11.1 Wire GeminiClient into NegotiationBot constructor
    - Initialize GeminiClient with configuration
    - Handle missing API key gracefully (disable Gemini features)
    - Pass GeminiClient instance to NegotiationBot
    - _Requirements: 1.2, 1.3_
  
  - [~] 11.2 Update NegotiationBot initialization in application
    - Import and configure GeminiClient
    - Pass GeminiClient to NegotiationBot constructor
    - Handle configuration errors
    - _Requirements: 1.1, 1.2_
  
  - [~] 11.3 Add configuration documentation
    - Document GEMINI_API_KEY setup
    - Document feature flag configuration
    - Document rollout strategy
    - Add troubleshooting guide
    - _Requirements: 1.1, 9.1_
  
  - [ ]* 11.4 Write end-to-end integration tests
    - Test complete negotiation flow with Gemini enabled
    - Test complete negotiation flow with Gemini disabled
    - Test fallback scenarios
    - Test feature flag toggling
    - _Requirements: 7.4_

- [~] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation uses JavaScript as specified in the design document
- GeminiClient is designed as a standalone service for reusability
- All Gemini features have fallback to existing regex/template logic
- Feature flags enable safe gradual rollout and A/B testing
