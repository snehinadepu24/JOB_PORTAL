# Requirements Document

## Introduction

This document specifies requirements for integrating Google Gemini LLM into the NegotiationBot to enhance natural language understanding and response generation during interview slot negotiation conversations with candidates. The current implementation uses basic regex pattern matching which limits the bot's ability to understand natural language variations and provide contextually appropriate responses.

## Glossary

- **NegotiationBot**: The conversational system that negotiates interview time slots with candidates via chat
- **Gemini_LLM**: Google's Gemini large language model API service
- **Gemini_Client**: The service wrapper that interfaces with the Gemini LLM API
- **Availability_Parser**: The component that extracts structured availability data from candidate messages
- **Response_Generator**: The component that generates natural language responses to candidates
- **Candidate_Message**: Natural language text input from a candidate describing their availability
- **Structured_Availability**: Parsed data containing start_date, end_date, preferred_hours, and preferred_days
- **Negotiation_Session**: A conversation thread between the bot and candidate for a specific interview
- **Escalation**: The process of transferring negotiation to a human recruiter when automated negotiation fails

## Requirements

### Requirement 1: Gemini API Configuration

**User Story:** As a system administrator, I want to configure Gemini API credentials, so that the NegotiationBot can authenticate with Google's Gemini service.

#### Acceptance Criteria

1. THE System SHALL support a GEMINI_API_KEY environment variable in config.env
2. WHEN the NegotiationBot initializes, THE Gemini_Client SHALL validate the API key is present
3. IF the GEMINI_API_KEY is missing or empty, THEN THE Gemini_Client SHALL throw a configuration error
4. THE Gemini_Client SHALL support a configurable model name parameter with default value "gemini-1.5-flash"
5. WHERE rate limiting is enabled, THE Gemini_Client SHALL respect API rate limits and implement exponential backoff

### Requirement 2: Natural Language Availability Parsing

**User Story:** As a candidate, I want to describe my availability in natural language, so that I don't have to follow rigid formatting rules.

#### Acceptance Criteria

1. WHEN a Candidate_Message is received, THE Availability_Parser SHALL send it to Gemini_LLM for extraction
2. THE Availability_Parser SHALL provide Gemini_LLM with a structured prompt requesting JSON output containing start_date, end_date, preferred_hours, and preferred_days
3. WHEN Gemini_LLM returns parsed data, THE Availability_Parser SHALL validate the JSON structure
4. THE Availability_Parser SHALL convert date strings from Gemini_LLM into JavaScript Date objects
5. IF Gemini_LLM cannot extract availability information, THEN THE Availability_Parser SHALL return null
6. THE Availability_Parser SHALL handle relative time expressions including "next week", "this week", "tomorrow", "next Monday", and "in two weeks"
7. THE Availability_Parser SHALL handle time-of-day expressions including "morning", "afternoon", "evening", "9am-5pm", and "2:30 PM"
8. THE Availability_Parser SHALL handle date formats including "12/15", "December 15", "Dec 15th", and "15th of December"
9. FOR ALL valid Candidate_Messages containing availability, parsing then formatting then parsing SHALL produce equivalent Structured_Availability (round-trip property)

### Requirement 3: Contextual Response Generation

**User Story:** As a candidate, I want to receive natural and conversational responses from the bot, so that the interaction feels more human-like.

#### Acceptance Criteria

1. WHEN the NegotiationBot needs to generate a response, THE Response_Generator SHALL provide Gemini_LLM with conversation context including history and current state
2. THE Response_Generator SHALL include the Negotiation_Session history in the prompt to Gemini_LLM
3. WHEN suggesting available slots, THE Response_Generator SHALL provide slot data to Gemini_LLM and request a natural language presentation
4. WHEN no matching slots are found, THE Response_Generator SHALL request Gemini_LLM to generate an empathetic request for alternative times
5. WHEN escalating to a recruiter, THE Response_Generator SHALL request Gemini_LLM to generate a professional handoff message
6. THE Response_Generator SHALL limit generated responses to 200 words maximum
7. THE Response_Generator SHALL instruct Gemini_LLM to maintain a professional yet friendly tone
8. THE Response_Generator SHALL include the round number and maximum rounds in the context when requesting alternative times

### Requirement 4: Fallback to Pattern Matching

**User Story:** As a system operator, I want the bot to continue functioning if Gemini API is unavailable, so that service remains available during outages.

#### Acceptance Criteria

1. WHEN Gemini_LLM API call fails, THE Availability_Parser SHALL fall back to the existing regex-based parseAvailability method
2. WHEN Gemini_LLM API call fails, THE Response_Generator SHALL fall back to template-based response generation
3. IF Gemini_LLM returns an error response, THEN THE System SHALL log the error with full context
4. THE System SHALL track Gemini_LLM failure rate as a metric
5. WHEN fallback mode is active, THE System SHALL log a warning indicating degraded functionality

### Requirement 5: Prompt Engineering and Safety

**User Story:** As a system administrator, I want LLM prompts to be well-designed and safe, so that the bot produces reliable and appropriate responses.

#### Acceptance Criteria

1. THE Availability_Parser SHALL include explicit instructions in the prompt to return only JSON without additional commentary
2. THE Response_Generator SHALL include explicit instructions to avoid making commitments beyond the bot's authority
3. THE Response_Generator SHALL instruct Gemini_LLM to never share candidate contact information or personal details
4. THE Response_Generator SHALL instruct Gemini_LLM to decline requests unrelated to interview scheduling
5. THE System SHALL sanitize Candidate_Messages before sending to Gemini_LLM by removing potential prompt injection attempts
6. THE System SHALL validate Gemini_LLM responses before using them in the application
7. IF Gemini_LLM response contains inappropriate content, THEN THE System SHALL use fallback response and log the incident

### Requirement 6: Performance and Caching

**User Story:** As a system operator, I want LLM integration to be performant, so that candidates experience minimal latency.

#### Acceptance Criteria

1. THE Gemini_Client SHALL set a timeout of 10 seconds for API calls
2. IF Gemini_LLM does not respond within the timeout, THEN THE System SHALL fall back to pattern matching
3. THE System SHALL log the response time for each Gemini_LLM API call
4. WHERE similar Candidate_Messages are received within 5 minutes, THE System SHALL consider caching parsed availability
5. THE System SHALL track average Gemini_LLM response time as a metric

### Requirement 7: Testing and Validation

**User Story:** As a developer, I want comprehensive tests for LLM integration, so that I can verify correct behavior and catch regressions.

#### Acceptance Criteria

1. THE System SHALL include unit tests for Gemini_Client initialization and configuration
2. THE System SHALL include unit tests for Availability_Parser with mocked Gemini_LLM responses
3. THE System SHALL include unit tests for Response_Generator with mocked Gemini_LLM responses
4. THE System SHALL include integration tests verifying fallback behavior when Gemini_LLM is unavailable
5. THE System SHALL include tests verifying prompt injection protection
6. THE System SHALL include property tests verifying that parsed availability contains valid date ranges
7. THE System SHALL include property tests verifying that generated responses do not exceed length limits

### Requirement 8: Monitoring and Observability

**User Story:** As a system operator, I want visibility into LLM usage and performance, so that I can monitor costs and identify issues.

#### Acceptance Criteria

1. THE System SHALL log each Gemini_LLM API call with request type, token count, and response time
2. THE System SHALL track total Gemini_LLM API calls per day as a metric
3. THE System SHALL track Gemini_LLM success rate as a metric
4. THE System SHALL track Gemini_LLM fallback activation count as a metric
5. WHEN Gemini_LLM returns an error, THE System SHALL log the error code and message
6. THE System SHALL include Gemini_LLM metrics in the automation logging system

### Requirement 9: Gradual Rollout Support

**User Story:** As a product manager, I want to gradually roll out LLM features, so that I can validate improvements before full deployment.

#### Acceptance Criteria

1. WHERE feature flags are enabled, THE System SHALL support a GEMINI_ENABLED feature flag
2. WHEN GEMINI_ENABLED is false, THE System SHALL use only pattern matching and template responses
3. WHERE A/B testing is configured, THE System SHALL support percentage-based rollout of Gemini features
4. THE System SHALL log which parsing method was used (Gemini or pattern matching) for each negotiation session
5. THE System SHALL track negotiation success rate separately for Gemini-enabled and pattern-matching-only sessions
