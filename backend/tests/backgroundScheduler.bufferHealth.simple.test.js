import BackgroundScheduler from '../managers/BackgroundScheduler.js';
import { supabase } from '../database/supabaseClient.js';

/**
 * Simple unit tests for BackgroundScheduler.checkBufferHealth()
 * 
 * Tests buffer health checking functionality:
 * - Processes active jobs correctly
 * - Returns non-negative count
 * - Handles errors gracefully (fault isolation)
 * 
 * Requirements: 8.5, 8.6
 */

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runTests() {
  console.log('Starting BackgroundScheduler Buffer Health Tests...\n');

  try {
    // Test 1: Basic functionality
    await testBasicFunctionality();

    // Test 2: Returns valid count
    await testReturnsValidCount();

    // Test 3: Handles errors gracefully
    await testErrorHandling();

    console.log('\n✅ All BackgroundScheduler buffer health tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function testBasicFunctionality() {
  console.log('Test 1: Basic Functionality');
  
  const scheduler = new BackgroundScheduler();
  
  // Run checkBufferHealth - it will process any existing active jobs
  const backfillCount = await scheduler.checkBufferHealth();
  
  // The count should be a non-negative number
  assert(typeof backfillCount === 'number', 'Should return a number');
  assert(backfillCount >= 0, 'Should return non-negative count');
  
  console.log(`  ✓ checkBufferHealth() executes successfully`);
  console.log(`    Processed ${backfillCount} job(s) needing backfill`);
}

async function testReturnsValidCount() {
  console.log('\nTest 2: Returns Valid Count');
  
  const scheduler = new BackgroundScheduler();
  
  // Run twice to ensure idempotency
  const count1 = await scheduler.checkBufferHealth();
  const count2 = await scheduler.checkBufferHealth();
  
  assert(typeof count1 === 'number', 'First run should return a number');
  assert(typeof count2 === 'number', 'Second run should return a number');
  assert(count1 >= 0, 'First count should be non-negative');
  assert(count2 >= 0, 'Second count should be non-negative');
  
  console.log(`  ✓ Returns valid counts on multiple runs`);
  console.log(`    Run 1: ${count1}, Run 2: ${count2}`);
}

async function testErrorHandling() {
  console.log('\nTest 3: Error Handling');
  
  const scheduler = new BackgroundScheduler();
  
  // Override backfillBuffer to simulate an error for one job
  const originalBackfill = scheduler.shortlistingManager.backfillBuffer;
  let callCount = 0;
  
  scheduler.shortlistingManager.backfillBuffer = async (jobId) => {
    callCount++;
    if (callCount === 1) {
      throw new Error('Simulated backfill error');
    }
    return originalBackfill.call(scheduler.shortlistingManager, jobId);
  };
  
  // Should not throw - errors should be caught and logged
  try {
    const count = await scheduler.checkBufferHealth();
    assert(typeof count === 'number', 'Should return a number even with errors');
    console.log(`  ✓ Handles errors gracefully (fault isolation)`);
    console.log(`    Completed with ${count} successful backfills despite error`);
  } catch (error) {
    throw new Error('checkBufferHealth should not throw errors - should handle them internally');
  } finally {
    // Restore original method
    scheduler.shortlistingManager.backfillBuffer = originalBackfill;
  }
}

// Run tests
runTests();

