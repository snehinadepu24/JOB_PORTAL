# Implementation Plan: MVP Frontend Completion

## Overview

This implementation plan creates the frontend UI to expose existing backend automation features. The backend is 95% complete with all automation logic already implemented. This plan focuses on building React components that integrate with existing APIs to create a fully functional AI-powered hiring orchestrator MVP.

The implementation follows a phased approach: Phase 1 establishes the critical path (job posting and dashboard), Phase 2 adds core interview workflow features, and Phase 3 adds polish with analytics and shared components.

## Tasks

- [ ] 1. Set up project structure and shared utilities
  - Create new directory structure for dashboard and interview components
  - Set up API service layer with axios interceptors
  - Create shared utility functions (date formatting, status mapping, buffer calculation)
  - Set up Context API providers for job and dashboard state
  - _Requirements: 3.1, 5.1, 5.2_

- [ ] 2. Implement API service layer
  - [ ] 2.1 Create base API client with interceptors
    - Set up axios instance with base URL and credentials
    - Implement request interceptor for authentication
    - Implement response interceptor for global error handling (401 redirects)
    - _Requirements: 5.1, 3.3_
  
  - [ ] 2.2 Create dashboard service functions
    - Implement getShortlistStatus, getCandidates, getActivityLog, getAnalytics
    - Add query parameter support for filtering and pagination
    - _Requirements: 3.1 (FR-2)_
  
  - [ ] 2.3 Create job service functions
    - Implement closeApplications, startAutomation, postJob (enhanced)
    - Add error handling for each endpoint
    - _Requirements: 3.1 (FR-1)_
  
  - [ ] 2.4 Create interview service functions
    - Implement acceptInterview, rejectInterview, getSlots, confirmSlot
    - Implement negotiation functions (getNegotiationHistory, sendNegotiationMessage)
    - _Requirements: 3.1 (FR-3)_

- [ ] 3. Create Context providers for state management
  - [ ] 3.1 Create JobContext provider
    - Manage selectedJob state
    - Implement fetchJobDetails function
    - Implement closeApplications and startAutomation actions
    - _Requirements: 2.1, 2.3_
  
  - [ ] 3.2 Create DashboardContext provider
    - Manage candidates, activityLog, analytics state
    - Implement fetch functions with caching
    - Implement polling logic with visibility API integration
    - Manage filters and pagination state
    - _Requirements: 2.2, 2.4_

- [ ] 4. Phase 1: Enhanced job posting (Critical Path)
  - [ ] 4.1 Enhance PostJob component with number_of_openings field
    - Add number_of_openings input field (integer, min 1, max 100, required)
    - Implement buffer calculation function (H×2 for H>5, H×3 for 2-5, 4 for H=1)
    - Display calculated shortlisting_buffer value
    - Add automation settings preview section
    - Update form submission to include number_of_openings
    - _Requirements: 2.1 (US-1, US-2), 3.2 (FR-4)_
  
  - [ ]* 4.2 Write unit tests for PostJob enhancements
    - Test buffer calculation logic for different opening counts
    - Test form validation for number_of_openings field
    - Test automation preview display
    - _Requirements: 2.1 (US-1, US-2)_

- [ ] 5. Phase 1: Dashboard layout and job selector (Critical Path)
  - [ ] 5.1 Create Dashboard layout component
    - Implement main dashboard container with routing
    - Add tabbed interface (Candidates, Activity Log, Analytics)
    - Integrate JobContext for job selection
    - Add loading and error states
    - _Requirements: 2.2 (US-3)_
  
  - [ ] 5.2 Create JobSelector component
    - Fetch recruiter's jobs from API
    - Implement dropdown with job title and application count
    - Handle job selection and update context
    - Add loading state during fetch
    - _Requirements: 2.2 (US-3)_
  
  - [ ]* 5.3 Write unit tests for Dashboard and JobSelector
    - Test tab switching functionality
    - Test job selection updates context
    - Test loading and error states
    - _Requirements: 2.2 (US-3)_

- [ ] 6. Phase 1: Shortlist summary with automation controls (Critical Path)
  - [ ] 6.1 Create ShortlistSummary component
    - Fetch shortlist status from API
    - Display StatCard components for shortlisted, buffer, pending counts
    - Implement BufferHealthIndicator with color coding
    - Add "Close Applications" button with confirmation dialog
    - Add "Start Automation" button with loading state
    - Handle button visibility based on job state
    - Display success/error messages for actions
    - _Requirements: 2.3 (US-6, US-7, US-8), 3.1 (FR-1)_
  
  - [ ] 6.2 Create StatCard shared component
    - Display label, value, and color-coded styling
    - Support progress bar visualization
    - _Requirements: 2.3 (US-8)_
  
  - [ ] 6.3 Create BufferHealthIndicator component
    - Display buffer health status (full/healthy/low/critical/empty)
    - Color-code based on status
    - Show percentage fill
    - _Requirements: 2.3 (US-8)_
  
  - [ ]* 6.4 Write unit tests for ShortlistSummary
    - Test stat display with different count values
    - Test button visibility logic
    - Test automation trigger flow
    - _Requirements: 2.3 (US-6, US-7, US-8)_

- [ ] 7. Phase 1: Basic candidate list (Critical Path)
  - [ ] 7.1 Create CandidateList component
    - Fetch candidates from dashboard API with pagination
    - Implement table view with columns: rank, name, fit_score, status, interview_status
    - Add filter dropdown for status (all, shortlisted, buffer, pending, rejected)
    - Add sort dropdown (fit_score, rank, name, created_at)
    - Implement pagination controls (20 items per page)
    - Add "Clear Filters" button
    - Handle loading and empty states
    - _Requirements: 2.2 (US-3, US-4), 3.1 (FR-2)_
  
  - [ ] 7.2 Create CandidateRow component
    - Display candidate data in table row format
    - Add click handler to open detail modal
    - Apply status-based styling
    - _Requirements: 2.2 (US-3)_
  
  - [ ] 7.3 Create CandidateDetailModal component
    - Display full candidate information (resume, cover letter, fit_score, matched/missing skills)
    - Show AI summary and analysis
    - Display interview status if applicable
    - Add "View Resume" button (opens PDF in new tab)
    - Implement close functionality
    - _Requirements: 2.2 (US-5)_
  
  - [ ]* 7.4 Write unit tests for CandidateList
    - Test filtering and sorting functionality
    - Test pagination controls
    - Test candidate detail modal opening
    - _Requirements: 2.2 (US-3, US-4, US-5)_

- [ ] 8. Checkpoint - Phase 1 complete
  - Ensure all Phase 1 components render correctly
  - Test job posting with automation settings
  - Test dashboard navigation and job selection
  - Test shortlist summary and automation triggers
  - Test candidate list filtering and sorting
  - Ensure all tests pass, ask the user if questions arise

- [ ] 9. Phase 2: Interview acceptance flow (Core Features)
  - [ ] 9.1 Create InterviewAccept component
    - Extract interviewId and token from route params
    - Validate token on component mount
    - Display job details and next steps
    - Implement "Confirm Acceptance" button
    - Handle API call to accept interview
    - Redirect to slot selection on success
    - Display error messages for expired/invalid tokens
    - _Requirements: 2.5 (US-12), 3.1 (FR-3)_
  
  - [ ] 9.2 Create InterviewReject component
    - Extract interviewId and token from route params
    - Validate token on component mount
    - Display confirmation message
    - Add optional feedback textarea (max 500 chars)
    - Implement "Confirm Rejection" button
    - Handle API call to reject interview
    - Display thank you message on success
    - Display error messages for expired/invalid tokens
    - _Requirements: 2.5 (US-13), 3.1 (FR-3)_
  
  - [ ]* 9.3 Write unit tests for interview acceptance/rejection
    - Test token validation logic
    - Test successful acceptance flow
    - Test successful rejection flow
    - Test error handling for expired tokens
    - _Requirements: 2.5 (US-12, US-13)_

- [ ] 10. Phase 2: Slot selection interface (Core Features)
  - [ ] 10.1 Create SlotSelection component
    - Fetch available slots from API
    - Display deadline countdown timer (24 hours)
    - Render SlotCard components for each available slot
    - Implement slot selection (radio button behavior)
    - Add "Confirm This Slot" button
    - Handle slot confirmation API call
    - Display success message with calendar invite info
    - Add "None of these work for me" button to trigger negotiation
    - Handle no slots available scenario
    - _Requirements: 2.5 (US-14), 3.1 (FR-3)_
  
  - [ ] 10.2 Create SlotCard shared component
    - Display slot date, time, and duration
    - Implement selected state styling
    - Add click handler for selection
    - Show checkmark icon when selected
    - _Requirements: 2.5 (US-14)_
  
  - [ ] 10.3 Implement countdown timer logic
    - Calculate time remaining until deadline
    - Update every minute
    - Display in human-readable format (Xh Ym)
    - Show "Expired" when deadline passed
    - _Requirements: 2.5 (US-14)_
  
  - [ ]* 10.4 Write unit tests for SlotSelection
    - Test slot selection behavior
    - Test countdown timer calculations
    - Test confirmation flow
    - Test no slots scenario
    - _Requirements: 2.5 (US-14)_

- [ ] 11. Phase 2: Enhanced application tracking (Core Features)
  - [ ] 11.1 Enhance MyApplications component
    - Update API call to include interview data
    - Add interview status section to application cards
    - Display interview action buttons for invitation_sent status
    - Show slot selection prompt for accepted status
    - Display scheduled interview details for confirmed status
    - Add navigation to interview acceptance/rejection pages
    - Add navigation to slot selection page
    - _Requirements: 2.6 (US-16)_
  
  - [ ]* 11.2 Write unit tests for MyApplications enhancements
    - Test interview status display for different states
    - Test action button visibility logic
    - Test navigation to interview pages
    - _Requirements: 2.6 (US-16)_

- [ ] 12. Phase 2: Activity log component (Core Features)
  - [ ] 12.1 Create ActivityLog component
    - Fetch activity log from API with pagination
    - Display log entries in table format (timestamp, action, candidate, outcome)
    - Add filter dropdown for action type
    - Add date range picker for filtering
    - Implement pagination (50 items per page)
    - Add auto-refresh toggle checkbox
    - Implement polling logic (30 second interval)
    - Pause polling when tab is inactive (visibility API)
    - Add icons and color coding for different action types
    - _Requirements: 2.4 (US-9), 3.1 (FR-2)_
  
  - [ ] 12.2 Create LogRow component
    - Display log entry data with formatting
    - Apply action-type specific styling and icons
    - Format timestamp in readable format
    - _Requirements: 2.4 (US-9)_
  
  - [ ]* 12.3 Write unit tests for ActivityLog
    - Test filtering functionality
    - Test pagination controls
    - Test auto-refresh toggle
    - Test polling logic
    - _Requirements: 2.4 (US-9)_

- [ ] 13. Checkpoint - Phase 2 complete
  - Test interview acceptance and rejection flows
  - Test slot selection with countdown timer
  - Test enhanced application tracking display
  - Test activity log with auto-refresh
  - Ensure all tests pass, ask the user if questions arise

- [ ] 14. Phase 3: Analytics component (Polish)
  - [ ] 14.1 Create Analytics component
    - Fetch analytics data from API
    - Display MetricCard components for key metrics (time saved, success rate, avg time to interview, buffer health)
    - Show time saved breakdown
    - Display conversion funnel data
    - Show additional metrics (response rate, no-show rate, avg negotiation rounds)
    - Add "Export Data (CSV)" button
    - Handle loading state
    - _Requirements: 2.4 (US-10), 3.1 (FR-2)_
  
  - [ ] 14.2 Create MetricCard shared component
    - Display title, value, and icon
    - Support trend indicators (up/down arrows with percentage)
    - Support color coding
    - Display breakdown data if provided
    - _Requirements: 2.4 (US-10)_
  
  - [ ]* 14.3 Write unit tests for Analytics
    - Test metric display with different data
    - Test trend indicators
    - Test export functionality
    - _Requirements: 2.4 (US-10)_

- [ ] 15. Phase 3: Negotiation chat component (Polish)
  - [ ] 15.1 Create NegotiationChat component
    - Fetch negotiation history from API
    - Display chat messages with sender distinction (user/bot)
    - Show rounds indicator (current round / max rounds)
    - Implement chat input textarea (max 500 chars)
    - Add "Send" button with loading state
    - Handle message sending to API
    - Display typing indicator while bot responds
    - Show escalation notice when max rounds exceeded
    - Disable input when session escalated
    - _Requirements: 2.5 (US-15), 3.1 (FR-3)_
  
  - [ ] 15.2 Create ChatMessage component
    - Display message content with timestamp
    - Apply different styling for user vs bot messages
    - Position messages appropriately (left/right)
    - _Requirements: 2.5 (US-15)_
  
  - [ ] 15.3 Create TypingIndicator component
    - Display animated typing indicator
    - Show "Bot is typing..." message
    - _Requirements: 2.5 (US-15)_
  
  - [ ]* 15.4 Write unit tests for NegotiationChat
    - Test message display and sending
    - Test rounds tracking
    - Test escalation behavior
    - _Requirements: 2.5 (US-15)_

- [ ] 16. Phase 3: Shared components (Polish)
  - [ ] 16.1 Create StatusBadge component
    - Implement status-to-color mapping for application and interview statuses
    - Support size variants (small, medium, large)
    - Apply appropriate styling and colors
    - _Requirements: 2.2 (US-3), 2.6 (US-16)_
  
  - [ ] 16.2 Create CandidateCard component
    - Display candidate header with name and status badge
    - Show candidate metrics (rank, fit_score)
    - Display interview status
    - Add optional action buttons
    - Implement click handler
    - _Requirements: 2.2 (US-3)_
  
  - [ ] 16.3 Create ConfirmDialog component
    - Create reusable modal for confirmations
    - Support title, message, and button text customization
    - Support variants (danger, warning, info)
    - Implement confirm and cancel handlers
    - _Requirements: 2.3 (US-7)_
  
  - [ ] 16.4 Create FilterDropdown component
    - Reusable dropdown for filtering
    - Support label and options
    - Handle value changes
    - _Requirements: 2.2 (US-4), 2.4 (US-9)_
  
  - [ ] 16.5 Create Pagination component
    - Display page numbers and navigation controls
    - Handle page change events
    - Show total count and current range
    - Disable buttons at boundaries
    - _Requirements: 2.2 (US-3), 2.4 (US-9)_
  
  - [ ]* 16.6 Write unit tests for shared components
    - Test StatusBadge color mapping
    - Test CandidateCard display and interactions
    - Test ConfirmDialog variants
    - Test FilterDropdown and Pagination
    - _Requirements: 2.2, 2.3, 2.4_

- [ ] 17. Phase 3: Error handling and loading states (Polish)
  - [ ] 17.1 Implement global error handling
    - Enhance axios interceptor with user-friendly error messages
    - Map error codes to readable messages
    - Handle network errors gracefully
    - _Requirements: 3.3 (FR-5), 4.3 (NFR-5)_
  
  - [ ] 17.2 Add loading states to all components
    - Implement LoadingSpinner for full-page loads
    - Add skeleton loaders for candidate list
    - Add button loading states (disabled + spinner)
    - Implement progress indicators for multi-step flows
    - _Requirements: 3.4 (FR-6), 4.1 (NFR-1)_
  
  - [ ] 17.3 Implement error boundaries
    - Create ErrorBoundary component for React error catching
    - Display fallback UI on component errors
    - Log errors for debugging
    - _Requirements: 4.3 (NFR-5)_
  
  - [ ]* 17.4 Write unit tests for error handling
    - Test error message mapping
    - Test error boundary fallback
    - Test loading state transitions
    - _Requirements: 3.3 (FR-5), 4.3 (NFR-5)_

- [ ] 18. Routing and navigation setup
  - [ ] 18.1 Update App.jsx with new routes
    - Add dashboard routes (/dashboard, /dashboard/:jobId)
    - Add interview routes (accept, reject, select-slot, negotiate)
    - Implement ProtectedRoute wrapper for role-based access
    - Add lazy loading for code splitting
    - _Requirements: 2.1-2.6, 4.2 (NFR-3)_
  
  - [ ] 18.2 Update navigation components
    - Add dashboard link to recruiter navigation
    - Update existing navigation to support new routes
    - _Requirements: 4.1 (NFR-1)_
  
  - [ ]* 18.3 Write integration tests for routing
    - Test protected route access control
    - Test navigation between pages
    - Test lazy loading behavior
    - _Requirements: 4.2 (NFR-3)_

- [ ] 19. Performance optimizations
  - [ ] 19.1 Implement caching strategy
    - Cache job list for 5 minutes
    - Cache analytics data for 2 minutes
    - Invalidate cache on user actions
    - _Requirements: 3.4 (FR-7)_
  
  - [ ] 19.2 Optimize polling behavior
    - Use visibility API to pause polling when tab inactive
    - Implement exponential backoff for failed requests
    - Add cleanup for polling intervals on unmount
    - _Requirements: 3.4 (FR-6)_
  
  - [ ] 19.3 Implement code splitting
    - Lazy load dashboard components
    - Lazy load interview components
    - Optimize bundle size
    - _Requirements: 3.4 (FR-6)_

- [ ] 20. Final integration and testing
  - [ ] 20.1 Integration testing
    - Test complete recruiter flow (post job → dashboard → automation → monitoring)
    - Test complete candidate flow (apply → interview invitation → slot selection)
    - Test error scenarios (expired tokens, network failures)
    - _Requirements: 8.1, 8.2_
  
  - [ ] 20.2 Cross-browser testing
    - Test on Chrome, Firefox, Safari, Edge (latest 2 versions)
    - Verify responsive behavior on different screen sizes
    - Test keyboard navigation and accessibility
    - _Requirements: 5.2, 4.1 (NFR-2)_
  
  - [ ] 20.3 Performance validation
    - Verify page load times < 2 seconds
    - Verify API response times < 1 second
    - Test with large datasets (100+ applications)
    - _Requirements: 3.4 (FR-6, FR-7)_

- [ ] 21. Final checkpoint - Ensure all tests pass
  - Verify all components render without errors
  - Verify all API integrations work correctly
  - Verify all user flows complete successfully
  - Verify error handling works as expected
  - Verify performance meets requirements
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Backend APIs are already implemented - no backend changes needed
- Focus on minimal viable implementation following existing code patterns
- Reuse existing components where possible (LoadingSpinner, ErrorMessage, etc.)
- All components should follow existing styling conventions
- Checkpoints ensure incremental validation at phase boundaries
- Phase 1 is the critical path and should be prioritized
- Testing tasks validate correctness but are optional for initial MVP
