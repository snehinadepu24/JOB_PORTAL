# MVP Frontend Completion - Design

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Recruiter  │  │  Candidate   │  │    Public    │     │
│  │     Pages    │  │    Pages     │  │    Pages     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                 │                  │              │
│  ┌──────────────────────────────────────────────────┐     │
│  │         Shared Components & Utilities             │     │
│  └──────────────────────────────────────────────────┘     │
│         │                                                    │
│  ┌──────────────────────────────────────────────────┐     │
│  │         State Management (Context API)            │     │
│  └──────────────────────────────────────────────────┘     │
│         │                                                    │
│  ┌──────────────────────────────────────────────────┐     │
│  │         API Service Layer (Axios)                 │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Node.js/Express)               │
├─────────────────────────────────────────────────────────────┤
│  Existing: Auth, Jobs, Applications, Dashboard               │
│  New: Interview Actions, Automation Triggers                 │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Hierarchy

```
App
├── Layout
│   ├── Header (existing)
│   ├── Navigation (existing)
│   └── Footer (existing)
├── Routes
│   ├── Public Routes
│   │   ├── Login (existing)
│   │   ├── Register (existing)
│   │   └── Jobs List (existing)
│   ├── Recruiter Routes (Protected)
│   │   ├── Dashboard (NEW)
│   │   │   ├── JobSelector
│   │   │   ├── ShortlistSummary (NEW)
│   │   │   ├── CandidateList (NEW)
│   │   │   ├── ActivityLog (NEW)
│   │   │   └── Analytics (NEW)
│   │   ├── PostJob (ENHANCED)
│   │   └── MyJobs (existing)
│   └── Candidate Routes (Protected)
│       ├── MyApplications (ENHANCED)
│       ├── InterviewAccept (NEW)
│       ├── InterviewReject (NEW)
│       ├── SlotSelection (NEW)
│       └── NegotiationChat (NEW)
└── Shared Components
    ├── CandidateCard (NEW)
    ├── StatusBadge (NEW)
    ├── LoadingSpinner (existing)
    ├── ErrorMessage (existing)
    └── ConfirmDialog (NEW)
```

## 2. Frontend Architecture Details

### 2.1 State Management Strategy

**Context API Structure:**


```javascript
// contexts/AuthContext.js (existing)
- user, isAuthenticated, login, logout, register

// contexts/JobContext.js (NEW)
- selectedJob, setSelectedJob
- jobDetails, fetchJobDetails
- closeApplications, startAutomation

// contexts/DashboardContext.js (NEW)
- candidates, fetchCandidates
- activityLog, fetchActivityLog
- analytics, fetchAnalytics
- filters, setFilters
- polling state management
```

**State Flow:**
1. User authenticates → AuthContext stores user/role
2. Recruiter selects job → JobContext stores selectedJob
3. Dashboard components consume DashboardContext
4. Polling updates refresh DashboardContext every 30s

### 2.2 Routing Structure

```javascript
// App.jsx routes
<Routes>
  {/* Public Routes */}
  <Route path="/" element={<Home />} />
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route path="/jobs" element={<Jobs />} />
  
  {/* Recruiter Protected Routes */}
  <Route element={<ProtectedRoute role="Employer" />}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/dashboard/:jobId" element={<Dashboard />} />
    <Route path="/post-job" element={<PostJob />} />
    <Route path="/my-jobs" element={<MyJobs />} />
  </Route>
  
  {/* Candidate Protected Routes */}
  <Route element={<ProtectedRoute role="Job Seeker" />}>
    <Route path="/my-applications" element={<MyApplications />} />
    <Route path="/apply/:jobId" element={<Application />} />
  </Route>
  
  {/* Interview Routes (Token-based, no auth required) */}
  <Route path="/interview/accept/:interviewId/:token" 
         element={<InterviewAccept />} />
  <Route path="/interview/reject/:interviewId/:token" 
         element={<InterviewReject />} />
  <Route path="/interview/select-slot/:interviewId" 
         element={<SlotSelection />} />
  <Route path="/interview/negotiate/:interviewId/:sessionId" 
         element={<NegotiationChat />} />
</Routes>
```

### 2.3 API Service Layer

```javascript
// services/api.js
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

// Axios instance with interceptors
const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // Include cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor (add auth token if needed)
apiClient.interceptors.request.use(config => {
  // Token is in httpOnly cookie, no need to add manually
  return config;
});

// Response interceptor (handle errors globally)
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

## 3. Component Specifications

### 3.1 Recruiter Dashboard Components

#### 3.1.1 Dashboard Layout (NEW)


**File:** `frontend/src/components/Dashboard/Dashboard.jsx`

**Purpose:** Main dashboard container with job selector and tabbed interface

**Props:** None (uses route params and context)

**State:**
- `activeTab`: string ('candidates' | 'activity' | 'analytics')
- `loading`: boolean
- `error`: string | null

**Structure:**
```jsx
<div className="dashboard-container">
  <JobSelector />
  <ShortlistSummary />
  <Tabs activeTab={activeTab} onChange={setActiveTab}>
    <Tab label="Candidates" value="candidates">
      <CandidateList />
    </Tab>
    <Tab label="Activity Log" value="activity">
      <ActivityLog />
    </Tab>
    <Tab label="Analytics" value="analytics">
      <Analytics />
    </Tab>
  </Tabs>
</div>
```

**API Calls:**
- GET `/api/jobs/:jobId` - Fetch job details
- GET `/api/jobs/:jobId/shortlist-status` - Fetch shortlist summary

#### 3.1.2 JobSelector Component (NEW)

**File:** `frontend/src/components/Dashboard/JobSelector.jsx`

**Purpose:** Dropdown to select which job to view in dashboard

**Props:**
- `selectedJobId`: string
- `onJobChange`: (jobId: string) => void

**State:**
- `jobs`: array of job objects
- `loading`: boolean

**Structure:**
```jsx
<div className="job-selector">
  <label>Select Job:</label>
  <select value={selectedJobId} onChange={handleChange}>
    {jobs.map(job => (
      <option key={job.id} value={job.id}>
        {job.title} ({job.applications_count} applications)
      </option>
    ))}
  </select>
</div>
```

**API Calls:**
- GET `/api/jobs/getmyjobs` - Fetch recruiter's jobs

#### 3.1.3 ShortlistSummary Component (NEW)

**File:** `frontend/src/components/Dashboard/ShortlistSummary.jsx`

**Purpose:** Display shortlisting status and automation controls

**Props:**
- `jobId`: string

**State:**
- `summary`: object with counts and status
- `loading`: boolean
- `automationRunning`: boolean

**Structure:**
```jsx
<div className="shortlist-summary">
  <div className="summary-stats">
    <StatCard 
      label="Shortlisted" 
      value={`${summary.shortlisted} / ${summary.target}`}
      color="green"
    />
    <StatCard 
      label="Buffer" 
      value={`${summary.buffer} / ${summary.bufferTarget}`}
      color="yellow"
    />
    <StatCard 
      label="Pending" 
      value={summary.pending}
      color="gray"
    />
    <BufferHealthIndicator status={summary.bufferHealth} />
  </div>
  
  <div className="automation-controls">
    {!summary.applicationsClosed && (
      <button onClick={handleCloseApplications}>
        Close Applications
      </button>
    )}
    {summary.applicationsClosed && !summary.automationStarted && (
      <button onClick={handleStartAutomation} disabled={automationRunning}>
        {automationRunning ? 'Starting...' : 'Start Automation'}
      </button>
    )}
    {summary.automationStarted && (
      <span className="badge badge-success">Automation Active</span>
    )}
  </div>
</div>
```

**API Calls:**
- GET `/api/jobs/:jobId/shortlist-status`
- POST `/api/jobs/:jobId/close-applications`
- POST `/api/jobs/:jobId/start-automation`

#### 3.1.4 CandidateList Component (NEW)

**File:** `frontend/src/components/Dashboard/CandidateList.jsx`

**Purpose:** Display ranked list of candidates with filtering and sorting

**Props:**
- `jobId`: string

**State:**
- `candidates`: array
- `filters`: object { status: string, sortBy: string, sortOrder: string }
- `pagination`: object { page: number, limit: number, total: number }
- `selectedCandidate`: object | null
- `loading`: boolean

**Structure:**
```jsx
<div className="candidate-list">
  <div className="filters">
    <FilterDropdown 
      label="Status"
      value={filters.status}
      options={['all', 'shortlisted', 'buffer', 'pending', 'rejected']}
      onChange={handleStatusFilter}
    />
    <SortDropdown
      value={filters.sortBy}
      options={['fit_score', 'rank', 'name', 'created_at']}
      onChange={handleSort}
    />
    <button onClick={clearFilters}>Clear Filters</button>
  </div>
  
  <div className="candidate-table">
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Fit Score</th>
          <th>Status</th>
          <th>Interview Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map(candidate => (
          <CandidateRow 
            key={candidate.id}
            candidate={candidate}
            onClick={() => setSelectedCandidate(candidate)}
          />
        ))}
      </tbody>
    </table>
  </div>
  
  <Pagination 
    page={pagination.page}
    total={pagination.total}
    limit={pagination.limit}
    onPageChange={handlePageChange}
  />
  
  {selectedCandidate && (
    <CandidateDetailModal
      candidate={selectedCandidate}
      onClose={() => setSelectedCandidate(null)}
    />
  )}
</div>
```

**API Calls:**
- GET `/api/dashboard/:jobId/candidates?sortBy=&sortOrder=&filterStatus=&page=&limit=`


#### 3.1.5 ActivityLog Component (NEW)

**File:** `frontend/src/components/Dashboard/ActivityLog.jsx`

**Purpose:** Display automation activity log with filtering

**Props:**
- `jobId`: string

**State:**
- `logs`: array
- `filters`: object { actionType: string, startDate: string, endDate: string }
- `pagination`: object
- `loading`: boolean
- `autoRefresh`: boolean

**Structure:**
```jsx
<div className="activity-log">
  <div className="log-header">
    <h3>Automation Activity</h3>
    <div className="controls">
      <label>
        <input 
          type="checkbox" 
          checked={autoRefresh}
          onChange={toggleAutoRefresh}
        />
        Auto-refresh (30s)
      </label>
    </div>
  </div>
  
  <div className="log-filters">
    <FilterDropdown
      label="Action Type"
      value={filters.actionType}
      options={actionTypes}
      onChange={handleActionTypeFilter}
    />
    <DateRangePicker
      startDate={filters.startDate}
      endDate={filters.endDate}
      onChange={handleDateRangeChange}
    />
  </div>
  
  <div className="log-table">
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Action</th>
          <th>Candidate</th>
          <th>Outcome</th>
        </tr>
      </thead>
      <tbody>
        {logs.map(log => (
          <LogRow key={log.id} log={log} />
        ))}
      </tbody>
    </table>
  </div>
  
  <Pagination {...pagination} onPageChange={handlePageChange} />
</div>
```

**API Calls:**
- GET `/api/dashboard/:jobId/activity?action_type=&startDate=&endDate=&limit=&offset=`

**Polling Logic:**
```javascript
useEffect(() => {
  if (autoRefresh) {
    const interval = setInterval(() => {
      fetchActivityLog();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }
}, [autoRefresh]);
```

#### 3.1.6 Analytics Component (NEW)

**File:** `frontend/src/components/Dashboard/Analytics.jsx`

**Purpose:** Display automation performance metrics

**Props:**
- `jobId`: string

**State:**
- `analytics`: object with all metrics
- `loading`: boolean

**Structure:**
```jsx
<div className="analytics-dashboard">
  <div className="metrics-grid">
    <MetricCard
      title="Time Saved"
      value={`${analytics.time_saved_hours} hours`}
      breakdown={analytics.time_saved_breakdown}
      icon="clock"
    />
    <MetricCard
      title="Success Rate"
      value={`${analytics.automation_success_rate}%`}
      trend={analytics.trends.success_rate_change}
      icon="check-circle"
    />
    <MetricCard
      title="Avg Time to Interview"
      value={`${analytics.average_time_to_interview_days} days`}
      distribution={analytics.time_to_interview_distribution}
      icon="calendar"
    />
    <MetricCard
      title="Buffer Health"
      value={analytics.buffer_health.status}
      color={analytics.buffer_health.color}
      percentage={analytics.buffer_health.percentage}
      icon="layers"
    />
  </div>
  
  <div className="charts-section">
    <ConversionFunnelChart data={analytics.conversion_funnel} />
    <TrendChart data={analytics.trends} />
  </div>
  
  <div className="detailed-metrics">
    <h4>Additional Metrics</h4>
    <ul>
      <li>Response Rate: {analytics.response_rate}%</li>
      <li>No-Show Rate: {analytics.no_show_rate}%</li>
      <li>Avg Negotiation Rounds: {analytics.average_negotiation_rounds}</li>
    </ul>
  </div>
  
  <button onClick={handleExport} className="export-btn">
    Export Data (CSV)
  </button>
</div>
```

**API Calls:**
- GET `/api/dashboard/:jobId/analytics`

### 3.2 Enhanced Job Posting Component

#### 3.2.1 PostJob Component (ENHANCED)

**File:** `frontend/src/components/Job/PostJob.jsx`

**Enhancements:**
- Add `numberOfOpenings` field
- Display calculated `shortlistingBuffer`
- Show automation settings preview

**New Fields:**
```jsx
<div className="form-group">
  <label htmlFor="numberOfOpenings">
    Number of Open Positions *
    <Tooltip text="How many candidates do you want to hire?" />
  </label>
  <input
    type="number"
    id="numberOfOpenings"
    min="1"
    max="100"
    value={formData.numberOfOpenings}
    onChange={handleNumberOfOpeningsChange}
    required
  />
  <small className="help-text">
    Buffer size will be: {calculateBuffer(formData.numberOfOpenings)} candidates
  </small>
</div>

<div className="automation-preview">
  <h4>Automation Settings</h4>
  <ul>
    <li>Shortlist: Top {formData.numberOfOpenings} candidates</li>
    <li>Buffer: Next {calculateBuffer(formData.numberOfOpenings)} candidates</li>
    <li>Confirmation Deadline: 48 hours</li>
    <li>Auto-promotion: Enabled</li>
  </ul>
</div>
```

**Buffer Calculation Logic:**
```javascript
const calculateBuffer = (openings) => {
  if (openings === 1) return 4;
  if (openings >= 2 && openings <= 5) return openings * 3;
  if (openings > 5) return openings * 2;
  return openings;
};
```

### 3.3 Candidate Interview Components

#### 3.3.1 InterviewAccept Component (NEW)

**File:** `frontend/src/components/Interview/InterviewAccept.jsx`

**Purpose:** Handle interview invitation acceptance

**Props:** None (uses route params)

**State:**
- `interview`: object
- `loading`: boolean
- `error`: string | null
- `tokenValid`: boolean
- `accepted`: boolean

**Structure:**
```jsx
<div className="interview-accept-page">
  {loading && <LoadingSpinner />}
  
  {error && (
    <ErrorMessage 
      message={error}
      contactInfo="Please contact the recruiter for assistance"
    />
  )}
  
  {tokenValid && !accepted && (
    <div className="accept-form">
      <h2>Interview Invitation</h2>
      <div className="job-details">
        <h3>{interview.job_title}</h3>
        <p>Company: {interview.company_name}</p>
        <p>Deadline: {formatDate(interview.confirmation_deadline)}</p>
      </div>
      
      <div className="next-steps">
        <h4>Next Steps:</h4>
        <ol>
          <li>Confirm your acceptance</li>
          <li>Select your preferred interview time</li>
          <li>Receive calendar invitation</li>
        </ol>
      </div>
      
      <button 
        onClick={handleAccept}
        className="btn btn-primary btn-lg"
      >
        Confirm Acceptance
      </button>
    </div>
  )}
  
  {accepted && (
    <SuccessMessage 
      message="Interview accepted! Redirecting to slot selection..."
    />
  )}
</div>
```

**API Calls:**
- POST `/api/interviews/:interviewId/accept/:token`

**Flow:**
1. Component mounts → validate token
2. If valid → show acceptance form
3. User clicks confirm → POST to API
4. On success → redirect to slot selection


#### 3.3.2 InterviewReject Component (NEW)

**File:** `frontend/src/components/Interview/InterviewReject.jsx`

**Purpose:** Handle interview invitation rejection

**Props:** None (uses route params)

**State:**
- `interview`: object
- `feedback`: string
- `loading`: boolean
- `error`: string | null
- `tokenValid`: boolean
- `rejected`: boolean

**Structure:**
```jsx
<div className="interview-reject-page">
  {loading && <LoadingSpinner />}
  
  {error && <ErrorMessage message={error} />}
  
  {tokenValid && !rejected && (
    <div className="reject-form">
      <h2>Decline Interview</h2>
      <p>We're sorry to hear you won't be able to interview for this position.</p>
      
      <div className="feedback-section">
        <label htmlFor="feedback">
          Would you like to share why? (Optional)
        </label>
        <textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Your feedback helps us improve..."
          rows="4"
          maxLength="500"
        />
      </div>
      
      <button 
        onClick={handleReject}
        className="btn btn-secondary"
      >
        Confirm Rejection
      </button>
    </div>
  )}
  
  {rejected && (
    <div className="thank-you-message">
      <h3>Thank you for your response</h3>
      <p>We appreciate you letting us know. Best of luck in your job search!</p>
    </div>
  )}
</div>
```

**API Calls:**
- POST `/api/interviews/:interviewId/reject/:token`

#### 3.3.3 SlotSelection Component (NEW)

**File:** `frontend/src/components/Interview/SlotSelection.jsx`

**Purpose:** Display available slots and handle selection

**Props:** None (uses route params)

**State:**
- `slots`: array of available time slots
- `selectedSlot`: object | null
- `loading`: boolean
- `confirming`: boolean
- `error`: string | null
- `deadline`: Date
- `timeRemaining`: string

**Structure:**
```jsx
<div className="slot-selection-page">
  <div className="deadline-banner">
    <span className="icon">⏰</span>
    <span>Please select a slot within: {timeRemaining}</span>
  </div>
  
  <h2>Select Your Interview Time</h2>
  
  {loading && <LoadingSpinner />}
  
  {!loading && slots.length > 0 && (
    <div className="slots-container">
      {slots.map(slot => (
        <SlotCard
          key={slot.id}
          slot={slot}
          selected={selectedSlot?.id === slot.id}
          onClick={() => setSelectedSlot(slot)}
        />
      ))}
    </div>
  )}
  
  {!loading && slots.length === 0 && (
    <div className="no-slots">
      <p>No available slots found.</p>
      <button onClick={handleNegotiate}>
        Request Alternative Times
      </button>
    </div>
  )}
  
  {selectedSlot && (
    <div className="confirmation-section">
      <button 
        onClick={handleConfirm}
        disabled={confirming}
        className="btn btn-primary btn-lg"
      >
        {confirming ? 'Confirming...' : 'Confirm This Slot'}
      </button>
    </div>
  )}
  
  <button 
    onClick={handleNegotiate}
    className="btn btn-link"
  >
    None of these work for me
  </button>
</div>
```

**API Calls:**
- GET `/api/interviews/:interviewId/slots`
- POST `/api/interviews/:interviewId/confirm-slot`

**Countdown Timer Logic:**
```javascript
useEffect(() => {
  const interval = setInterval(() => {
    const now = new Date();
    const diff = new Date(deadline) - now;
    
    if (diff <= 0) {
      setTimeRemaining('Expired');
      clearInterval(interval);
    } else {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`${hours}h ${minutes}m`);
    }
  }, 60000); // Update every minute
  
  return () => clearInterval(interval);
}, [deadline]);
```


#### 3.3.4 NegotiationChat Component (NEW)

**File:** `frontend/src/components/Interview/NegotiationChat.jsx`

**Purpose:** Chat interface for negotiating interview times when no slots match

**Props:** None (uses route params)

**State:**
- `messages`: array of chat messages
- `inputText`: string
- `sending`: boolean
- `sessionActive`: boolean
- `negotiationRounds`: number
- `maxRounds`: number (default: 5)
- `escalated`: boolean

**Structure:**
```jsx
<div className="negotiation-chat-page">
  <div className="chat-header">
    <h2>Schedule Your Interview</h2>
    <p>Let's find a time that works for both of us</p>
    <div className="rounds-indicator">
      Round {negotiationRounds} of {maxRounds}
    </div>
  </div>
  
  <div className="chat-messages">
    {messages.map(msg => (
      <ChatMessage
        key={msg.id}
        message={msg}
        isBot={msg.sender === 'bot'}
      />
    ))}
    {sending && <TypingIndicator />}
  </div>
  
  {sessionActive && !escalated && (
    <div className="chat-input">
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Share your availability (e.g., 'I'm free Monday 2-4pm or Tuesday morning')"
        rows="3"
      />
      <button 
        onClick={handleSend}
        disabled={sending || !inputText.trim()}
      >
        Send
      </button>
    </div>
  )}
  
  {escalated && (
    <div className="escalation-notice">
      <h3>Escalated to Recruiter</h3>
      <p>The recruiter will contact you directly to schedule your interview.</p>
    </div>
  )}
</div>
```

**API Calls:**
- GET `/api/interviews/:interviewId/negotiation/:sessionId` - Get chat history
- POST `/api/interviews/:interviewId/negotiation/:sessionId/message` - Send message

**Message Flow:**
1. User sends availability message
2. Backend processes with NegotiationBot
3. Bot responds with matched slots or follow-up questions
4. If max rounds exceeded → escalate to recruiter

#### 3.3.5 MyApplications Component (ENHANCED)

**File:** `frontend/src/components/Application/MyApplications.jsx`

**Enhancements:**
- Display interview status for each application
- Show action buttons for pending interviews
- Display scheduled interview details

**New Fields in Application Card:**
```jsx
<div className="application-card">
  {/* Existing fields: job title, company, applied date, status */}
  
  {/* NEW: Interview Status Section */}
  {application.interview_status && (
    <div className="interview-status-section">
      <h4>Interview Status</h4>
      <StatusBadge status={application.interview_status} />
      
      {application.interview_status === 'invitation_sent' && (
        <div className="interview-actions">
          <button 
            onClick={() => handleAccept(application.interview_id)}
            className="btn btn-success"
          >
            Accept Interview
          </button>
          <button 
            onClick={() => handleReject(application.interview_id)}
            className="btn btn-secondary"
          >
            Decline
          </button>
          <p className="deadline-text">
            Respond by: {formatDate(application.confirmation_deadline)}
          </p>
        </div>
      )}
      
      {application.interview_status === 'accepted' && (
        <div className="slot-selection-prompt">
          <p>Please select your interview time</p>
          <button 
            onClick={() => navigateToSlotSelection(application.interview_id)}
            className="btn btn-primary"
          >
            Select Time Slot
          </button>
        </div>
      )}
      
      {application.interview_status === 'confirmed' && (
        <div className="interview-details">
          <p><strong>Scheduled:</strong> {formatDateTime(application.interview_time)}</p>
          <p><strong>Duration:</strong> {application.interview_duration} minutes</p>
          {application.meeting_link && (
            <a href={application.meeting_link} target="_blank" rel="noopener noreferrer">
              Join Meeting
            </a>
          )}
        </div>
      )}
    </div>
  )}
</div>
```

**API Calls:**
- GET `/api/applications/myapplications` - Enhanced to include interview data

### 3.4 Shared Components

#### 3.4.1 StatusBadge Component (NEW)

**File:** `frontend/src/components/Shared/StatusBadge.jsx`

**Purpose:** Display color-coded status badges

**Props:**
- `status`: string (application or interview status)
- `size`: 'small' | 'medium' | 'large'

**Status Color Mapping:**
```javascript
const statusColors = {
  // Application statuses
  'pending_ai_processing': 'gray',
  'processed': 'blue',
  'shortlisted': 'green',
  'buffer': 'yellow',
  'rejected': 'red',
  
  // Interview statuses
  'invitation_sent': 'blue',
  'accepted': 'green',
  'rejected': 'red',
  'confirmed': 'green',
  'negotiating': 'yellow',
  'escalated': 'orange',
  'completed': 'gray'
};
```

#### 3.4.2 CandidateCard Component (NEW)

**File:** `frontend/src/components/Shared/CandidateCard.jsx`

**Purpose:** Display candidate information in dashboard

**Props:**
- `candidate`: object
- `onClick`: function
- `showActions`: boolean

**Structure:**
```jsx
<div className="candidate-card" onClick={onClick}>
  <div className="candidate-header">
    <h4>{candidate.name}</h4>
    <StatusBadge status={candidate.status} />
  </div>
  
  <div className="candidate-metrics">
    <div className="metric">
      <label>Rank:</label>
      <span>#{candidate.rank}</span>
    </div>
    <div className="metric">
      <label>Fit Score:</label>
      <span>{candidate.fit_score}%</span>
    </div>
  </div>
  
  <div className="candidate-interview">
    <label>Interview:</label>
    <StatusBadge status={candidate.interview_status} size="small" />
  </div>
  
  {showActions && (
    <div className="candidate-actions">
      <button onClick={(e) => handleViewDetails(e, candidate)}>
        View Details
      </button>
    </div>
  )}
</div>
```

#### 3.4.3 ConfirmDialog Component (NEW)

**File:** `frontend/src/components/Shared/ConfirmDialog.jsx`

**Purpose:** Reusable confirmation modal

**Props:**
- `isOpen`: boolean
- `title`: string
- `message`: string
- `onConfirm`: function
- `onCancel`: function
- `confirmText`: string (default: 'Confirm')
- `cancelText`: string (default: 'Cancel')
- `variant`: 'danger' | 'warning' | 'info'

#### 3.4.4 SlotCard Component (NEW)

**File:** `frontend/src/components/Shared/SlotCard.jsx`

**Purpose:** Display interview time slot option

**Props:**
- `slot`: object { start_time, end_time, duration }
- `selected`: boolean
- `onClick`: function

**Structure:**
```jsx
<div 
  className={`slot-card ${selected ? 'selected' : ''}`}
  onClick={onClick}
>
  <div className="slot-date">
    {formatDate(slot.start_time)}
  </div>
  <div className="slot-time">
    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
  </div>
  <div className="slot-duration">
    {slot.duration} minutes
  </div>
  {selected && <CheckIcon />}
</div>
```

#### 3.4.5 MetricCard Component (NEW)

**File:** `frontend/src/components/Shared/MetricCard.jsx`

**Purpose:** Display analytics metrics

**Props:**
- `title`: string
- `value`: string | number
- `icon`: string
- `trend`: object { direction: 'up' | 'down', value: number }
- `color`: string

## 4. Data Models & Interfaces

### 4.1 Core Data Types

```typescript
// Job
interface Job {
  id: string;
  title: string;
  description: string;
  required_skills: string[];
  experience_required: number;
  number_of_openings: number;
  shortlist_target: number;
  applications_closed: boolean;
  automation_started: boolean;
  created_at: string;
  applications_count?: number;
}

// Application
interface Application {
  id: string;
  job_id: string;
  user_id: string;
  resume_url: string;
  status: ApplicationStatus;
  fit_score: number;
  rank: number;
  interview_id?: string;
  interview_status?: InterviewStatus;
  created_at: string;
}

type ApplicationStatus = 
  | 'pending_ai_processing'
  | 'processed'
  | 'shortlisted'
  | 'buffer'
  | 'rejected';

// Interview
interface Interview {
  id: string;
  application_id: string;
  status: InterviewStatus;
  confirmation_deadline: string;
  slot_selection_deadline?: string;
  scheduled_time?: string;
  duration?: number;
  meeting_link?: string;
  created_at: string;
}

type InterviewStatus =
  | 'invitation_sent'
  | 'accepted'
  | 'rejected'
  | 'confirmed'
  | 'negotiating'
  | 'escalated'
  | 'completed'
  | 'no_show';

// Candidate (Dashboard view)
interface Candidate {
  id: string;
  name: string;
  email: string;
  application_id: string;
  status: ApplicationStatus;
  fit_score: number;
  rank: number;
  interview_id?: string;
  interview_status?: InterviewStatus;
  matched_skills: string[];
  missing_skills: string[];
}

// Shortlist Summary
interface ShortlistSummary {
  shortlisted: number;
  target: number;
  buffer: number;
  bufferTarget: number;
  pending: number;
  rejected: number;
  bufferHealth: 'healthy' | 'warning' | 'critical';
  applicationsClosed: boolean;
  automationStarted: boolean;
}

// Activity Log Entry
interface ActivityLogEntry {
  id: string;
  timestamp: string;
  action_type: string;
  candidate_name: string;
  outcome: string;
  details?: string;
}

// Analytics
interface Analytics {
  time_saved_hours: number;
  time_saved_breakdown: {
    shortlisting: number;
    scheduling: number;
    follow_ups: number;
  };
  automation_success_rate: number;
  average_time_to_interview_days: number;
  time_to_interview_distribution: {
    '0-2_days': number;
    '3-5_days': number;
    '6+_days': number;
  };
  buffer_health: {
    status: string;
    percentage: number;
    color: string;
  };
  conversion_funnel: {
    applications: number;
    shortlisted: number;
    accepted: number;
    confirmed: number;
  };
  response_rate: number;
  no_show_rate: number;
  average_negotiation_rounds: number;
  trends: {
    success_rate_change: number;
  };
}

// Time Slot
interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  duration: number;
}

// Chat Message
interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  content: string;
  timestamp: string;
}
```

## 5. API Integration

### 5.1 Backend Endpoints (Existing)

```javascript
// Auth
POST /api/user/register
POST /api/user/login
POST /api/user/logout
GET /api/user/getuser

// Jobs
POST /api/job/postjob
GET /api/job/getall
GET /api/job/:id
GET /api/job/getmyjobs

// Applications
POST /api/application/apply/:id
GET /api/application/myapplications
GET /api/application/:id
```

### 5.2 Backend Endpoints (Already Implemented - Need Frontend Integration)

```javascript
// Dashboard
GET /api/dashboard/:jobId/shortlist-status
GET /api/dashboard/:jobId/candidates
GET /api/dashboard/:jobId/activity
GET /api/dashboard/:jobId/analytics

// Job Actions
POST /api/jobs/:jobId/close-applications
POST /api/jobs/:jobId/start-automation

// Interviews
POST /api/interviews/:interviewId/accept/:token
POST /api/interviews/:interviewId/reject/:token
GET /api/interviews/:interviewId/slots
POST /api/interviews/:interviewId/confirm-slot
GET /api/interviews/:interviewId/negotiation/:sessionId
POST /api/interviews/:interviewId/negotiation/:sessionId/message
```

### 5.3 API Service Functions

**File:** `frontend/src/services/dashboardService.js`

```javascript
import apiClient from './api';

export const dashboardService = {
  getShortlistStatus: (jobId) => 
    apiClient.get(`/dashboard/${jobId}/shortlist-status`),
  
  getCandidates: (jobId, params) => 
    apiClient.get(`/dashboard/${jobId}/candidates`, { params }),
  
  getActivityLog: (jobId, params) => 
    apiClient.get(`/dashboard/${jobId}/activity`, { params }),
  
  getAnalytics: (jobId) => 
    apiClient.get(`/dashboard/${jobId}/analytics`),
};
```

**File:** `frontend/src/services/jobService.js`

```javascript
import apiClient from './api';

export const jobService = {
  closeApplications: (jobId) => 
    apiClient.post(`/jobs/${jobId}/close-applications`),
  
  startAutomation: (jobId) => 
    apiClient.post(`/jobs/${jobId}/start-automation`),
  
  postJob: (jobData) => 
    apiClient.post('/job/postjob', jobData),
  
  getMyJobs: () => 
    apiClient.get('/job/getmyjobs'),
};
```

**File:** `frontend/src/services/interviewService.js`

```javascript
import apiClient from './api';

export const interviewService = {
  acceptInterview: (interviewId, token) => 
    apiClient.post(`/interviews/${interviewId}/accept/${token}`),
  
  rejectInterview: (interviewId, token, feedback) => 
    apiClient.post(`/interviews/${interviewId}/reject/${token}`, { feedback }),
  
  getSlots: (interviewId) => 
    apiClient.get(`/interviews/${interviewId}/slots`),
  
  confirmSlot: (interviewId, slotId) => 
    apiClient.post(`/interviews/${interviewId}/confirm-slot`, { slotId }),
  
  getNegotiationHistory: (interviewId, sessionId) => 
    apiClient.get(`/interviews/${interviewId}/negotiation/${sessionId}`),
  
  sendNegotiationMessage: (interviewId, sessionId, message) => 
    apiClient.post(`/interviews/${interviewId}/negotiation/${sessionId}/message`, { message }),
};
```

## 6. Error Handling Strategy

### 6.1 Global Error Handling

**Axios Interceptor (already in api.js):**
- 401 errors → redirect to login
- 403 errors → show "Access Denied" message
- 500 errors → show "Server Error" message
- Network errors → show "Connection Error" message

### 6.2 Component-Level Error Handling

**Pattern:**
```javascript
const [error, setError] = useState(null);
const [loading, setLoading] = useState(false);

const fetchData = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const response = await apiService.getData();
    setData(response.data);
  } catch (err) {
    setError(err.response?.data?.message || 'An error occurred');
  } finally {
    setLoading(false);
  }
};
```

### 6.3 User-Friendly Error Messages

```javascript
const errorMessages = {
  'NETWORK_ERROR': 'Unable to connect. Please check your internet connection.',
  'TOKEN_EXPIRED': 'Your session has expired. Please log in again.',
  'INVALID_TOKEN': 'Invalid or expired link. Please request a new one.',
  'DEADLINE_PASSED': 'The deadline for this action has passed.',
  'NO_SLOTS_AVAILABLE': 'No available time slots. Please try negotiating.',
  'AUTOMATION_ALREADY_STARTED': 'Automation is already running for this job.',
};
```

## 7. Performance Considerations

### 7.1 Optimization Strategies

**Pagination:**
- Candidate list: 20 items per page
- Activity log: 50 items per page
- Lazy load on scroll for better UX

**Polling:**
- Activity log auto-refresh: 30 seconds (configurable)
- Dashboard summary: 30 seconds when automation active
- Use visibility API to pause polling when tab inactive

**Caching:**
- Cache job list for 5 minutes
- Cache analytics data for 2 minutes
- Invalidate cache on user actions

**Code Splitting:**
```javascript
// Lazy load dashboard components
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const InterviewAccept = lazy(() => import('./components/Interview/InterviewAccept'));
```

### 7.2 Loading States

**Skeleton Screens:**
- Use skeleton loaders for candidate list
- Show loading spinners for actions (buttons)
- Display progress indicators for multi-step flows

## 8. Testing Strategy

### 8.1 Component Testing

**Tools:** Jest + React Testing Library

**Test Coverage:**
- Unit tests for all new components
- Integration tests for API service functions
- Mock API responses for predictable testing

**Example Test:**
```javascript
// ShortlistSummary.test.jsx
describe('ShortlistSummary', () => {
  it('displays shortlist counts correctly', () => {
    const summary = {
      shortlisted: 5,
      target: 10,
      buffer: 15,
      bufferTarget: 20
    };
    
    render(<ShortlistSummary jobId="123" summary={summary} />);
    
    expect(screen.getByText('5 / 10')).toBeInTheDocument();
    expect(screen.getByText('15 / 20')).toBeInTheDocument();
  });
  
  it('shows start automation button when conditions met', () => {
    const summary = {
      applicationsClosed: true,
      automationStarted: false
    };
    
    render(<ShortlistSummary jobId="123" summary={summary} />);
    
    expect(screen.getByText('Start Automation')).toBeInTheDocument();
  });
});
```

### 8.2 E2E Testing (Optional for MVP)

**Tools:** Cypress or Playwright

**Critical Flows:**
1. Recruiter posts job → views dashboard → starts automation
2. Candidate applies → receives interview → accepts → selects slot
3. Recruiter monitors activity log and analytics

## 9. Deployment Considerations

### 9.1 Environment Variables

```bash
# .env.production
REACT_APP_API_URL=https://api.production.com
REACT_APP_ENV=production
```

### 9.2 Build Configuration

```javascript
// package.json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

### 9.3 Browser Support

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

## 10. MVP Scope Summary

### 10.1 In Scope

✅ Enhanced job posting with number_of_openings
✅ Recruiter dashboard with job selector
✅ Shortlist summary with automation controls
✅ Candidate list with filtering and sorting
✅ Activity log with auto-refresh
✅ Basic analytics display
✅ Interview acceptance/rejection flow
✅ Slot selection interface
✅ Basic negotiation chat
✅ Enhanced application tracking

### 10.2 Out of Scope (Future Enhancements)

❌ Real-time WebSocket updates
❌ Advanced analytics charts (complex visualizations)
❌ Bulk candidate actions
❌ Mobile-optimized responsive design
❌ Multi-language support
❌ Advanced filtering (date ranges, custom filters)
❌ Export to PDF/Excel
❌ Email template customization
❌ Calendar integration UI
❌ Video interview integration

## 11. Implementation Priority

### Phase 1 (Critical Path)
1. Enhanced PostJob component
2. Dashboard layout and JobSelector
3. ShortlistSummary with automation controls
4. Basic CandidateList

### Phase 2 (Core Features)
5. InterviewAccept/Reject components
6. SlotSelection component
7. Enhanced MyApplications
8. ActivityLog component

### Phase 3 (Polish)
9. Analytics component
10. NegotiationChat component
11. Shared components (StatusBadge, etc.)
12. Error handling and loading states

---

**Design Document Status:** ✅ COMPLETE

**Next Step:** Create tasks.md with implementation tasks
