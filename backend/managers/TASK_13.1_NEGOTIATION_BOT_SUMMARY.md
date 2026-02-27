# Task 13.1: NegotiationBot Class Implementation Summary

## Overview
Implemented the NegotiationBot class with session management capabilities to handle conversational slot negotiation when candidates have scheduling conflicts.

## Implementation Details

### Core Features Implemented

1. **Session Management**
   - `startNegotiation(interviewId, candidateMessage)` - Creates new negotiation session
   - `processMessage(session, message)` - Processes candidate messages and generates responses
   - `getSession(sessionId)` - Retrieves session by ID
   - `getSessionByInterview(interviewId)` - Retrieves session by interview ID
   - `updateSession(sessionId, updates)` - Updates session state

2. **Negotiation Sessions Table Operations**
   - Creates sessions with conversation history tracking
   - Maintains round count (max 3 before escalation)
   - Tracks session state: awaiting_availability, awaiting_selection, escalated, resolved
   - Stores complete conversation history as JSONB

3. **Availability Parsing**
   - Parses natural language time expressions:
     - "next week" - calculates next Monday through Sunday
     - "this week" - calculates today through end of week
     - "afternoon" - maps to 12 PM - 6 PM
     - "morning" - maps to 9 AM - 12 PM
     - Day names (Monday, Tuesday, etc.)
     - Time patterns (2pm, 5pm, 2-5 PM)
   - Returns structured availability object with date ranges and preferences

4. **Slot Matching**
   - `findMatchingSlots(availableSlots, availability)` - Filters recruiter slots by:
     - Date range (start_date to end_date)
     - Preferred days (e.g., Monday, Wednesday)
     - Preferred hours (e.g., 14:00-18:00)
   - Returns up to 3 matching slots per round

5. **Response Formatting**
   - `formatSlotSuggestions(slots)` - Formats slots as numbered list
   - Provides clear instructions for candidate selection
   - Conversational tone with helpful examples

6. **Escalation Logic**
   - Tracks negotiation rounds (max 3)
   - Escalates to recruiter after 3 failed rounds
   - Sends email with complete conversation history
   - Logs escalation action in automation_logs

## Database Schema

The negotiation_sessions table (already created in migration 001):
```sql
CREATE TABLE negotiation_sessions (
  id UUID PRIMARY KEY,
  interview_id UUID REFERENCES interviews(id),
  round INTEGER DEFAULT 1,
  state VARCHAR(30) DEFAULT 'awaiting_availability',
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
);
```

## Dependencies

- **CalendarIntegrator**: Used to fetch recruiter's available slots
- **EmailService**: Used to send escalation emails to recruiter
- **Supabase**: Database operations for sessions and related data
- **uuid**: Generate unique session IDs

## Testing

Created comprehensive unit tests in `backend/tests/negotiationBot.simple.test.js`:

✓ Parse availability from "next week" message
✓ Parse availability with time preferences (afternoon/morning)
✓ Format slot suggestions correctly
✓ Filter slots by preferred days
✓ Filter slots by preferred hours
✓ Parse time range from time strings
✓ Return null for unclear availability messages

All tests passing successfully.

## Usage Example

```javascript
import NegotiationBot from './managers/NegotiationBot.js';
import CalendarIntegrator from './services/CalendarIntegrator.js';
import EmailService from './services/EmailService.js';

const calendarIntegrator = new CalendarIntegrator();
const emailService = new EmailService();
const bot = new NegotiationBot(calendarIntegrator, emailService);

// Start negotiation
const result = await bot.startNegotiation(
  interviewId,
  "I'm not available at the suggested times. I'm free next week in the afternoon."
);

console.log(result.sessionId); // UUID of session
console.log(result.response);  // Bot's response with slot suggestions
```

## Requirements Satisfied

- **Requirement 5.1**: ✓ Negotiation bot asks for candidate's available time ranges
- **Requirement 5.6**: ✓ Bot maintains conversation context for up to 3 negotiation rounds

## Next Steps

The following tasks will build on this implementation:
- Task 13.2: Implement availability parsing (enhanced NLP)
- Task 13.3: Implement slot matching and suggestions
- Task 13.4: Implement escalation logic
- Task 13.5: Write property test for negotiation slot matching
- Task 13.6: Write property test for negotiation round limit

## Files Created/Modified

- ✓ Created: `backend/managers/NegotiationBot.js`
- ✓ Created: `backend/tests/negotiationBot.simple.test.js`
- ✓ Created: `backend/managers/TASK_13.1_NEGOTIATION_BOT_SUMMARY.md`
- ✓ Modified: `backend/package.json` (added uuid dependency)

## Notes

- The availability parsing uses simple pattern matching. For production, consider using a dedicated NLP library like compromise.js or chrono-node for more robust date/time parsing.
- The bot is designed to be conversational and helpful, providing clear examples when candidate input is unclear.
- Session history is stored as JSONB for flexibility and easy querying.
- The implementation follows the same patterns as InterviewScheduler and ShortlistingManager for consistency.
