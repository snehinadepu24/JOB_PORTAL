# Implementation Plan: AI Hiring Orchestrator

## Overview

This implementation plan transforms the existing job portal into a fully automated AI Hiring Orchestrator. The approach follows an incremental strategy, building on the existing resume ranking system and adding automation layers progressively. Each phase delivers working functionality that can be tested independently while maintaining backward compatibility with existing features.

**Implementation Strategy:**
- Phase 1: Database schema and core data models
- Phase 2: Enhanced resume intelligence and auto-shortlisting
- Phase 3: Interview scheduling and email notifications
- Phase 4: Calendar integration and slot management
- Phase 5: Background scheduler and automation engine
- Phase 6: Negotiation bot and risk analysis
- Phase 7: Dashboard, analytics, and observability

## Tasks

- [x] 1. Database Schema Migration and Setup
  - Create migration scripts for new tables and columns
  - Add feature flags, automation logs, interviews, negotiation sessions, calendar tokens tables
  - Add new columns to jobs and applications tables
  - Create all indexes for performance
  - Write rollback scripts for safe deployment
  - _Requirements: 10.1-10.12, 12.5-12.7_

- [x] 2. Enhanced Resume Intelligence Engine
  - [x] 2.1 Extend Python ResumeRanker with summary generation
    - Add `generate_summary()` method using extractive summarization
    - Implement summary storage in applications table
    - _Requirements: 1.3_
  
  - [x] 2.2 Write property test for resume processing round trip
    - **Property 1: Resume Processing Round Trip**
    - **Validates: Requirements 1.1, 1.5, 1.6**
  
  - [x] 2.3 Add automatic processing trigger on application submission
    - Modify application controller to call Python service on submit
    - Implement async processing with job queue
    - Store fit_score, summary, and set ai_processed flag
    - _Requirements: 1.1, 1.5, 1.6_
  
  - [x] 2.4 Write property test for feature extraction completeness
    - **Property 2: Feature Extraction Completeness**
    - **Validates: Requirements 1.2**
  
  - [x] 2.5 Write property test for fit score calculation
    - **Property 3: Fit Score Weighted Calculation**
    - **Validates: Requirements 1.4**
  
  - [x] 2.6 Write property test for error isolation
    - **Property 4: Resume Processing Error Isolation**
    - **Validates: Requirements 1.7, 13.1**

- [x] 3. Checkpoint - Verify resume processing works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Shortlisting Manager Implementation
  - [x] 4.1 Create ShortlistingManager class with core methods
    - Implement `autoShortlist(jobId)` with ranking trigger logic
    - Implement `promoteFromBuffer(jobId, vacatedRank)` with promotion rules
    - Implement `backfillBuffer(jobId)` for buffer maintenance
    - Implement `canPromote(jobId)` to check promotion eligibility
    - _Requirements: 2.3-2.6, 2.8-2.11_
  
  - [x] 4.2 Write property test for shortlist size invariant
    - **Property 6: Shortlist Size Invariant**
    - **Validates: Requirements 2.7**
  
  - [x] 4.3 Write property test for auto-shortlisting correctness
    - **Property 7: Auto-Shortlisting Correctness**
    - **Validates: Requirements 2.3, 2.4**
  
  - [x] 4.4 Write property test for buffer pool sizing
    - **Property 8: Buffer Pool Sizing**
    - **Validates: Requirements 2.5, 2.6**
  
  - [x] 4.5 Write property test for buffer promotion correctness
    - **Property 9: Buffer Promotion Correctness**
    - **Validates: Requirements 2.8, 2.9, 2.10**
  
  - [x] 4.6 Write property test for buffer health maintenance
    - **Property 10: Buffer Health Maintenance**
    - **Validates: Requirements 2.11, 8.5, 8.6**

- [x] 5. Interview Scheduler Core
  - [x] 5.1 Create Interview model and database operations
    - Implement CRUD operations for interviews table
    - Add status transition validation
    - _Requirements: 3.2, 3.3_
  
  - [x] 5.2 Implement interview invitation flow
    - Create `sendInvitation(applicationId)` method
    - Generate secure accept/reject tokens
    - Set confirmation_deadline to 48 hours
    - Create interview record with status="invitation_sent"
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 5.3 Implement accept/reject handlers
    - Create `handleAccept(interviewId, token)` endpoint
    - Create `handleReject(interviewId, token)` endpoint
    - Validate tokens and update interview status
    - Trigger buffer promotion on rejection
    - _Requirements: 3.5, 3.6_
  
  - [ ]* 5.4 Write property test for interview creation on shortlisting
    - **Property 12: Interview Creation on Shortlisting**
    - **Validates: Requirements 3.1, 3.2, 3.3**
  
  - [ ]* 5.5 Write property test for interview status transitions
    - **Property 13: Interview Status Transitions**
    - **Validates: Requirements 3.5, 3.6, 3.7, 3.8, 4.5, 4.8**

- [x] 6. Email Notification System
  - [x] 6.1 Set up email service with templates
    - Configure email provider (SendGrid, AWS SES, smtplib or similar)
    - Create email templates: invitation, slot_selection, confirmation, reminder, promotion
    - Implement email queue with retry logic
    - _Requirements: 11.1-11.8_
  
  - [x] 6.2 Implement invitation email sending
    - Create invitation email with accept/reject links
    - Include job details and interview process overview
    - Queue email with retry logic
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  
  - [ ]* 6.3 Write property test for invitation email format
    - **Property 32: Invitation Email Format**
    - **Validates: Requirements 11.1, 11.3, 11.4**
  
  - [ ]* 6.4 Write property test for email retry logic
    - **Property 34: Email Retry Logic**
    - **Validates: Requirements 11.10, 13.3**

- [x] 7. Checkpoint - Verify shortlisting and invitation flow
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Calendar Integration
  - [x] 8.1 Implement Google Calendar OAuth flow
    - Create OAuth initiation endpoint
    - Create OAuth callback handler
    - Store encrypted tokens in calendar_tokens table
    - Implement token refresh logic
    - _Requirements: 6.1, 6.9_
  
  - [x] 8.2 Implement calendar availability fetching
    - Create `getAvailableSlots(recruiterId, startDate, endDate)` method
    - Query Google Calendar API for events
    - Generate business hour slots (9 AM - 6 PM, weekdays)
    - Filter out busy slots
    - _Requirements: 4.1, 4.2, 4.3, 6.2_
  
  - [x] 8.3 Implement calendar event creation
    - Create `createInterviewEvent(interviewId)` method
    - Set event title, duration, attendees
    - Store calendar_event_id in interview record
    - Implement ICS fallback for OAuth failures
    - _Requirements: 4.6, 4.7, 6.3, 6.4, 6.5_
  
  - [x] 8.4 Implement calendar event lifecycle management
    - Create `updateInterviewEvent(interviewId, newTime)` method
    - Create `deleteInterviewEvent(interviewId)` method
    - _Requirements: 6.6, 6.7_
  
  - [x] 8.5 Implement circuit breaker for calendar API
    - Create CircuitBreaker class
    - Wrap all calendar API calls with circuit breaker
    - Implement retry logic with exponential backoff
    - _Requirements: 6.8, 13.2, 13.6, 13.7_
  
  - [x] 8.6 Write property test for calendar event creation
    - **Property 17: Calendar Event Creation**
    - **Validates: Requirements 4.6, 4.7, 6.3, 6.4, 6.5**
  
  - [x] 8.7 Write property test for calendar API retry logic
    - **Property 19: Calendar API Retry Logic**
    - **Validates: Requirements 6.8, 13.2**

- [x] 9. Slot Selection and Confirmation
  - [x] 9.1 Create slot selection UI endpoint
    - Display available slots from recruiter's calendar
    - Allow candidate to select preferred slot
    - Set slot_selection_deadline to 24 hours
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 9.2 Implement slot confirmation handler
    - Update interview status to "confirmed"
    - Store scheduled_time
    - Trigger calendar event creation
    - Send confirmation emails to both parties
    - _Requirements: 4.5, 4.6, 4.9_
  
  - [x] 9.3 Write property test for business hours slot filtering
    - **Property 16: Business Hours Slot Filtering**
    - **Validates: Requirements 4.2, 4.3**
  
  - [x] 9.4 Write property test for slot selection deadline
    - **Property 15: Slot Selection Deadline**
    - **Validates: Requirements 4.4**

- [x] 10. Background Scheduler Implementation
  - [x] 10.1 Create BackgroundScheduler class with cron setup
    - Set up cron job to run every 5 minutes
    - Implement `runCycle()` method with fault isolation
    - Implement cycle logging and metrics
    - _Requirements: 8.1, 8.10_
  
  - [x] 10.2 Implement confirmation deadline checker
    - Create `checkConfirmationDeadlines()` task
    - Find interviews with passed confirmation_deadline
    - Update status to "expired"
    - Trigger buffer promotion
    - _Requirements: 3.7, 3.8, 8.2, 8.3, 8.4_
  
  - [x] 10.3 Implement slot selection deadline checker
    - Create `checkSlotSelectionDeadlines()` task
    - Find interviews with passed slot_selection_deadline
    - Update status to "expired"
    - Trigger buffer promotion
    - _Requirements: 4.8, 8.2, 8.3, 8.4_
  
  - [x] 10.4 Implement buffer health checker
    - Create `checkBufferHealth()` task
    - Check buffer size for all active jobs
    - Backfill buffer when below target
    - _Requirements: 8.5, 8.6_
  
  - [x] 10.5 Implement interview reminder sender
    - Create `sendInterviewReminders()` task
    - Find interviews scheduled in 24 hours
    - Send reminder emails to both parties
    - _Requirements: 11.7_
  
  - [x] 10.6 Write property test for deadline-based expiration
    - **Property 14: Deadline-Based Expiration**
    - **Validates: Requirements 3.7, 3.8, 4.8, 8.2, 8.3, 8.4**
  
  - [x] 10.7 Write property test for fault isolation
    - **Property 29: Fault Isolation**
    - **Validates: Requirements 8.10, 13.5**
  
  - [x] 10.8 Write property test for automation logging
    - **Property 30: Automation Logging**
    - **Validates: Requirements 3.9, 8.7**

- [x] 11. Checkpoint - Verify automation engine works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. No-Show Risk Analyzer (Python Service)
  - [x] 12.1 Create NoShowRiskAnalyzer class
    - Implement `analyze_risk(interview_id, candidate_id)` method
    - Calculate response time risk factor
    - Calculate negotiation complexity risk factor
    - Calculate profile completeness risk factor
    - Calculate historical pattern risk factor
    - Compute weighted risk score
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [x] 12.2 Add risk analysis endpoint to Python service
    - Create `/analyze-risk` POST endpoint
    - Return risk score and categorization
    - _Requirements: 7.1, 7.2, 7.3, 7.8_
  
  - [x] 12.3 Integrate risk analysis into interview flow
    - Call risk analyzer when interview is confirmed
    - Store no_show_risk in interview record
    - Add risk update task to background scheduler
    - _Requirements: 7.1, 7.6_
  
  - [x] 12.4 Write property test for risk score range
    - **Property 24: Risk Score Range**
    - **Validates: Requirements 7.3**
  
  - [x] 12.5 Write property test for risk score factors
    - **Property 25: Risk Score Factors**
    - **Validates: Requirements 7.2**
  
  - [x] 12.6 Write property test for high risk flagging
    - **Property 26: High Risk Flagging**
    - **Validates: Requirements 7.4, 7.5**

- [ ] 13. Negotiation Bot Implementation
  - [x] 13.1 Create NegotiationBot class with session management
    - Implement `startNegotiation(interviewId, candidateMessage)` method
    - Implement `processMessage(session, message)` method
    - Create negotiation_sessions table operations
    - _Requirements: 5.1, 5.6_
  
  - [x] 13.2 Implement availability parsing
    - Create `parseAvailability(message)` method
    - Extract dates, times, and day ranges from text
    - Use simple pattern matching or NLP library
    - _Requirements: 5.2_
  
  - [x] 13.3 Implement slot matching and suggestions
    - Query recruiter calendar for overlapping slots
    - Generate up to 3 suggestions per round
    - Format suggestions for candidate
    - _Requirements: 5.2, 5.3_
  
  - [x] 13.4 Implement escalation logic
    - Track negotiation rounds
    - Escalate after 3 rounds without resolution
    - Send escalation email to recruiter with conversation history
    - _Requirements: 5.5, 5.7_
  
  - [x] 13.5 Write property test for negotiation slot matching
    - **Property 21: Negotiation Slot Matching**
    - **Validates: Requirements 5.2, 5.3, 5.5**
  
  - [x] 13.6 Write property test for negotiation round limit
    - **Property 22: Negotiation Round Limit**
    - **Validates: Requirements 5.6, 5.7**

- [ ] 14. Recruiter Dashboard and Analytics
  - [x] 14.1 Create dashboard API endpoints
    - Create endpoint to get ranked candidates for job
    - Create endpoint to get automation activity log
    - Create endpoint to get analytics metrics
    - _Requirements: 9.1, 9.2, 9.5, 9.7_
  
  - [x] 14.2 Implement candidate list with sorting and filtering
    - Sort candidates by fit_score (highest first)
    - Include all required fields: name, fit_score, no_show_risk, shortlist_status, interview_status
    - Highlight shortlisted candidates
    - Show buffer rank for buffer candidates
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [x] 14.3 Implement automation activity log display
    - Fetch recent automation logs for job
    - Display timestamp, action type, candidate name, outcome
    - Support pagination and filtering
    - _Requirements: 9.5, 9.6_
  
  - [x] 14.4 Implement analytics calculations
    - Calculate time saved (hours)
    - Calculate automation success rate (%)
    - Calculate average time-to-interview (days)
    - Calculate buffer health indicator
    - _Requirements: 9.7, 9.8, 9.9_
  
  - [x] 14.5 Write property test for candidate sorting
    - **Property 37: Candidate Sorting**
    - **Validates: Requirements 9.1**
  
  - [x] 14.6 Write property test for buffer health indicator
    - **Property 40: Buffer Health Indicator**
    - **Validates: Requirements 9.9**

- [ ] 15. Feature Flags and Observability
  - [x] 15.1 Implement feature flag system
    - Create feature_flags table operations
    - Implement `isFeatureEnabled(flagName, jobId)` function
    - Add feature flag checks to all automation code
    - _Requirements: 12.8, 12.9_
  
  - [x] 15.2 Implement comprehensive logging
    - Add automation logging to all automated actions
    - Include trigger_source, actor_id, and detailed context
    - Implement log querying utilities
    - _Requirements: 8.7, Observability section_
  
  - [x] 15.3 Implement metrics collection
    - Track system health metrics
    - Implement alert threshold checking
    - Create metrics dashboard endpoint
    - _Requirements: 15.10, Observability section_
  
  - [x] 15.4 Write unit tests for feature flag control
    - Test global flag enforcement
    - Test job-level flag overrides
    - Test automation bypass when disabled
    - _Requirements: 12.8, 12.9_

- [ ] 16. Security and Validation
  - [ ] 16.1 Implement token validation
    - Create secure token generation for interview actions
    - Implement token expiration (7 days)
    - Validate tokens on accept/reject endpoints
    - _Requirements: 14.3, 14.4_
  
  - [ ] 16.2 Implement input validation and sanitization
    - Add validation middleware for all API endpoints
    - Sanitize user inputs to prevent SQL injection and XSS
    - Return descriptive error messages for invalid inputs
    - _Requirements: 13.8, 14.7_
  
  - [ ] 16.3 Implement rate limiting
    - Add rate limiting middleware (100 requests/minute per user)
    - Return appropriate error responses when limit exceeded
    - _Requirements: 13.9_
  
  - [ ] 16.4 Write property test for token validation
    - **Property 48: Token Validation**
    - **Validates: Requirements 14.4**
  
  - [ ] 16.5 Write property test for input sanitization
    - **Property 50: Input Sanitization**
    - **Validates: Requirements 14.7**

- [ ] 17. Backward Compatibility and Migration
  - [ ] 17.1 Implement manual override functionality
    - Preserve existing manual accept/reject endpoints
    - Add bypass logic for manually accepted candidates
    - Update shortlist_status correctly for manual actions
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [ ] 17.2 Create data migration scripts
    - Write migration to add new columns with defaults
    - Set default values for existing records
    - Test migration on copy of production data
    - _Requirements: 12.5, 12.6, 12.7_
  
  - [ ] 17.3 Write unit tests for backward compatibility
    - Test existing API endpoints still work
    - Test manual override bypasses automation
    - Test feature flag disables automation correctly
    - _Requirements: 12.1-12.4, 12.8-12.9_

- [ ] 18. Integration Testing and End-to-End Flows
  - [ ] 18.1 Write integration test for complete hiring flow
    - Submit application → Resume processing → Auto-shortlist → Send invitation → Accept → Select slot → Confirm → Calendar event
    - _Requirements: All requirements_
  
  - [ ] 18.2 Write integration test for buffer promotion flow
    - Shortlist full → Candidate rejects → Buffer promotion → New invitation sent
    - _Requirements: 2.8-2.10, 3.6, 8.4_
  
  - [ ] 18.3 Write integration test for deadline expiration flow
    - Invitation sent → No response → Background scheduler expires → Buffer promotion
    - _Requirements: 3.7, 3.8, 8.2-8.4_
  
  - [ ] 18.4 Write integration test for negotiation flow
    - Slot conflict → Bot negotiation → Alternate slot found → Confirmation
    - _Requirements: 5.1-5.7_

- [ ] 19. Final Checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all 50 correctness properties are tested
  - Run performance benchmarks
  - Review security checklist
  - Verify backward compatibility

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- The implementation maintains backward compatibility throughout
- Feature flags allow gradual rollout and emergency kill switch
