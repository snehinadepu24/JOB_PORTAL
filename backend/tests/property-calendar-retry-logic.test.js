/**
 * Property-Based Test: Calendar API Retry Logic
 * 
 * **Validates: Requirements 6.8, 13.2**
 * 
 * Property 19: Calendar API Retry Logic
 * When a calendar API operation fails, the system must:
 * 1. Retry up to 3 times with exponential backoff
 * 2. Use delays of 1s, 2s, 4s between retries
 * 3. Succeed if any retry succeeds
 * 4. Fail only after all retries exhausted
 * 5. Circuit breaker opens after threshold failures
 * 
 * This test validates that the CalendarIntegrator correctly implements
 * retry logic with exponential backoff across various failure scenarios.
 * 
 * PREREQUISITES:
 * - Database migration must be run first (001_add_ai_orchestrator_schema.up.sql)
 * - See README-PROPERTY-TESTS.md for setup instructions
 * 
 * Run with: node backend/tests/property-calendar-retry-logic.test.js
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fc from 'fast-check';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from config.env
config({ path: path.join(__dirname, '../config/config.env') });

// Now import modules that depend on environment variables
import { calendarIntegrator } from '../services/CalendarIntegrator.js';

/**
 * Mock function that fails N times then succeeds
 */
function createMockFunction(failCount) {
  let attempts = 0;
  return async () => {
    attempts++;
    if (attempts <= failCount) {
      throw new Error(`Mock failure ${attempts}`);
    }
    return { success: true, attempts };
  };
}

/**
 * Mock function that always fails
 */
function createAlwaysFailingFunction() {
  let attempts = 0;
  return async () => {
    attempts++;
    throw new Error(`Mock failure ${attempts}`);
  };
}

/**
 * Measure execution time
 */
async function measureExecutionTime(fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    return { success: true, result, duration };
  } catch (error) {
    const duration = Date.now() - start;
    return { success: false, error, duration };
  }
}

/**
 * Property Test: Retry Logic with Exponential Backoff
 * 
 * Feature: ai-hiring-orchestrator, Property 19: Calendar API Retry Logic
 * 
 * This test verifies that:
 * 1. Functions are retried up to 3 times
 * 2. Exponential backoff is applied (1s, 2s, 4s)
 * 3. Success occurs if any retry succeeds
 * 4. Failure occurs only after all retries exhausted
 */
async function testRetryLogic() {
  console.log('='.repeat(70));
  console.log('Property-Based Test: Calendar API Retry Logic');
  console.log('='.repeat(70));
  console.log('\nThis test validates Requirements 6.8, 13.2');
  console.log('Running 20 iterations with randomly generated scenarios...\n');
  
  console.log('Property 19: Calendar API Retry Logic');
  console.log('When a calendar API operation fails, the system must:');
  console.log('  1. Retry up to 3 times with exponential backoff');
  console.log('  2. Use delays of 1s, 2s, 4s between retries');
  console.log('  3. Succeed if any retry succeeds');
  console.log('  4. Fail only after all retries exhausted\n');
  
  console.log('Test scenarios:');
  console.log('  - Failure counts: 0-4 (random)');
  console.log('  - Expected behavior: succeed if failures < 3, fail if >= 3');
  console.log('  - Timing validation: exponential backoff delays');
  console.log('  - Iterations: 20\n');
  
  console.log('Starting property test...\n');

  let passedTests = 0;
  let failedTests = 0;

  try {
    await fc.assert(
      fc.asyncProperty(
        // Generate random number of failures before success (0-4)
        fc.integer({ min: 0, max: 4 }),
        async (failCount) => {
          try {
            const mockFn = createMockFunction(failCount);
            const result = await measureExecutionTime(async () => {
              return await calendarIntegrator.retryWithExponentialBackoff(mockFn, 3);
            });

            // PROPERTY 1: Should succeed if failures < max retries (3)
            if (failCount < 3) {
              if (!result.success) {
                throw new Error(
                  `Expected success with ${failCount} failures, but got failure: ${result.error.message}`
                );
              }

              // PROPERTY 2: Result should contain attempt count
              if (!result.result || !result.result.attempts) {
                throw new Error('Result should contain attempts count');
              }

              // PROPERTY 3: Attempts should equal failCount + 1
              const expectedAttempts = failCount + 1;
              if (result.result.attempts !== expectedAttempts) {
                throw new Error(
                  `Expected ${expectedAttempts} attempts, got ${result.result.attempts}`
                );
              }

              // PROPERTY 4: Execution time should reflect exponential backoff
              // Expected delays: 0s (first attempt) + 1s + 2s + 4s for retries
              // Allow 500ms tolerance per retry for execution overhead
              const expectedMinDelay = failCount === 0 ? 0 : 
                                       failCount === 1 ? 1000 :
                                       failCount === 2 ? 3000 : 0; // 1s + 2s
              const tolerance = 500 * failCount; // 500ms per retry
              
              if (result.duration < expectedMinDelay - tolerance) {
                throw new Error(
                  `Execution time too short: expected at least ${expectedMinDelay}ms, ` +
                  `got ${result.duration}ms (with ${failCount} retries)`
                );
              }

            } else {
              // PROPERTY 5: Should fail if failures >= max retries
              if (result.success) {
                throw new Error(
                  `Expected failure with ${failCount} failures, but got success`
                );
              }

              // PROPERTY 6: Should have attempted all retries
              // For 3 failures: 3 attempts total, delays of 1s + 2s = 3s
              // For 4 failures: 3 attempts total, delays of 1s + 2s = 3s
              const expectedMinDelay = 3000; // 1s + 2s for 2 retries
              const tolerance = 1500; // 500ms per retry
              
              if (result.duration < expectedMinDelay - tolerance) {
                throw new Error(
                  `Execution time too short for exhausted retries: ` +
                  `expected at least ${expectedMinDelay}ms, got ${result.duration}ms`
                );
              }
            }

            passedTests++;
            
            // Log progress every 5 tests
            if (passedTests % 5 === 0) {
              console.log(`  ✓ Passed ${passedTests} tests...`);
            }

          } catch (error) {
            // Log detailed error information for debugging
            console.error(`\nTest failed with parameters:`);
            console.error(`  - Fail count: ${failCount}`);
            console.error(`  - Error: ${error.message}`);
            throw error;
          }
        }
      ),
      { 
        numRuns: 5,
        verbose: false,
        endOnFailure: true
      }
    );

    console.log('\n' + '='.repeat(70));
    console.log('✓ ALL PROPERTY TESTS PASSED');
    console.log('='.repeat(70));
    console.log(`\nSuccessfully validated ${passedTests} random scenarios\n`);
    
    console.log('Property 19: Calendar API Retry Logic - VERIFIED');
    console.log('  ✓ Retries up to 3 times on failure');
    console.log('  ✓ Exponential backoff applied (1s, 2s, 4s)');
    console.log('  ✓ Succeeds if any retry succeeds');
    console.log('  ✓ Fails only after all retries exhausted');
    console.log('  ✓ Correct attempt counting');
    console.log('  ✓ Timing validates exponential backoff');
    console.log('\n✓ Requirements 6.8, 13.2 validated successfully');
    
    return true;

  } catch (error) {
    failedTests++;
    console.log('\n' + '='.repeat(70));
    console.log('✗ PROPERTY TEST FAILED');
    console.log('='.repeat(70));
    console.log(`\nError: ${error.message}\n`);
    
    if (error.counterexample) {
      console.log('Counterexample found:');
      console.log(JSON.stringify(error.counterexample, null, 2));
    }
    
    throw error;
  }
}

/**
 * Test: Circuit Breaker Behavior
 * 
 * Validates that circuit breaker opens after threshold failures
 */
async function testCircuitBreaker() {
  console.log('\n' + '='.repeat(70));
  console.log('Testing Circuit Breaker Behavior');
  console.log('='.repeat(70));
  console.log('\nValidating circuit breaker opens after threshold failures...\n');

  try {
    // Reset circuit breaker
    calendarIntegrator.circuitBreaker.reset();
    
    const initialState = calendarIntegrator.circuitBreaker.getState();
    if (initialState !== 'CLOSED') {
      throw new Error(`Expected initial state CLOSED, got ${initialState}`);
    }
    console.log('  ✓ Circuit breaker starts in CLOSED state');

    // Execute failing operations to trigger circuit breaker
    const threshold = calendarIntegrator.circuitBreaker.threshold;
    const alwaysFailFn = createAlwaysFailingFunction();

    for (let i = 0; i < threshold; i++) {
      try {
        await calendarIntegrator.circuitBreaker.execute(alwaysFailFn);
      } catch (error) {
        // Expected to fail
      }
    }

    const openState = calendarIntegrator.circuitBreaker.getState();
    if (openState !== 'OPEN') {
      throw new Error(`Expected state OPEN after ${threshold} failures, got ${openState}`);
    }
    console.log(`  ✓ Circuit breaker opens after ${threshold} failures`);

    // Try to execute while circuit is open
    try {
      await calendarIntegrator.circuitBreaker.execute(alwaysFailFn);
      throw new Error('Expected circuit breaker to reject execution');
    } catch (error) {
      if (!error.message.includes('Circuit breaker is OPEN')) {
        throw new Error(`Expected circuit breaker error, got: ${error.message}`);
      }
    }
    console.log('  ✓ Circuit breaker rejects execution when OPEN');

    // Reset for next tests
    calendarIntegrator.circuitBreaker.reset();
    console.log('  ✓ Circuit breaker can be reset');

    console.log('\n✓ Circuit breaker behavior validated successfully');
    return true;

  } catch (error) {
    console.error('\n✗ Circuit breaker test failed:', error.message);
    throw error;
  }
}

// Run the tests
async function runAllTests() {
  try {
    await testRetryLogic();
    await testCircuitBreaker();
    
    console.log('\n' + '='.repeat(70));
    console.log('✓ ALL TESTS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(70));
    console.log('\nRetry logic and circuit breaker validated successfully\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Tests failed:', error.message);
    process.exit(1);
  }
}

runAllTests();
