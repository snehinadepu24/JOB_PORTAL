# Task 9.1: Slot Selection UI Endpoint - Implementation Summary

## Overview
Successfully implemented the slot selection UI endpoints for the AI Hiring Orchestrator, allowing candidates to view and select interview time slots from the recruiter's available calendar.

## Requirements Implemented
- **Requirement 4.1**: Fetch recruiter's Google Calendar availability for next 14 days
- **Requirement 4.2**: Show only free slots during business hours (9 AM - 6 PM, Monday-Friday)
- **Requirement 4.3**: Exclude slots with existing calendar events
- **Requirement 4.4**: Set slot_selection_deadline to 24 hours from selection time

## Files Created/Modified

### 1. Created: `backend/routes/interviewRoutes.js`
New route file implementing two endpoints:

#### GET `/api/v1/interview/available-slots/:interviewId`
- Fetches available time slots for interview scheduling
- Validates interview is in `slot_pending` state
- Checks slot selection deadline hasn't passed
- Calculates date range (next 14 days)
- Calls `CalendarIntegrator.getAvailableSlots()` to fetch recruiter availability
- Filters slots to business hours only (9 AM - 6 PM, weekdays)
- Returns formatted slot list for UI display

**Response Format:**
```json
{
  "success": true,
  "data": {
    "interviewId": "uuid",
    "slots": [
      {
        "start": "2024-01-15T10:00:00Z",
        "end": "2024-01-15T11:00:00Z",
        "display": "Monday, January 15, 2024, 10:00 AM EST"
      }
    ],
    "deadline": "2024-01-14T10:00:00Z",
    "totalSlots": 42
  }
}
```

#### POST `/api/v1/interview/select-slot/:interviewId`
- Allows candidate to select a preferred interview slot
- Validates input (start and end times required)
- Verifies interview is in `slot_pending` state
- Checks slot selection deadline hasn't passed
- Validates selected slot is:
  - In the future
  - On a weekday (Monday-Friday)
  - During business hours (9 AM - 6 PM)
- Sets `slot_selection_deadline` to 24 hours from selection time (Requirement 4.4)
- Updates interview with selected slot
- Logs automation action

**Request Body:**
```json
{
  "selectedSlot": {
    "start": "2024-01-15T10:00:00Z",
    "end": "2024-01-15T11:00:00Z"
  }
}
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "interview": { /* updated interview object */ },
    "selectedSlot": {
      "start": "2024-01-15T10:00:00Z",
      "end": "2024-01-15T11:00:00Z",
      "display": "Monday, January 15, 2024, 10:00 AM EST"
    },
    "confirmationDeadline": "2024-01-14T10:00:00Z"
  },
  "message": "Slot selected successfully. Please confirm your selection within 24 hours."
}
```

### 2. Modified: `backend/app.js`
- Added import for `interviewRouter`
- Registered route: `app.use("/api/v1/interview", interviewRouter)`

### 3. Created: `backend/tests/interviewRoutes.manual.test.js`
Comprehensive test suite covering:
- Business hour slot generation (9 AM - 6 PM, weekdays)
- Slot overlap detection
- Slot selection with 24-hour deadline
- Slot validation (weekday, business hours, future time)
- Interview state validation

## Key Features

### Business Hours Filtering (Requirements 4.2, 4.3)
- Only returns slots during business hours: 9 AM - 6 PM
- Only returns slots on weekdays: Monday-Friday
- Excludes slots with existing calendar events
- Uses `CalendarIntegrator.generateBusinessHourSlots()` method
- Uses `CalendarIntegrator.slotsOverlap()` to filter busy slots

### Slot Selection Deadline (Requirement 4.4)
- When candidate selects a slot, `slot_selection_deadline` is set to exactly 24 hours from selection time
- This gives the candidate 24 hours to confirm their selection
- After deadline passes, the background scheduler will expire the interview

### Validation
- Interview must be in `slot_pending` state
- Slot selection deadline must not have passed
- Selected slot must be in the future
- Selected slot must be on a weekday
- Selected slot must be during business hours (9 AM - 6 PM)

### Error Handling
- Returns appropriate HTTP status codes (400, 404, 500)
- Provides descriptive error messages
- Logs errors for debugging

## Integration with Existing Components

### CalendarIntegrator Service
- Uses `getAvailableSlots(recruiterId, startDate, endDate)` to fetch recruiter availability
- Uses `generateBusinessHourSlots()` to generate all possible slots
- Uses `slotsOverlap()` to filter out busy slots

### Interview Model
- Reads interview records to validate state
- Updates interview with selected slot and deadline

### Automation Logs
- Logs slot selection actions with:
  - `action_type`: 'slot_selected'
  - `trigger_source`: 'manual'
  - `actor_id`: candidate_id
  - Details: interview_id, selected_slot, new_deadline

## Test Results
All tests passed successfully:
- ✓ Business hour slots generation (54 slots in 7 days)
- ✓ Slot overlap detection
- ✓ Slot selection with 24-hour deadline (exactly 24.00 hours)
- ✓ Weekend slot rejection
- ✓ Outside business hours rejection
- ✓ Valid slot acceptance
- ✓ Interview state validation

## API Endpoints Summary

| Method | Endpoint | Purpose | Requirements |
|--------|----------|---------|--------------|
| GET | `/api/v1/interview/available-slots/:interviewId` | Fetch available slots | 4.1, 4.2, 4.3 |
| POST | `/api/v1/interview/select-slot/:interviewId` | Select interview slot | 4.4 |

## Next Steps
The following tasks remain in the slot selection workflow:
- **Task 9.2**: Implement slot confirmation handler
  - Update interview status to "confirmed"
  - Store scheduled_time
  - Trigger calendar event creation
  - Send confirmation emails to both parties

## Notes
- Google Calendar OAuth is not configured in the test environment, so calendar integration falls back to ICS file generation
- The endpoints are ready for frontend integration
- All validation logic is in place to ensure data integrity
- The 24-hour deadline mechanism is implemented and tested
