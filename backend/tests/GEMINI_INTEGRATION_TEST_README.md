# Gemini LLM Negotiation Integration - Manual Test Guide

## Overview

This document explains how to run the comprehensive manual test for the Gemini LLM integration (Task 4.3).

The test verifies:
1. ✅ GeminiClient initializes correctly
2. ✅ Feature flags control Gemini features
3. ✅ NegotiationBot uses Gemini when enabled
4. ✅ Fallback to regex/template works when Gemini disabled or fails
5. ✅ All components wire together properly

## Test File

**Location:** `backend/tests/manual-test-gemini-integration.js`

## Prerequisites

### Required
- Node.js installed
- Database running with `feature_flags` table
- `gemini_parsing` and `gemini_responses` flags created in database

### Optional (for full Gemini testing)
- Google Gemini API key configured in `backend/config/config.env`

## Running the Test

### Option 1: Without Gemini API Key (Fallback Mode)

This tests that the system works correctly when Gemini is unavailable:

```bash
node backend/tests/manual-test-gemini-integration.js
```

**What it tests:**
- ✅ Singleton pattern for GeminiClient
- ✅ Feature flag enable/disable functionality
- ✅ Fallback to regex parsing when Gemini disabled
- ✅ Fallback to template responses when Gemini disabled
- ✅ End-to-end flow in fallback mode

**Expected output:**
```
✓ ALL TESTS PASSED!
Gemini LLM Integration Status: ✓ COMPLETE

Note: 7 tests were skipped (likely due to missing GEMINI_API_KEY)
These tests verified fallback behavior instead
```

### Option 2: With Gemini API Key (Full Testing)

This tests the complete Gemini integration:

1. **Get a Gemini API key:**
   - Go to https://makersuite.google.com/app/apikey
   - Create a new API key
   - Copy the key

2. **Configure the API key:**
   ```bash
   # Edit backend/config/config.env
   GEMINI_API_KEY=your-actual-api-key-here
   GEMINI_MODEL_NAME=gemini-1.5-flash
   GEMINI_TIMEOUT_MS=10000
   ```

3. **Run the test:**
   ```bash
   node backend/tests/manual-test-gemini-integration.js
   ```

**What it tests (in addition to fallback tests):**
- ✅ GeminiClient initialization with real API key
- ✅ Gemini-powered availability parsing
- ✅ Gemini-powered response generation
- ✅ Fallback when Gemini returns null
- ✅ Fallback when Gemini throws error
- ✅ End-to-end flow with Gemini enabled
- ✅ Metrics collection

**Expected output:**
```
✓ ALL TESTS PASSED!
Gemini LLM Integration Status: ✓ COMPLETE

The integration is working correctly:
  1. GeminiClient initializes and manages API calls
  2. Feature flags control Gemini features
  3. NegotiationBot uses Gemini when enabled
  4. Fallback to regex/template works when Gemini disabled or fails
  5. All components wire together properly
```

## Test Structure

### Test 1: GeminiClient Initialization
- Verifies singleton pattern
- Checks configuration (API key, model name, timeout)
- Validates metrics tracking

### Test 2: Feature Flags Control
- Verifies `gemini_parsing` and `gemini_responses` flags exist
- Tests enable/disable functionality
- Confirms flags control behavior

### Test 3: Availability Parsing Integration
- Tests Gemini-powered parsing (if API key available)
- Tests fallback to regex when Gemini disabled
- Tests fallback when Gemini returns null
- Tests fallback when Gemini throws error

### Test 4: Response Generation Integration
- Tests Gemini-powered response generation (if API key available)
- Tests fallback to templates when Gemini disabled
- Tests fallback when Gemini returns null
- Tests all response types (clarification, slot_suggestions, request_alternatives, escalation)

### Test 5: End-to-End Integration
- Tests complete negotiation flow with Gemini enabled
- Tests complete negotiation flow in fallback mode
- Verifies metrics collection

## Understanding Test Output

### Color Coding
- 🟢 **Green (✓ PASS):** Test passed successfully
- 🔴 **Red (✗ FAIL):** Test failed
- 🟡 **Yellow (⚠ WARNING):** Warning or informational message
- 🔵 **Blue (ℹ INFO):** Additional information

### Test Results
- **Passed:** Number of tests that passed
- **Failed:** Number of tests that failed
- **Skipped:** Number of tests skipped (usually due to missing API key)
- **Success Rate:** Percentage of tests that passed

## Troubleshooting

### Issue: "GEMINI_API_KEY is required"
**Solution:** This is expected if you haven't configured an API key. The test will verify fallback behavior instead.

### Issue: "Feature flag not found"
**Solution:** The test will automatically create the required flags. If this fails, check database connectivity.

### Issue: "API timeout" or "Rate limit exceeded"
**Solution:** 
- Check your internet connection
- Verify your API key is valid
- Wait a few minutes if rate limited
- The system will automatically fall back to regex/template

### Issue: Tests fail with database errors
**Solution:**
- Ensure database is running
- Verify `feature_flags` table exists
- Check database connection in `backend/database/supabaseClient.js`

## Feature Flags

The integration uses two feature flags:

### `gemini_parsing`
- **Purpose:** Enable/disable Gemini-powered availability parsing
- **Default:** `true` (enabled)
- **Fallback:** Regex-based parsing

### `gemini_responses`
- **Purpose:** Enable/disable Gemini-powered response generation
- **Default:** `true` (enabled)
- **Fallback:** Template-based responses

### Managing Flags

You can manage flags through the database or using the feature flags API:

```javascript
import { updateFeatureFlag } from '../utils/featureFlags.js';

// Enable Gemini parsing
await updateFeatureFlag('gemini_parsing', true);

// Disable Gemini responses
await updateFeatureFlag('gemini_responses', false);
```

## Integration Status

✅ **Task 4.1:** GeminiClient wired into NegotiationBot constructor  
✅ **Task 4.2:** Feature flags added (gemini_enabled, gemini_parsing, gemini_responses)  
✅ **Task 4.3:** Basic integration tested manually  

## Next Steps

After running this test successfully:

1. **Production Deployment:**
   - Configure `GEMINI_API_KEY` in production environment
   - Set appropriate feature flag values
   - Monitor metrics and logs

2. **Gradual Rollout:**
   - Start with `gemini_parsing` enabled, `gemini_responses` disabled
   - Monitor success rates and user feedback
   - Gradually enable `gemini_responses`

3. **Monitoring:**
   - Track API call metrics via `GeminiClient.getMetrics()`
   - Monitor fallback activation rates
   - Review automation logs for errors

## Support

For issues or questions:
- Review the design document: `.kiro/specs/gemini-llm-negotiation-integration/design.md`
- Check requirements: `.kiro/specs/gemini-llm-negotiation-integration/requirements.md`
- Review implementation tasks: `.kiro/specs/gemini-llm-negotiation-integration/tasks.md`
