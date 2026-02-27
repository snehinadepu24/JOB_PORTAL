# Property-Based Tests for AI Hiring Orchestrator

## Overview

This directory contains property-based tests that validate universal correctness properties of the AI Hiring Orchestrator system. These tests use the `fast-check` library to generate random test cases and verify that system invariants hold across all scenarios.

## Prerequisites

### 1. Database Migration

**IMPORTANT:** Before running property tests, you must execute the database migration to add required columns and tables.

**To run the migration:**

1. **Using Supabase SQL Editor** (Recommended):
   - Open your Supabase Dashboard
   - Navigate to: SQL Editor
   - Open the file: `backend/database/migrations/001_add_ai_orchestrator_schema.up.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run" to execute

2. **Using psql** (if installed):
   ```bash
   psql $DATABASE_URL -f backend/database/migrations/001_add_ai_orchestrator_schema.up.sql
   ```

3. **Using Supabase CLI** (if installed):
   ```bash
   supabase db push --file backend/database/migrations/001_add_ai_orchestrator_schema.up.sql
   ```

### 2. Environment Configuration

Ensure your `backend/config/config.env` file has valid Supabase credentials:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

### 3. Dependencies

Install required npm packages:
```bash
cd backend
npm install
```

## Available Property Tests

### Property 6: Shortlist Size Invariant

**File:** `property-shortlist-size-invariant.test.js`

**Validates:** Requirement 2.7

**Property:** For any job at any point in time, the number of candidates with `shortlist_status="shortlisted"` should never exceed the job's `number_of_openings`.

**Test Scenarios:**
- Number of openings: 1-20 (random)
- Number of applications: 1-100 (random)
- Fit scores: 0-100 (random distribution)
- Iterations: 100

**Run:**
```bash
node backend/tests/property-shortlist-size-invariant.test.js
```

**Expected Output:**
```
======================================================================
Property-Based Test: Shortlist Size Invariant
======================================================================

This test validates Requirement 2.7
Running 100 iterations with randomly generated scenarios...

Property 6: Shortlist Size Invariant
...

  ✓ Passed 10 tests...
  ✓ Passed 20 tests...
  ...
  ✓ Passed 100 tests...

======================================================================
✓ ALL PROPERTY TESTS PASSED
======================================================================

Successfully validated 100 random scenarios

Property 6: Shortlist Size Invariant - VERIFIED
  ✓ Shortlist size never exceeds number_of_openings
  ✓ Correct number of candidates shortlisted in all scenarios
  ✓ Handles edge cases:
    - More applications than openings
    - Fewer applications than openings
    - Equal applications and openings
    - Various fit score distributions

✓ Requirement 2.7 validated successfully
```

## Understanding Property-Based Testing

Property-based tests differ from traditional unit tests:

**Unit Tests:**
- Test specific examples
- Fixed inputs and expected outputs
- Example: "Job with 3 openings and 5 applications should shortlist 3"

**Property Tests:**
- Test universal properties
- Random inputs generated automatically
- Example: "For ANY job with N openings and M applications, shortlisted count ≤ N"

**Benefits:**
- Discovers edge cases you didn't think of
- Tests across the entire input space
- Provides stronger correctness guarantees
- Automatically shrinks failing cases to minimal examples

## Troubleshooting

### Error: "MIGRATION NOT RUN"

**Cause:** The database migration hasn't been executed.

**Solution:** Follow the migration steps in Prerequisites section above.

### Error: "Supabase connection failed"

**Cause:** Invalid or missing Supabase credentials.

**Solution:** 
1. Check `backend/config/config.env` file exists
2. Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
3. Test connection: `node backend/database/supabaseClient.js`

### Test Timeout

**Cause:** Property tests with 100 iterations can take 2-5 minutes.

**Solution:** This is normal. The test creates and cleans up database records for each iteration.

### Random Test Failures

**Cause:** Property tests use randomization, so failures may not be reproducible.

**Solution:** 
1. Check the counterexample in the error output
2. The test framework will try to "shrink" the failing case to a minimal example
3. Use the seed value to reproduce: `fc.assert(..., { seed: <seed_value> })`

## Writing New Property Tests

To add a new property test:

1. Create a new file: `property-<name>.test.js`
2. Import required dependencies:
   ```javascript
   import fc from 'fast-check';
   import { supabase } from '../database/supabaseClient.js';
   ```
3. Define helper functions for test data creation/cleanup
4. Write the property test using `fc.assert` and `fc.asyncProperty`
5. Run at least 100 iterations: `{ numRuns: 100 }`
6. Document which requirement and property it validates

**Example Structure:**
```javascript
await fc.assert(
  fc.asyncProperty(
    fc.integer({ min: 1, max: 20 }), // Generate random inputs
    async (input) => {
      // Setup test data
      // Execute system under test
      // Assert property holds
      // Cleanup
    }
  ),
  { numRuns: 100 }
);
```

## References

- [fast-check Documentation](https://github.com/dubzzz/fast-check)
- [Property-Based Testing Guide](https://hypothesis.works/articles/what-is-property-based-testing/)
- [AI Hiring Orchestrator Design Document](../../.kiro/specs/ai-hiring-orchestrator/design.md)
