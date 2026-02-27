# Task 15.1: Feature Flag System Implementation Summary

## Overview
Implemented a comprehensive feature flag system that provides runtime control over automation features with support for global flags and job-level overrides.

## Requirements Addressed
- **Requirement 12.8**: System provides feature flag to enable/disable automation per job
- **Requirement 12.9**: When automation is disabled for a job, system falls back to manual ranking and shortlisting

## Implementation Details

### 1. Feature Flag Utility Module (`backend/utils/featureFlags.js`)

Created a complete feature flag management system with:

**Core Function:**
- `isFeatureEnabled(flagName, jobId)` - Checks if a feature is enabled
  - Checks global flag first
  - Applies job-level overrides for specific flags
  - Defaults to enabled (fail-open) if flag doesn't exist
  - Supports job-level `automation_enabled` override for: `auto_shortlisting`, `auto_promotion`, `global_automation`

**CRUD Operations:**
- `getFeatureFlag(flagName)` - Get a single flag
- `getAllFeatureFlags()` - Get all flags
- `createFeatureFlag(flagName, enabled, description)` - Create new flag
- `updateFeatureFlag(flagName, enabled, description)` - Update existing flag
- `deleteFeatureFlag(flagName)` - Delete a flag
- `enableFeatureFlag(flagName)` - Enable a flag
- `disableFeatureFlag(flagName)` - Disable a flag
- `toggleFeatureFlag(flagName)` - Toggle flag state

### 2. Integration with Automation Code

Added feature flag checks to all automation components:

**ShortlistingManager (`backend/managers/ShortlistingManager.js`):**
- `autoShortlist()` - Checks `auto_shortlisting` flag before executing
- `promoteFromBuffer()` - Checks `auto_promotion` flag before promoting candidates
- Returns descriptive error messages when automation is disabled

**InterviewScheduler (`backend/managers/InterviewScheduler.js`):**
- `sendInvitation()` - Checks `global_automation` flag before sending invitations
- Prevents automated interview invitations when disabled for a job

**BackgroundScheduler (`backend/managers/BackgroundScheduler.js`):**
- `checkConfirmationDeadlines()` - Checks `global_automation` flag globally and per-job
- `checkSlotSelectionDeadlines()` - Checks `global_automation` flag globally and per-job
- `checkBufferHealth()` - Checks `auto_promotion` flag per-job before backfilling
- Skips automation tasks for jobs with disabled automation

**NegotiationBot (`backend/managers/NegotiationBot.js`):**
- `startNegotiation()` - Checks `negotiation_bot` flag before starting negotiation
- Returns user-friendly message when negotiation bot is disabled

### 3. Feature Flag Logic

**Priority Order:**
1. Global flag disabled → Feature disabled (regardless of job setting)
2. Job-level override exists → Use job-level setting
3. No job-level override → Use global flag
4. Flag doesn't exist → Default to enabled (fail-open for backward compatibility)

**Job-Level Overrides:**
- `auto_shortlisting` → Respects `jobs.automation_enabled`
- `auto_promotion` → Respects `jobs.automation_enabled`
- `global_automation` → Respects `jobs.automation_enabled`
- Other flags (e.g., `negotiation_bot`, `calendar_integration`) → Use global flag only

### 4. Default Feature Flags

The migration creates 6 default flags (all enabled):
- `global_automation` - Master switch for all automation
- `auto_shortlisting` - Automatic candidate shortlisting
- `auto_promotion` - Automatic buffer promotion on dropouts
- `negotiation_bot` - AI negotiation chatbot for slot conflicts
- `no_show_prediction` - No-show risk scoring
- `calendar_integration` - Google Calendar sync

### 5. Comprehensive Test Suite (`backend/tests/featureFlags.test.js`)

Created 25 unit tests covering:

**CRUD Operations (9 tests):**
- Create, read, update, delete operations
- Enable, disable, toggle operations
- Null handling for non-existent flags

**Global Flags (3 tests):**
- Enabled flag returns true
- Disabled flag returns false
- Non-existent flag defaults to true (fail-open)

**Job-Level Overrides (7 tests):**
- Job-level override for `auto_shortlisting`
- Job-level override for `auto_promotion`
- Job-level override for `global_automation`
- Both global and job-level enabled
- Global disabled overrides job-level enabled
- Features without job-level overrides use global flag
- Non-existent job handled gracefully

**Default Flags (6 tests):**
- Verify all 6 default flags exist in database

**Test Results:** ✅ All 25 tests passing

## Usage Examples

### Check if feature is enabled globally
```javascript
const isEnabled = await isFeatureEnabled('auto_shortlisting');
```

### Check if feature is enabled for specific job
```javascript
const isEnabled = await isFeatureEnabled('auto_shortlisting', jobId);
```

### Disable automation for a specific job
```javascript
await supabase
  .from('jobs')
  .update({ automation_enabled: false })
  .eq('id', jobId);
```

### Disable a feature globally
```javascript
await disableFeatureFlag('negotiation_bot');
```

## Benefits

1. **Runtime Control**: Enable/disable features without code changes
2. **Gradual Rollout**: Test features on specific jobs before global rollout
3. **Emergency Kill Switch**: Quickly disable problematic features
4. **Job-Level Flexibility**: Different automation settings per job
5. **Backward Compatibility**: Fail-open design ensures existing functionality continues
6. **Audit Trail**: All flag changes can be logged through automation_logs

## Files Created/Modified

**Created:**
- `backend/utils/featureFlags.js` - Feature flag utility module
- `backend/tests/featureFlags.test.js` - Comprehensive test suite
- `backend/TASK_15.1_FEATURE_FLAGS_SUMMARY.md` - This summary

**Modified:**
- `backend/managers/ShortlistingManager.js` - Added feature flag checks
- `backend/managers/InterviewScheduler.js` - Added feature flag checks
- `backend/managers/BackgroundScheduler.js` - Added feature flag checks
- `backend/managers/NegotiationBot.js` - Added feature flag checks

## Next Steps

1. **Task 15.2**: Implement observability metrics collection
2. **Task 15.3**: Create admin dashboard for feature flag management
3. **Task 15.4**: Write unit tests for feature flag control (✅ Already completed)

## Notes

- Feature flags are stored in the `feature_flags` table (created by migration 001)
- Job-level automation control uses existing `jobs.automation_enabled` column
- The system defaults to enabled (fail-open) for backward compatibility
- All automation code respects feature flags before executing
- Tests verify both global and job-level override behavior
