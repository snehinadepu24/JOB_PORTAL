# Interview Model Implementation Summary

## Task 5.1: Create Interview model and database operations

**Status:** ✅ Completed

**Requirements:** 3.2, 3.3

## Overview

Implemented a comprehensive Interview model with full CRUD operations and robust status transition validation for the AI Hiring Orchestrator system.

## Implementation Details

### File Created
- `backend/models/interviewSchema.js` - Interview model with CRUD operations and validation

### Key Features

#### 1. CRUD Operations
- **Create**: Create new interview records with validation
- **Read**: Multiple query methods (by ID, job, candidate, application, status)
- **Update**: Update with automatic status transition validation
- **Delete**: Remove interview records

#### 2. Status Management
Supports 7 interview statuses:
- `invitation_sent` - Initial state when invitation is sent
- `slot_pending` - Candidate accepted, waiting for slot selection
- `confirmed` - Interview slot confirmed
- `completed` - Interview conducted
- `cancelled` - Interview cancelled
- `no_show` - Candidate didn't attend
- `expired` - Invitation or slot selection deadline passed

#### 3. Status Transition Validation
Enforces valid state transitions:
```
invitation_sent → slot_pending, cancelled, expired
slot_pending → confirmed, expired
confirmed → completed, no_show, cancelled
```

Invalid transitions are automatically rejected with descriptive error messages.

#### 4. Helper Methods

**For Background Scheduler:**
- `getExpiredInterviews()` - Find interviews with expired deadlines
- `getUpcomingInterviews(hours)` - Find interviews scheduled within N hours

**For Queries:**
- `getByJobId(jobId, filters)` - Get all interviews for a job
- `getByCandidateId(candidateId, filters)` - Get all interviews for a candidate
- `getByApplicationId(applicationId)` - Get interview for an application
- `getByStatus(status)` - Get all interviews with specific status

**For Validation:**
- `isValidTransition(currentStatus, newStatus)` - Check if transition is valid
- `getValidStatuses()` - Get all valid status values
- `getValidTransitions(status)` - Get valid next statuses for a given status

#### 5. Data Validation
- Required fields validation (application_id, job_id, recruiter_id, candidate_id, rank_at_time)
- Status value validation
- No-show risk range validation (0-1)
- Status transition validation on updates

## Database Schema

The interviews table was already created in migration `001_add_ai_orchestrator_schema.up.sql` with:
- UUID primary key
- Foreign keys to applications, jobs, users
- Status enum with 7 values
- Timestamps for deadlines and scheduling
- Calendar integration fields
- No-show risk score (0-1)
- Automatic updated_at trigger

## Testing

### Test Files Created
1. `backend/tests/interviewModel.simple.test.js` - Unit tests for validation logic
2. `backend/tests/interviewModel.test.js` - Integration tests (requires test data setup)

### Test Results
✅ All validation tests passed:
- Valid status values (7 statuses)
- Valid transitions (all paths verified)
- Invalid transitions (all rejections verified)
- Transition validation logic (chains, alternatives, invalid jumps)

### Test Coverage
- ✅ Status value validation
- ✅ Valid transition paths
- ✅ Invalid transition rejection
- ✅ Same-status transitions
- ✅ Transition chains
- ✅ Alternative paths
- ✅ Terminal states

## Usage Examples

### Create Interview
```javascript
import { interviewModel } from './models/interviewSchema.js';

const result = await interviewModel.create({
  application_id: 'uuid',
  job_id: 'uuid',
  recruiter_id: 'uuid',
  candidate_id: 'uuid',
  rank_at_time: 1,
  status: 'invitation_sent',
  confirmation_deadline: new Date('2024-01-20T10:00:00Z'),
  no_show_risk: 0.3
});
```

### Update with Status Transition
```javascript
// Valid transition
const result = await interviewModel.update(interviewId, {
  status: 'slot_pending'
});

// Invalid transition - will throw error
try {
  await interviewModel.update(interviewId, {
    status: 'completed' // Can't jump from invitation_sent to completed
  });
} catch (error) {
  console.error(error.message); // "Invalid status transition..."
}
```

### Query Interviews
```javascript
// Get by job
const jobInterviews = await interviewModel.getByJobId(jobId);

// Get by status
const confirmedInterviews = await interviewModel.getByStatus('confirmed');

// Get expired interviews (for background scheduler)
const expired = await interviewModel.getExpiredInterviews();

// Get upcoming interviews (for reminders)
const upcoming = await interviewModel.getUpcomingInterviews(24); // next 24 hours
```

### Check Valid Transitions
```javascript
// Check if transition is valid
const isValid = interviewModel.isValidTransition('invitation_sent', 'slot_pending');
// Returns: true

// Get all valid next statuses
const validNext = interviewModel.getValidTransitions('invitation_sent');
// Returns: ['slot_pending', 'cancelled', 'expired']
```

## Integration Points

### With ShortlistingManager
- Interview creation triggered when candidate is shortlisted
- Status updates trigger buffer promotion on cancellation/expiration

### With Background Scheduler
- `getExpiredInterviews()` used to find interviews needing expiration
- `getUpcomingInterviews()` used to send reminder emails

### With Calendar Integrator
- Stores `calendar_event_id` for Google Calendar events
- Tracks `calendar_sync_method` (google, ics_fallback, manual)

### With Email Service
- Status transitions trigger email notifications
- Reminder emails sent for upcoming interviews

## Design Decisions

1. **Singleton Pattern**: Exported as singleton instance for consistent usage across the application

2. **Validation First**: All validation happens before database operations to provide clear error messages

3. **Status Transition Map**: Used a declarative map for valid transitions rather than complex if/else logic

4. **Helper Methods**: Provided specialized query methods for common use cases (expired, upcoming, by status)

5. **Error Handling**: Comprehensive error handling with descriptive messages for debugging

6. **Supabase Integration**: Uses Supabase client directly (no Mongoose) for PostgreSQL operations

## Next Steps

Task 5.1 is complete. The Interview model is ready for use in:
- Task 5.2: Implement interview invitation flow
- Task 5.3: Implement accept/reject handlers
- Task 10.2: Background scheduler deadline checking

## Files Modified/Created

### Created
- ✅ `backend/models/interviewSchema.js` (Interview model)
- ✅ `backend/tests/interviewModel.simple.test.js` (Unit tests)
- ✅ `backend/tests/interviewModel.test.js` (Integration tests)
- ✅ `backend/models/INTERVIEW_MODEL_SUMMARY.md` (This file)

### Database
- ✅ Table already exists from migration 001_add_ai_orchestrator_schema.up.sql

## Validation Summary

✅ All 7 interview statuses implemented
✅ All valid status transitions enforced
✅ All invalid transitions rejected
✅ CRUD operations implemented
✅ Helper methods for common queries
✅ Validation logic tested and verified
✅ Requirements 3.2 and 3.3 satisfied
