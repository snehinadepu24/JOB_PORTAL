# Requirements Document: AI Hiring Orchestrator

## Introduction

The AI Hiring Orchestrator transforms a basic job portal with manual resume ranking into a fully automated, intelligent hiring system. The system automates the entire hiring pipeline from resume submission through interview scheduling, using AI-powered scoring, dynamic shortlisting with buffer management, automated interview coordination, intelligent negotiation chatbots, calendar integration, and no-show risk prediction. The orchestrator operates autonomously with self-healing capabilities while maintaining recruiter oversight and never blocking the hiring process due to delays.

## Glossary

- **System**: The AI Hiring Orchestrator platform
- **Resume_Intelligence_Engine**: AI component that scores, parses, and analyzes resumes
- **Shortlisting_Manager**: Component managing candidate shortlists and buffer pools
- **Interview_Scheduler**: Component handling interview invitation and slot coordination
- **Negotiation_Bot**: Chatbot handling interview slot negotiations with candidates
- **Calendar_Integrator**: Component syncing with Google Calendar
- **Risk_Analyzer**: Component predicting candidate no-show probability
- **Background_Scheduler**: Self-healing automation engine running periodic tasks
- **Fit_Score**: AI-computed score (0-100) measuring candidate-job alignment
- **Buffer_Pool**: Queue of next-best candidates ready for auto-promotion
- **Shortlist_Status**: Enum values: pending, shortlisted, buffer, rejected, expired
- **Interview_Status**: Enum values: invitation_sent, slot_pending, confirmed, completed, cancelled, no_show, expired
- **Number_of_Openings**: Maximum candidates that can be shortlisted for a job
- **Confirmation_Deadline**: Timestamp by which action must be taken or auto-action triggers
- **No_Show_Risk**: Probability score (0-1) predicting candidate interview absence

## Requirements

### Requirement 1: Resume Intelligence Engine

**User Story:** As a recruiter, I want resumes automatically scored and analyzed when candidates apply, so that I can immediately see the best-fit candidates without manual review.

#### Acceptance Criteria

1. WHEN a candidate submits an application, THE Resume_Intelligence_Engine SHALL automatically download and parse the resume PDF
2. WHEN parsing a resume, THE Resume_Intelligence_Engine SHALL extract skills, years of experience, project count, and education level
3. WHEN resume features are extracted, THE Resume_Intelligence_Engine SHALL generate an AI summary of the candidate's profile
4. WHEN computing fit score, THE Resume_Intelligence_Engine SHALL use weighted algorithm: TF-IDF similarity (40%), experience (25%), projects (20%), skills (10%), education (5%)
5. THE Resume_Intelligence_Engine SHALL store fit_score, extracted features, and AI summary in the applications table
6. WHEN resume processing completes, THE Resume_Intelligence_Engine SHALL set ai_processed flag to true
7. IF resume parsing fails, THEN THE Resume_Intelligence_Engine SHALL set fit_score to 0 and log the error
8. THE Resume_Intelligence_Engine SHALL compute fit scores within 30 seconds of application submission

### Requirement 2: Dynamic Shortlisting and Buffer System

**User Story:** As a recruiter, I want the system to automatically maintain a shortlist and buffer pool based on job openings, so that I always have qualified candidates ready without manual intervention.

#### Acceptance Criteria

1. WHEN a job is created, THE System SHALL require number_of_openings field (minimum 1)
2. WHEN a job is created, THE System SHALL set shortlisting_buffer to equal number_of_openings (default buffer size)
3. WHEN applications are ranked, THE Shortlisting_Manager SHALL automatically shortlist the top N candidates where N equals number_of_openings
4. WHEN shortlisting candidates, THE Shortlisting_Manager SHALL set shortlist_status to "shortlisted" and rank field to their position (1, 2, 3...)
5. WHEN shortlisting completes, THE Shortlisting_Manager SHALL place the next N candidates in buffer pool where N equals shortlisting_buffer
6. WHEN placing candidates in buffer, THE Shortlisting_Manager SHALL set shortlist_status to "buffer" and assign buffer rank positions
7. THE Shortlisting_Manager SHALL never shortlist more candidates than number_of_openings
8. WHEN a shortlisted candidate drops out (rejects, expires, no-show), THE Shortlisting_Manager SHALL automatically promote the highest-ranked buffer candidate
9. WHEN promoting a buffer candidate, THE Shortlisting_Manager SHALL update their shortlist_status to "shortlisted" and assign the vacated rank
10. WHEN a buffer candidate is promoted, THE Shortlisting_Manager SHALL add the next highest-ranked pending candidate to the buffer pool
11. THE Shortlisting_Manager SHALL maintain buffer pool at target size by continuously backfilling from pending candidates

### Requirement 3: Automated Interview Invitation System

**User Story:** As a recruiter, I want interview invitations automatically sent to shortlisted candidates with deadline-based automation, so that the hiring process moves forward without my constant attention.

#### Acceptance Criteria

1. WHEN a candidate is shortlisted, THE Interview_Scheduler SHALL automatically send an interview invitation email within 5 minutes
2. WHEN sending invitation, THE Interview_Scheduler SHALL create an interview record with status "invitation_sent"
3. WHEN creating interview record, THE Interview_Scheduler SHALL set confirmation_deadline to 48 hours from invitation time
4. THE Interview_Scheduler SHALL include accept and reject links in the invitation email
5. WHEN candidate clicks accept link, THE Interview_Scheduler SHALL update interview status to "slot_pending" and display slot selection UI
6. WHEN candidate clicks reject link, THE Interview_Scheduler SHALL update interview status to "cancelled" and trigger buffer promotion
7. WHEN confirmation_deadline passes without candidate response, THE Background_Scheduler SHALL automatically expire the invitation
8. WHEN invitation expires, THE Background_Scheduler SHALL update interview status to "expired" and trigger buffer promotion
9. THE Interview_Scheduler SHALL log all invitation actions with timestamps in automation activity log

### Requirement 4: Interview Slot Selection and Confirmation

**User Story:** As a candidate, I want to select interview slots from the recruiter's available times, so that I can choose a mutually convenient time without back-and-forth emails.

#### Acceptance Criteria

1. WHEN candidate accepts invitation, THE Interview_Scheduler SHALL fetch recruiter's Google Calendar availability for next 14 days
2. WHEN displaying slot selection, THE Interview_Scheduler SHALL show only free slots during business hours (9 AM - 6 PM, Monday-Friday)
3. WHEN displaying slots, THE Interview_Scheduler SHALL exclude slots with existing calendar events
4. WHEN candidate selects a slot, THE Interview_Scheduler SHALL set slot_selection_deadline to 24 hours from selection time
5. WHEN candidate confirms slot, THE Interview_Scheduler SHALL update interview status to "confirmed" and store scheduled_time
6. WHEN slot is confirmed, THE Calendar_Integrator SHALL create Google Calendar event for both recruiter and candidate
7. WHEN calendar event is created, THE Calendar_Integrator SHALL store calendar_event_id in interview record
8. WHEN slot_selection_deadline passes without confirmation, THE Background_Scheduler SHALL expire the interview and trigger buffer promotion
9. THE Interview_Scheduler SHALL send confirmation email to both parties when slot is confirmed

### Requirement 5: Negotiation Chatbot for Slot Conflicts

**User Story:** As a candidate, I want to negotiate alternate interview times through a chatbot when my preferred slots are unavailable, so that I can find a mutually convenient time without waiting for recruiter response.

#### Acceptance Criteria

1. WHEN candidate reports slot conflict, THE Negotiation_Bot SHALL ask for candidate's available time ranges
2. WHEN candidate provides availability, THE Negotiation_Bot SHALL check recruiter's calendar for overlapping free slots
3. WHEN overlapping slots exist, THE Negotiation_Bot SHALL suggest up to 3 alternate times
4. WHEN candidate accepts suggested slot, THE Negotiation_Bot SHALL update interview record and trigger calendar event creation
5. WHEN no overlapping slots exist, THE Negotiation_Bot SHALL notify recruiter and request manual intervention
6. THE Negotiation_Bot SHALL maintain conversation context for up to 3 negotiation rounds
7. WHEN negotiation exceeds 3 rounds without resolution, THE Negotiation_Bot SHALL escalate to recruiter with full conversation history
8. THE Negotiation_Bot SHALL respond to candidate messages within 5 seconds

### Requirement 6: Google Calendar Integration

**User Story:** As a recruiter, I want interview slots automatically synced with my Google Calendar, so that I never have scheduling conflicts and candidates see accurate availability.

#### Acceptance Criteria

1. WHEN recruiter connects account, THE Calendar_Integrator SHALL authenticate with Google Calendar API using OAuth 2.0
2. WHEN fetching availability, THE Calendar_Integrator SHALL query recruiter's primary calendar for the requested date range
3. WHEN creating interview event, THE Calendar_Integrator SHALL set event title to "Interview: [Candidate Name] - [Job Title]"
4. WHEN creating event, THE Calendar_Integrator SHALL invite both recruiter and candidate email addresses
5. WHEN creating event, THE Calendar_Integrator SHALL set event duration to 60 minutes (default)
6. WHEN interview is cancelled, THE Calendar_Integrator SHALL delete the corresponding calendar event
7. WHEN interview is rescheduled, THE Calendar_Integrator SHALL update the existing calendar event time
8. THE Calendar_Integrator SHALL handle calendar API errors gracefully and retry up to 3 times with exponential backoff
9. THE Calendar_Integrator SHALL store OAuth refresh tokens securely for long-term calendar access

### Requirement 7: No-Show Risk Prediction

**User Story:** As a recruiter, I want to see no-show risk scores for candidates, so that I can prioritize reliable candidates and prepare backup plans for high-risk interviews.

#### Acceptance Criteria

1. WHEN interview is confirmed, THE Risk_Analyzer SHALL compute no_show_risk score based on candidate behavior patterns
2. WHEN computing risk, THE Risk_Analyzer SHALL analyze: response time to invitation, negotiation rounds, profile completeness, and historical patterns
3. THE Risk_Analyzer SHALL assign risk score between 0.0 (very reliable) and 1.0 (high risk)
4. WHEN risk score exceeds 0.7, THE Risk_Analyzer SHALL flag interview as "high risk" in recruiter dashboard
5. WHEN interview is flagged high risk, THE System SHALL display warning indicator to recruiter
6. THE Risk_Analyzer SHALL update risk scores daily as new behavioral data becomes available
7. WHEN candidate completes interview, THE Risk_Analyzer SHALL record outcome (attended/no-show) for future model training
8. THE Risk_Analyzer SHALL display risk score with color coding: green (0-0.3), yellow (0.3-0.7), red (0.7-1.0)

### Requirement 8: Background Automation Engine

**User Story:** As a system administrator, I want a self-healing scheduler that automatically handles deadlines and promotions, so that the hiring process never stalls due to timeouts or candidate dropouts.

#### Acceptance Criteria

1. THE Background_Scheduler SHALL run automated checks every 5 minutes
2. WHEN checking deadlines, THE Background_Scheduler SHALL identify all interviews with passed confirmation_deadline or slot_selection_deadline
3. WHEN deadline is passed, THE Background_Scheduler SHALL expire the interview and update status to "expired"
4. WHEN interview expires, THE Background_Scheduler SHALL trigger Shortlisting_Manager to promote next buffer candidate
5. WHEN checking buffer health, THE Background_Scheduler SHALL ensure buffer pool is at target size for all active jobs
6. WHEN buffer is below target, THE Background_Scheduler SHALL backfill from pending candidates
7. THE Background_Scheduler SHALL log all automated actions with timestamps and reasons
8. WHEN automated action fails, THE Background_Scheduler SHALL retry up to 3 times before alerting system administrator
9. THE Background_Scheduler SHALL send daily summary report of automation activities to recruiters
10. THE Background_Scheduler SHALL never block or halt due to individual task failures (fault isolation)

### Requirement 9: Recruiter Dashboard and Analytics

**User Story:** As a recruiter, I want a comprehensive dashboard showing ranked candidates, automation activity, and analytics, so that I can monitor the hiring process and measure automation effectiveness.

#### Acceptance Criteria

1. WHEN recruiter views job dashboard, THE System SHALL display all candidates sorted by fit_score (highest first)
2. WHEN displaying candidates, THE System SHALL show: name, fit_score, no_show_risk, shortlist_status, interview_status
3. WHEN displaying shortlisted candidates, THE System SHALL highlight them with distinct visual styling
4. WHEN displaying buffer candidates, THE System SHALL show their buffer rank position
5. THE System SHALL display automation activity log showing recent actions: promotions, expirations, invitations sent
6. WHEN displaying activity log, THE System SHALL show timestamp, action type, candidate name, and outcome
7. THE System SHALL display analytics panel showing: time saved (hours), automation success rate (%), average time-to-interview (days)
8. WHEN calculating time saved, THE System SHALL estimate manual hours avoided through automation
9. THE System SHALL display buffer pool health indicator: green (full), yellow (partial), red (empty)
10. THE System SHALL allow recruiter to manually override automation decisions (promote specific buffer candidate, extend deadline)

### Requirement 10: Database Schema Extensions

**User Story:** As a developer, I want the database schema extended to support all orchestrator features, so that the system can store and query all necessary data efficiently.

#### Acceptance Criteria

1. THE System SHALL add number_of_openings column to jobs table (integer, minimum 1, required)
2. THE System SHALL add shortlisting_buffer column to jobs table (integer, default equals number_of_openings)
3. THE System SHALL add fit_score column to applications table (float, 0-100, default 0)
4. THE System SHALL add rank column to applications table (integer, nullable)
5. THE System SHALL add summary column to applications table (text, nullable)
6. THE System SHALL add shortlist_status column to applications table (enum: pending, shortlisted, buffer, rejected, expired)
7. THE System SHALL add ai_processed column to applications table (boolean, default false)
8. THE System SHALL create interviews table with columns: id (UUID), application_id (UUID FK), job_id (UUID FK), recruiter_id (UUID FK), candidate_id (UUID FK)
9. THE System SHALL add to interviews table: rank_at_time (integer), scheduled_time (timestamp), status (enum), confirmation_deadline (timestamp), slot_selection_deadline (timestamp)
10. THE System SHALL add to interviews table: calendar_event_id (varchar), no_show_risk (float 0-1), created_at (timestamp), updated_at (timestamp)
11. THE System SHALL create automation_logs table with columns: id (UUID), job_id (UUID FK), action_type (varchar), details (jsonb), created_at (timestamp)
12. THE System SHALL create indexes on: applications(fit_score DESC), applications(shortlist_status), interviews(status), interviews(confirmation_deadline), interviews(slot_selection_deadline)

### Requirement 11: Email Notification System

**User Story:** As a candidate, I want to receive timely email notifications about my application status and interview invitations, so that I can respond promptly and stay informed.

#### Acceptance Criteria

1. WHEN candidate is shortlisted, THE System SHALL send email notification with subject "Interview Invitation: [Job Title]"
2. WHEN sending invitation email, THE System SHALL include job details, company name, and interview process overview
3. THE System SHALL include unique accept link with format: /interview/accept/{interview_id}/{token}
4. THE System SHALL include unique reject link with format: /interview/reject/{interview_id}/{token}
5. WHEN candidate accepts, THE System SHALL send email with slot selection link and deadline
6. WHEN interview is confirmed, THE System SHALL send confirmation email with interview details and calendar invite
7. WHEN interview is 24 hours away, THE System SHALL send reminder email to both candidate and recruiter
8. WHEN candidate is promoted from buffer, THE System SHALL send notification explaining their promotion
9. THE System SHALL use email templates with consistent branding and clear call-to-action buttons
10. THE System SHALL track email delivery status and retry failed sends up to 3 times

### Requirement 12: Backward Compatibility and Migration

**User Story:** As a system administrator, I want the orchestrator to preserve existing functionality while adding new features, so that current users experience no disruption during the upgrade.

#### Acceptance Criteria

1. THE System SHALL maintain all existing API endpoints for login, job posting, and applications
2. THE System SHALL preserve manual accept/reject functionality for recruiters
3. WHEN manual accept is used, THE System SHALL bypass automated shortlisting for that candidate
4. WHEN manual reject is used, THE System SHALL update shortlist_status to "rejected" and not include in automation
5. THE System SHALL provide database migration scripts that add new columns without dropping existing data
6. THE System SHALL set default values for new columns on existing records: fit_score=0, shortlist_status="pending", ai_processed=false
7. WHEN upgrading, THE System SHALL allow jobs without number_of_openings to default to 5 openings
8. THE System SHALL provide feature flag to enable/disable automation per job
9. WHEN automation is disabled for a job, THE System SHALL fall back to manual ranking and shortlisting
10. THE System SHALL log all migration actions and provide rollback capability

### Requirement 13: Error Handling and Resilience

**User Story:** As a system administrator, I want comprehensive error handling and resilience mechanisms, so that individual failures don't cascade and the system remains operational.

#### Acceptance Criteria

1. WHEN Resume_Intelligence_Engine fails to parse a resume, THE System SHALL log error, set fit_score to 0, and continue processing other applications
2. WHEN Calendar_Integrator fails to create event, THE System SHALL retry 3 times with exponential backoff before alerting recruiter
3. WHEN email delivery fails, THE System SHALL queue for retry and attempt delivery every 10 minutes for up to 2 hours
4. WHEN Negotiation_Bot encounters unexpected input, THE System SHALL provide fallback response and escalate to recruiter
5. WHEN Background_Scheduler task fails, THE System SHALL isolate failure, log error, and continue with other tasks
6. THE System SHALL implement circuit breaker pattern for external API calls (Google Calendar, email service)
7. WHEN circuit breaker opens, THE System SHALL notify administrator and provide manual override option
8. THE System SHALL validate all user inputs and reject malformed requests with descriptive error messages
9. THE System SHALL implement rate limiting on API endpoints: 100 requests per minute per user
10. THE System SHALL maintain system health metrics and alert when error rate exceeds 5% over 10-minute window

### Requirement 14: Security and Privacy

**User Story:** As a candidate, I want my personal data and resume content protected with industry-standard security, so that my information remains confidential throughout the hiring process.

#### Acceptance Criteria

1. THE System SHALL encrypt all OAuth tokens and API keys at rest using AES-256 encryption
2. THE System SHALL use HTTPS for all API communications
3. THE System SHALL validate interview action tokens to prevent unauthorized access to accept/reject endpoints
4. THE System SHALL expire interview action tokens after 7 days
5. THE System SHALL implement row-level security ensuring candidates only see their own applications
6. THE System SHALL implement row-level security ensuring recruiters only see applications for their jobs
7. THE System SHALL sanitize all user inputs to prevent SQL injection and XSS attacks
8. THE System SHALL log all access to sensitive data (resumes, interview details) for audit purposes
9. THE System SHALL comply with GDPR by allowing candidates to request data deletion
10. WHEN candidate requests deletion, THE System SHALL anonymize their data while preserving aggregate analytics

### Requirement 15: Performance and Scalability

**User Story:** As a system administrator, I want the orchestrator to handle high volumes of applications and concurrent operations efficiently, so that the system remains responsive under load.

#### Acceptance Criteria

1. THE Resume_Intelligence_Engine SHALL process resume parsing and scoring in under 30 seconds per application
2. THE System SHALL handle concurrent application submissions with queue-based processing
3. THE System SHALL process up to 100 applications per minute without performance degradation
4. THE Background_Scheduler SHALL complete each automation cycle in under 60 seconds
5. THE System SHALL use database connection pooling with minimum 10 and maximum 50 connections
6. THE System SHALL implement caching for frequently accessed data (job details, recruiter profiles) with 5-minute TTL
7. THE System SHALL use database indexes on all frequently queried columns (fit_score, shortlist_status, deadlines)
8. THE System SHALL implement pagination for candidate lists (50 candidates per page)
9. THE System SHALL use asynchronous processing for email sending and calendar operations
10. THE System SHALL monitor response times and alert when 95th percentile exceeds 2 seconds
