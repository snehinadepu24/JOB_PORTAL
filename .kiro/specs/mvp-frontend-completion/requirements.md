# MVP Frontend Completion - Requirements

## 1. Overview

### 1.1 Purpose
Complete the frontend implementation to expose the existing backend automation features, creating a fully functional AI-powered hiring orchestrator MVP.

### 1.2 Current State
- **Backend**: 95% complete with comprehensive automation logic
- **Frontend**: 30% complete with basic auth, job posting, and application features
- **Gap**: Missing UI for shortlisting, interviews, dashboard, and monitoring

### 1.3 MVP Scope
Implement the minimum viable UI to enable the complete end-to-end hiring workflow:
1. Enhanced job posting with automation configuration
2. Recruiter dashboard with candidate management
3. Interview workflow UI (accept/reject/schedule)
4. Basic monitoring and activity logs

### 1.4 Success Criteria
- Recruiters can post jobs with automation settings
- Recruiters can view and manage shortlisted/buffer candidates
- Recruiters can trigger and monitor automation
- Candidates can respond to interview invitations
- Candidates can select interview time slots
- System displays real-time automation activity

## 2. User Stories

### 2.1 Recruiter - Enhanced Job Posting

**US-1: Configure Number of Openings**
- **As a** recruiter
- **I want to** specify the number of open positions when posting a job
- **So that** the system can automatically shortlist the correct number of candidates

**Acceptance Criteria:**
- Job posting form includes "Number of Openings" field
- Field accepts integers >= 1
- Default value is 1
- Field is required
- System calculates shortlisting_buffer automatically (H × 2 for H > 5, H × 3 for 2-5, 4 for H=1)

**US-2: View Automation Settings**
- **As a** recruiter
- **I want to** see the calculated buffer size and automation settings
- **So that** I understand how many candidates will be shortlisted and buffered

**Acceptance Criteria:**
- Display calculated shortlisting_buffer value
- Show automation status (enabled/disabled)
- Display confirmation deadline (default 48 hours)
- Settings are read-only after job creation (MVP limitation)

### 2.2 Recruiter - Candidate Dashboard

**US-3: View Ranked Candidates**
- **As a** recruiter
- **I want to** see all candidates ranked by fit score
- **So that** I can review AI-generated rankings

**Acceptance Criteria:**
- Display candidate list with: name, fit_score, rank, shortlist_status
- Sort by fit_score (descending) by default
- Show visual indicators for shortlisted (green), buffer (yellow), pending (gray)
- Display AI processing status
- Show candidate summary from AI analysis
- Paginate results (20 per page)

**US-4: Filter and Sort Candidates**
- **As a** recruiter
- **I want to** filter candidates by status and sort by different criteria
- **So that** I can focus on specific candidate groups

**Acceptance Criteria:**
- Filter by shortlist_status: all, shortlisted, buffer, pending, rejected
- Sort by: fit_score, rank, name, application date
- Filters persist during session
- Clear filters button available

**US-5: View Candidate Details**
- **As a** recruiter
- **I want to** click on a candidate to see full details
- **So that** I can review their application and AI analysis

**Acceptance Criteria:**
- Modal/drawer opens with full candidate info
- Display: resume, cover letter, fit_score, matched skills, missing skills, AI summary
- Show interview status if applicable
- Provide "View Resume" button (opens PDF)

### 2.3 Recruiter - Shortlisting Control

**US-6: Trigger Auto-Shortlisting**
- **As a** recruiter
- **I want to** manually trigger the auto-shortlisting process
- **So that** I can start the automation when ready

**Acceptance Criteria:**
- "Start Automation" button visible when applications_closed = false
- Button triggers POST /api/jobs/:jobId/start-automation
- Shows loading state during processing
- Displays success message with shortlisted/buffer counts
- Button disabled after automation starts
- Error handling with user-friendly messages

**US-7: Close Applications**
- **As a** recruiter
- **I want to** close applications for a job
- **So that** no more candidates can apply

**Acceptance Criteria:**
- "Close Applications" button on job detail page
- Confirmation dialog before closing
- Updates applications_closed = true
- Enables "Start Automation" button
- Shows "Applications Closed" badge on job

**US-8: View Shortlist Summary**
- **As a** recruiter
- **I want to** see a summary of shortlisting status
- **So that** I can quickly understand the pipeline state

**Acceptance Criteria:**
- Dashboard widget showing:
  - Total applications
  - Shortlisted count / target
  - Buffer count / target
  - Pending count
  - Rejected count
- Color-coded progress bars
- Buffer health indicator (full/healthy/low/critical/empty)

### 2.4 Recruiter - Activity Monitoring

**US-9: View Automation Activity Log**
- **As a** recruiter
- **I want to** see a log of all automation actions
- **So that** I can monitor what the system is doing

**Acceptance Criteria:**
- Activity log table with: timestamp, action type, candidate name, outcome
- Icons and colors for different action types
- Filter by action type
- Filter by date range
- Pagination (50 per page)
- Real-time updates (poll every 30 seconds)

**US-10: View Analytics Dashboard**
- **As a** recruiter
- **I want to** see analytics about automation performance
- **So that** I can measure time savings and success rates

**Acceptance Criteria:**
- Display key metrics:
  - Time saved (hours) with breakdown
  - Automation success rate (%)
  - Average time to interview (days)
  - Buffer health status
  - Response rate (%)
  - No-show rate (%)
- Visual charts/graphs for trends
- Comparison with previous period
- Export data button (CSV)

### 2.5 Candidate - Interview Workflow

**US-11: Receive Interview Invitation Email**
- **As a** candidate
- **I want to** receive an email with interview invitation
- **So that** I can accept or reject the interview

**Acceptance Criteria:**
- Email contains: job title, company name, accept link, reject link, deadline
- Links are secure (JWT tokens)
- Email is professional and branded
- Deadline is clearly stated (48 hours)

**US-12: Accept Interview Invitation**
- **As a** candidate
- **I want to** click the accept link and confirm my acceptance
- **So that** I can proceed to schedule the interview

**Acceptance Criteria:**
- Accept link opens dedicated page: /interview/accept/:interviewId/:token
- Page validates token
- Shows job details and next steps
- "Confirm Acceptance" button
- Redirects to slot selection page after confirmation
- Shows error if token expired/invalid

**US-13: Reject Interview Invitation**
- **As a** candidate
- **I want to** click the reject link and decline the interview
- **So that** I can opt out gracefully

**Acceptance Criteria:**
- Reject link opens dedicated page: /interview/reject/:interviewId/:token
- Page validates token
- Shows confirmation message
- Optional feedback textarea
- "Confirm Rejection" button
- Shows thank you message after confirmation
- Shows error if token expired/invalid

**US-14: Select Interview Time Slot**
- **As a** candidate
- **I want to** select from available interview time slots
- **So that** I can schedule the interview at a convenient time

**Acceptance Criteria:**
- Slot selection page: /interview/select-slot/:interviewId
- Display available slots from recruiter's calendar
- Show date, time, duration for each slot
- Radio button selection
- "Confirm Slot" button
- Loading state during confirmation
- Success message with calendar invite
- Deadline countdown timer (24 hours)

**US-15: Negotiate Alternative Time**
- **As a** candidate
- **I want to** request alternative times if none of the slots work
- **So that** I can find a mutually convenient time

**Acceptance Criteria:**
- "None of these work for me" button on slot selection page
- Opens chat interface with negotiation bot
- Can type availability in natural language
- Bot responds with alternative suggestions
- Max 3 rounds of negotiation
- Escalates to recruiter after 3 rounds
- Shows escalation message

### 2.6 Candidate - Application Status Tracking

**US-16: View Application Status**
- **As a** candidate
- **I want to** see the status of my applications
- **So that** I know where I stand in the hiring process

**Acceptance Criteria:**
- My Applications page shows all submitted applications
- Display: job title, company, application date, status
- Status badges: pending, shortlisted, buffer, interview scheduled, rejected
- Show interview details if scheduled
- Show next action required (e.g., "Select interview slot")

### 2.7 System - Background Automation

**US-17: Auto-Confirm Shortlist on Deadline**
- **As the** system
- **I want to** automatically confirm shortlist if recruiter doesn't respond
- **So that** the hiring process doesn't stall

**Acceptance Criteria:**
- Background scheduler checks confirmation deadlines
- Auto-confirms after 48 hours (configurable)
- Sends interview invitations to shortlisted candidates
- Logs action in automation_logs
- Sends notification email to recruiter

**US-18: Handle Expired Invitations**
- **As the** system
- **I want to** automatically handle expired interview invitations
- **So that** buffer candidates are promoted automatically

**Acceptance Criteria:**
- Background scheduler checks invitation deadlines
- Marks interview as expired after 48 hours
- Updates application status to rejected
- Promotes highest-ranked buffer candidate
- Sends invitation to promoted candidate
- Logs all actions

## 3. Functional Requirements

### 3.1 API Endpoints (New/Modified)

**FR-1: Job Management**
- `PUT /api/jobs/:id` - Update to accept number_of_openings
- `POST /api/jobs/:jobId/close-applications` - Close applications
- `POST /api/jobs/:jobId/start-automation` - Trigger auto-shortlisting
- `GET /api/jobs/:jobId/shortlist-status` - Get shortlist summary

**FR-2: Dashboard**
- `GET /api/dashboard/:jobId/candidates` - Get ranked candidates (exists)
- `GET /api/dashboard/:jobId/activity` - Get activity log (exists)
- `GET /api/dashboard/:jobId/analytics` - Get analytics (exists)

**FR-3: Interview Actions**
- `POST /api/interviews/:interviewId/accept/:token` - Accept invitation
- `POST /api/interviews/:interviewId/reject/:token` - Reject invitation
- `GET /api/interviews/:interviewId/slots` - Get available slots
- `POST /api/interviews/:interviewId/confirm-slot` - Confirm selected slot
- `POST /api/interviews/:interviewId/negotiate` - Start negotiation
- `POST /api/interviews/:interviewId/negotiate/:sessionId` - Continue negotiation

### 3.2 Data Validation

**FR-4: Input Validation**
- number_of_openings: integer, min 1, max 100
- Token validation: JWT signature, expiry, interview_id match
- Slot selection: must be from available slots, not in past
- Negotiation message: max 500 characters

### 3.3 Error Handling

**FR-5: User-Friendly Errors**
- Network errors: "Connection lost. Please try again."
- Token expired: "This link has expired. Please contact the recruiter."
- Invalid data: Specific field-level error messages
- Server errors: "Something went wrong. Please try again later."

### 3.4 Performance Requirements

**FR-6: Response Times**
- Page load: < 2 seconds
- API calls: < 1 second
- Real-time updates: 30-second polling interval
- Large lists: Pagination with 20-50 items per page

**FR-7: Scalability**
- Support 100+ applications per job
- Handle 10+ concurrent recruiters
- Efficient data fetching (no N+1 queries)

## 4. Non-Functional Requirements

### 4.1 Usability

**NFR-1: User Experience**
- Intuitive navigation with clear labels
- Consistent design language (use existing components)
- Mobile-responsive (basic support)
- Loading states for all async operations
- Success/error feedback for all actions

**NFR-2: Accessibility**
- Keyboard navigation support
- ARIA labels for screen readers
- Color contrast compliance (WCAG AA)
- Focus indicators visible

### 4.2 Security

**NFR-3: Authentication & Authorization**
- All routes require authentication
- Role-based access control (recruiter vs candidate)
- Secure token handling (no tokens in URLs after initial load)
- CSRF protection on forms

**NFR-4: Data Protection**
- No sensitive data in browser console
- Secure API communication (HTTPS)
- Token expiry enforcement
- Input sanitization

### 4.3 Reliability

**NFR-5: Error Recovery**
- Graceful degradation on API failures
- Retry logic for transient errors
- Clear error messages with recovery steps
- No data loss on network interruptions

### 4.4 Maintainability

**NFR-6: Code Quality**
- Reusable components
- Consistent naming conventions
- PropTypes/TypeScript for type safety
- Component documentation
- Unit tests for critical paths

## 5. Technical Constraints

### 5.1 Technology Stack
- **Frontend Framework**: React (existing)
- **Routing**: React Router (existing)
- **State Management**: Context API or Redux (to be decided)
- **HTTP Client**: Axios (existing)
- **UI Components**: Existing component library + new components
- **Styling**: CSS/SCSS (existing approach)

### 5.2 Browser Support
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

### 5.3 Integration Points
- Backend API: http://localhost:4000/api
- Authentication: JWT tokens in cookies
- File uploads: Cloudinary (existing)
- Email: Backend handles (no frontend changes)

## 6. Dependencies

### 6.1 Backend Dependencies
- All backend APIs must be functional
- Background scheduler must be running
- Python service for AI processing
- Email service configured

### 6.2 External Services
- Cloudinary for resume storage
- Google Calendar API (optional for MVP)
- Email service (SendGrid/similar)

## 7. Out of Scope (Post-MVP)

### 7.1 Deferred Features
- Real-time notifications (WebSocket)
- Advanced analytics (custom date ranges, exports)
- Bulk actions (select multiple candidates)
- Interview rescheduling
- Video interview integration
- Mobile app
- Multi-language support
- Custom email templates editor
- Advanced calendar integration (Outlook, iCal)
- Candidate profile editing
- Resume parsing improvements
- AI model retraining interface

### 7.2 Known Limitations
- No real-time updates (polling only)
- Basic mobile support (not optimized)
- Single recruiter per job (no team collaboration)
- No draft job postings
- No application editing after submission
- No bulk candidate import
- No custom automation rules
- No A/B testing of automation strategies

## 8. Acceptance Testing Scenarios

### 8.1 End-to-End Workflow Test

**Scenario 1: Complete Hiring Flow**
1. Recruiter posts job with 2 openings
2. 10 candidates apply with resumes
3. AI processes all resumes (fit scores assigned)
4. Recruiter closes applications
5. Recruiter triggers auto-shortlisting
6. System shortlists top 2, buffers next 4
7. System sends interview invitations to 2 shortlisted
8. Candidate 1 accepts, selects slot → interview confirmed
9. Candidate 2 rejects → buffer candidate promoted
10. Promoted candidate accepts, selects slot
11. Recruiter views activity log (all actions logged)
12. Recruiter views analytics (time saved calculated)

**Expected Results:**
- All steps complete without errors
- Automation logs show all actions
- Email notifications sent at each step
- Dashboard reflects current state accurately

### 8.2 Edge Cases

**Scenario 2: Token Expiry**
1. Candidate receives interview invitation
2. Waits 8 days (token expires after 7 days)
3. Clicks accept link
4. System shows "Link expired" error
5. Provides contact information for recruiter

**Scenario 3: Buffer Exhaustion**
1. Job has 5 openings, 7 applications
2. Auto-shortlist: 5 shortlisted, 2 buffered
3. All 5 shortlisted candidates reject
4. System promotes 2 from buffer
5. 3rd rejection has no buffer candidates
6. System logs "buffer empty" event
7. Recruiter receives notification

**Scenario 4: Negotiation Escalation**
1. Candidate accepts invitation
2. No available slots match candidate's availability
3. Candidate starts negotiation
4. Bot suggests alternatives (round 1)
5. Candidate rejects, provides new availability (round 2)
6. Bot suggests alternatives (round 2)
7. Candidate rejects again (round 3)
8. Bot escalates to recruiter
9. Recruiter receives email with conversation history

## 9. Success Metrics

### 9.1 Functional Completeness
- ✅ All 18 user stories implemented
- ✅ All critical paths tested
- ✅ Zero P0/P1 bugs in production

### 9.2 User Adoption
- 80% of recruiters use auto-shortlisting feature
- 90% of candidates respond to interview invitations
- 70% of interviews scheduled without manual intervention

### 9.3 Performance
- Page load times < 2 seconds (95th percentile)
- API response times < 1 second (95th percentile)
- Zero data loss incidents

### 9.4 Business Impact
- 50% reduction in time-to-interview
- 30% reduction in recruiter manual work
- 90% automation success rate

## 10. Risks and Mitigations

### 10.1 Technical Risks

**Risk 1: Frontend-Backend Integration Issues**
- **Probability**: Medium
- **Impact**: High
- **Mitigation**: Comprehensive API testing, mock data for development, integration tests

**Risk 2: Performance Degradation with Large Data Sets**
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**: Pagination, lazy loading, database indexing, caching

**Risk 3: Token Security Vulnerabilities**
- **Probability**: Low
- **Impact**: High
- **Mitigation**: Security audit, token expiry, HTTPS enforcement, rate limiting

### 10.2 User Experience Risks

**Risk 4: Complex UI Confuses Users**
- **Probability**: Medium
- **Impact**: Medium
- **Mitigation**: User testing, tooltips, onboarding guide, help documentation

**Risk 5: Email Deliverability Issues**
- **Probability**: Medium
- **Impact**: High
- **Mitigation**: Email service monitoring, fallback notifications, retry logic

## 11. Glossary

- **Auto-Shortlisting**: Automated process of selecting top N candidates based on AI fit scores
- **Buffer Pool**: Reserve candidates maintained to replace shortlisted candidates who drop out
- **Fit Score**: AI-generated score (0-100) measuring candidate-job alignment
- **Shortlist Status**: Current state of application (pending/shortlisted/buffer/rejected/expired)
- **Interview Status**: Current state of interview (invitation_sent/slot_pending/confirmed/completed/cancelled/no_show/expired)
- **Negotiation Bot**: AI chatbot that helps candidates find alternative interview times
- **Automation Log**: Audit trail of all automated actions taken by the system
- **Confirmation Deadline**: Time limit for recruiter to confirm shortlist (default 48 hours)
- **Slot Selection Deadline**: Time limit for candidate to select interview slot (default 24 hours)
- **Buffer Promotion**: Process of moving a buffer candidate to shortlisted when a slot opens

## 12. Appendix

### 12.1 Related Documents
- Backend API Documentation: `backend/README.md`
- Database Schema: `backend/database/schema.sql`
- Automation Logic: `backend/managers/ShortlistingManager.js`
- Interview Workflow: `backend/managers/InterviewScheduler.js`

### 12.2 Reference Implementations
- Existing Auth Components: `frontend/src/components/Auth/`
- Existing Job Components: `frontend/src/components/Job/`
- Existing Application Components: `frontend/src/components/Application/`

### 12.3 API Endpoints Reference
See `backend/routes/` for complete API documentation
