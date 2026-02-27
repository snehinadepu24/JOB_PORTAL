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
