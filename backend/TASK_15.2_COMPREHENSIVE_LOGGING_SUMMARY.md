# Task 15.2: Comprehensive Logging Implementation Summary

## Overview
Implemented comprehensive logging system for all automation actions with enhanced context tracking including trigger_source, actor_id, and detailed JSONB context.

## Implementation Details

### 1. AutomationLogger Utility (`backend/utils/automationLogger.js`)

Created centralized logging utility with the following features:

**Core Logging:**
- `log()` - Create log entries with full context
  - jobId: UUID of the job (nullable for system-wide actions)
  - actionType: Type of action (e.g., "invitation_sent", "buffer_promotion")
  - triggerSource: "auto" | "manual" | "scheduled"
  - actorId: User UUID (null for automated actions)
  - details: JSONB with context (candidate_id, interview_id, reason, etc.)
  - created_at: Timestamp (auto-generated)

**Query Utilities:**
- `getAutomationLogs(jobId, limit, offset)` - Get logs with pagination
- `getAutomationLogsByType(jobId, actionType)` - Filter by action type
- `getRecentAutomationLogs(limit)` - Get recent logs across all jobs
- `getAutomationLogStats(jobId)` - Get statistics (count by action type and trigger source)
- `getLogsForInterview(interviewId)` - Get logs for specific interview
- `getLogsForCandidate(candidateId)` - Get logs for specific candidate
- `getLogsByTimeRange(jobId, startDate, endDate)` - Get logs within time range

### 2. Enhanced Logging in Managers

Updated all managers to use the new AutomationLogger:

**ShortlistingManager:**
- `autoShortlist()` - Logs with shortlisted_count, buffer_count, total_applications
- `promoteFromBuffer()` - Logs with candidate_id, new_rank, previous_rank, reason
- `backfillBuffer()` - Logs with backfilled_count, target_buffer_size, current_buffer_size
- `promotion_blocked` - Logs when promotion is not allowed with reason

**InterviewScheduler:**
- `sendInvitation()` - Logs with interview_id, candidate_id, confirmation_deadline, recruiter_id
- `handleAccept()` - Logs with slot_selection_deadline, status transitions, actor_id (candidate)
- `handleReject()` - Logs with vacated_rank, reason, status transitions, actor_id (candidate)

**BackgroundScheduler:**
- `checkConfirmationDeadlines()` - Logs with reason "confirmation_deadline_passed"
- `checkSlotSelectionDeadlines()` - Logs with reason "slot_selection_deadline_passed"
- `checkBufferHealth()` - Logs buffer backfill actions
- `sendInterviewReminders()` - Logs with hours_until_interview, no_show_risk
- `updateRiskScores()` - Logs risk score changes with old_risk, new_risk, risk_change
- `logCycleSummary()` - Logs cycle metrics (duration, results)
- `alertAdmin()` - Logs admin alerts

**NegotiationBot:**
- `escalateToRecruiter()` - Logs with session_id, rounds, reason "max_rounds_exceeded"

### 3. Log Entry Format

All logs now include comprehensive context:

```json
{
  "id": "uuid",
  "job_id": "uuid",
  "action_type": "buffer_promotion",
  "trigger_source": "auto",
  "actor_id": null,
  "details": {
    "candidate_id": "uuid",
    "application_id": "uuid",
    "new_rank": 3,
    "previous_rank": 6,
    "reason": "shortlisted_candidate_dropout",
    "timestamp": "2024-01-15T10:30:00Z"
  },
  "created_at": "2024-01-15T10:30:00Z"
}
```

### 4. Trigger Sources

- **auto**: Automated actions triggered by system logic (e.g., auto-shortlisting, buffer promotion)
- **manual**: Actions triggered by user interaction (e.g., candidate accepting/rejecting invitation)
- **scheduled**: Actions triggered by background scheduler (e.g., deadline expiration, buffer health checks)

### 5. Actor Tracking

- **actor_id = null**: System-initiated actions (automated)
- **actor_id = user_uuid**: User-initiated actions (manual overrides, candidate responses)

## Benefits

1. **Complete Audit Trail**: Every automation action is logged with full context
2. **Accountability**: Track who/what triggered each action (trigger_source + actor_id)
3. **Debugging**: Detailed context in JSONB details field for troubleshooting
4. **Analytics**: Query utilities enable reporting and analysis
5. **Compliance**: Full audit trail for regulatory requirements

## Usage Examples

### Logging an Action
```javascript
await automationLogger.log({
  jobId: 'job-uuid',
  actionType: 'buffer_promotion',
  triggerSource: 'auto',
  actorId: null,
  details: {
    candidate_id: 'candidate-uuid',
    new_rank: 3,
    reason: 'shortlisted_candidate_dropout'
  }
});
```

### Querying Logs
```javascript
// Get logs for a job with pagination
const result = await automationLogger.getAutomationLogs('job-uuid', 50, 0);

// Get logs by action type
const promotions = await automationLogger.getAutomationLogsByType('job-uuid', 'buffer_promotion');

// Get statistics
const stats = await automationLogger.getAutomationLogStats('job-uuid');
// Returns: { total: 42, by_action_type: {...}, by_trigger_source: {...} }

// Get logs for an interview
const interviewLogs = await automationLogger.getLogsForInterview('interview-uuid');
```

## Requirements Satisfied

- **Requirement 8.7**: Background_Scheduler logs all automated actions with timestamps and reasons ✓
- **Requirement 3.9**: Interview_Scheduler logs all invitation actions with timestamps ✓
- **Observability section**: Comprehensive logging with trigger_source, actor_id, and detailed context ✓

## Files Modified

1. `backend/utils/automationLogger.js` - New centralized logging utility
2. `backend/managers/ShortlistingManager.js` - Enhanced logging
3. `backend/managers/InterviewScheduler.js` - Enhanced logging
4. `backend/managers/BackgroundScheduler.js` - Enhanced logging
5. `backend/managers/NegotiationBot.js` - Enhanced logging
6. `backend/tests/automationLogger.test.js` - Unit tests for logging utility

## Notes

- All managers now use the centralized AutomationLogger for consistency
- Legacy `logAutomation()` methods in managers now delegate to AutomationLogger
- Logging failures are non-blocking (logged to console but don't throw errors)
- All logs include automatic timestamp in details field
- Query utilities support pagination and filtering for efficient log retrieval
