# Gemini Feature Flags Migration

## Overview

This migration adds three feature flags to support the Gemini LLM integration for the NegotiationBot. These flags allow gradual rollout and independent control of Gemini-powered features.

## Feature Flags Added

### 1. `gemini_enabled`
- **Description**: Master flag for all Gemini LLM features
- **Default**: `false` (disabled)
- **Purpose**: Acts as a master switch to enable/disable all Gemini functionality
- **Usage**: Check this flag before initializing GeminiClient or using any Gemini features

### 2. `gemini_parsing`
- **Description**: Enable Gemini-powered availability parsing
- **Default**: `false` (disabled)
- **Purpose**: Controls whether the NegotiationBot uses Gemini to parse natural language availability from candidate messages
- **Fallback**: When disabled, the system uses regex-based parsing

### 3. `gemini_responses`
- **Description**: Enable Gemini-powered response generation
- **Default**: `false` (disabled)
- **Purpose**: Controls whether the NegotiationBot uses Gemini to generate natural language responses
- **Fallback**: When disabled, the system uses template-based responses

## Migration Files

- **Up Migration**: `002_add_gemini_feature_flags.up.sql`
- **Down Migration**: `002_add_gemini_feature_flags.down.sql`
- **Runner Script**: `run-gemini-flags-migration.js`
- **Verification Script**: `verify-gemini-flags.js`

## Running the Migration

### Option 1: Using the Node.js Script (Recommended)

```bash
# Run the migration
node backend/database/migrations/run-gemini-flags-migration.js

# Verify the migration
node backend/database/migrations/verify-gemini-flags.js
```

### Option 2: Using SQL Directly

```bash
# Using psql
psql $DATABASE_URL -f backend/database/migrations/002_add_gemini_feature_flags.up.sql

# Using Supabase SQL Editor
# Copy the contents of 002_add_gemini_feature_flags.up.sql and execute
```

## Rollback

To remove the Gemini feature flags:

```bash
# Using psql
psql $DATABASE_URL -f backend/database/migrations/002_add_gemini_feature_flags.down.sql

# Or using SQL Editor
# Copy the contents of 002_add_gemini_feature_flags.down.sql and execute
```

## Usage in Code

### Checking if Gemini is Enabled

```javascript
import { isFeatureEnabled } from '../utils/featureFlags.js';

// Check master flag
const geminiEnabled = await isFeatureEnabled('gemini_enabled');

// Check specific feature flags
const parsingEnabled = await isFeatureEnabled('gemini_parsing');
const responsesEnabled = await isFeatureEnabled('gemini_responses');
```

### Example: NegotiationBot Integration

```javascript
// In NegotiationBot.parseAvailability()
async parseAvailability(message) {
  // Check if Gemini parsing is enabled
  if (this.geminiClient && await isFeatureEnabled('gemini_parsing')) {
    try {
      const result = await this.geminiClient.extractAvailability(message);
      if (result) return result;
    } catch (error) {
      console.error('[NegotiationBot] Gemini parsing failed:', error);
    }
  }
  
  // Fallback to regex-based parsing
  return this.parseAvailabilityRegex(message);
}

// In NegotiationBot.generateResponse()
async generateResponse(type, context) {
  // Check if Gemini responses are enabled
  if (this.geminiClient && await isFeatureEnabled('gemini_responses')) {
    try {
      const response = await this.geminiClient.generateResponse(context);
      if (response) return response;
    } catch (error) {
      console.error('[NegotiationBot] Gemini response generation failed:', error);
    }
  }
  
  // Fallback to template-based responses
  return this.generateTemplateResponse(type, context);
}
```

## Enabling/Disabling Flags

### Using the Feature Flags API

```javascript
import { enableFeatureFlag, disableFeatureFlag } from '../utils/featureFlags.js';

// Enable Gemini features
await enableFeatureFlag('gemini_enabled');
await enableFeatureFlag('gemini_parsing');
await enableFeatureFlag('gemini_responses');

// Disable Gemini features
await disableFeatureFlag('gemini_enabled');
await disableFeatureFlag('gemini_parsing');
await disableFeatureFlag('gemini_responses');
```

### Using SQL

```sql
-- Enable all Gemini features
UPDATE feature_flags SET enabled = true WHERE flag_name = 'gemini_enabled';
UPDATE feature_flags SET enabled = true WHERE flag_name = 'gemini_parsing';
UPDATE feature_flags SET enabled = true WHERE flag_name = 'gemini_responses';

-- Disable all Gemini features
UPDATE feature_flags SET enabled = false WHERE flag_name = 'gemini_enabled';
UPDATE feature_flags SET enabled = false WHERE flag_name = 'gemini_parsing';
UPDATE feature_flags SET enabled = false WHERE flag_name = 'gemini_responses';
```

## Rollout Strategy

### Phase 1: Testing (All Disabled)
- All flags remain `false`
- Test Gemini integration in development
- Verify fallback mechanisms work correctly

### Phase 2: Parsing Only (Gradual Rollout)
1. Enable `gemini_enabled` = `true`
2. Enable `gemini_parsing` = `true`
3. Keep `gemini_responses` = `false`
4. Monitor parsing accuracy and API costs
5. Verify fallback to regex works on errors

### Phase 3: Full Rollout
1. Enable `gemini_responses` = `true`
2. Monitor response quality and latency
3. Track negotiation success rates
4. Compare Gemini vs template-based metrics

### Phase 4: Production
- All flags enabled
- Monitor API usage and costs
- Track success metrics
- Be ready to disable if issues arise

## Monitoring

Track these metrics for each flag state:

- **API Calls**: Total Gemini API calls per day
- **Success Rate**: Percentage of successful API calls
- **Fallback Rate**: How often fallback is triggered
- **Response Time**: Average API response time
- **Negotiation Success**: Success rate with Gemini vs without
- **Cost**: API usage costs

## Testing

Run the test suite to verify the flags work correctly:

```bash
npm test -- gemini-feature-flags.test.js
```

The test suite verifies:
- All three flags exist in the database
- Flags are disabled by default
- Flags can be enabled/disabled independently
- `isFeatureEnabled()` returns correct values
- Flags integrate properly with the feature flag system

## Troubleshooting

### Flags Not Found
If the flags don't exist, run the migration:
```bash
node backend/database/migrations/run-gemini-flags-migration.js
```

### Flags Already Exist
The migration uses `ON CONFLICT DO NOTHING`, so it's safe to run multiple times. Existing flags won't be modified.

### Verification Failed
Run the verification script to check flag status:
```bash
node backend/database/migrations/verify-gemini-flags.js
```

## Related Documentation

- **Spec**: `.kiro/specs/gemini-llm-negotiation-integration/`
- **Requirements**: `.kiro/specs/gemini-llm-negotiation-integration/requirements.md`
- **Design**: `.kiro/specs/gemini-llm-negotiation-integration/design.md`
- **Tasks**: `.kiro/specs/gemini-llm-negotiation-integration/tasks.md`
- **Feature Flags System**: `backend/utils/featureFlags.js`
- **GeminiClient**: `backend/services/GeminiClient.js`

## Migration Metadata

- **Migration ID**: 002
- **Feature**: Gemini LLM Negotiation Integration
- **Requirements**: Requirement 9 (Gradual Rollout Support)
- **Estimated Time**: < 1 second
- **Reversible**: Yes (no data loss)
- **Breaking Changes**: No
- **Dependencies**: Migration 001 (feature_flags table must exist)
