import BackgroundScheduler from '../managers/BackgroundScheduler.js';

/**
 * Simple unit tests for BackgroundScheduler
 * 
 * Tests basic functionality:
 * - Class instantiation
 * - Start/stop lifecycle
 * - runCycle() execution with fault isolation
 * - Cycle logging
 * 
 * Requirements: 8.1, 8.10
 */

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function runTests() {
  console.log('Starting BackgroundScheduler Simple Tests...\n');

  try {
    // Test 1: Class Instantiation
    testInstantiation();

    // Test 2: Start and Stop
    testStartStop();

    // Test 3: Run Cycle with Fault Isolation
    testRunCycle();

    // Test 4: Task Failures Don't Stop Cycle
    testFaultIsolation();

    // Test 5: Placeholder Methods
    testPlaceholders();

    console.log('\n✅ All BackgroundScheduler simple tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function testInstantiation() {
  console.log('Test 1: Class Instantiation');
  
  const scheduler = new BackgroundScheduler();
  
  assert(scheduler !== null, 'Scheduler should be instantiated');
  assert(scheduler.isRunning === false, 'isRunning should be false initially');
  assert(scheduler.cronJob === null, 'cronJob should be null initially');
  assert(scheduler.shortlistingManager !== null, 'shortlistingManager should be instantiated');
  
  console.log('  ✓ BackgroundScheduler instantiates correctly');
}

function testStartStop() {
  console.log('\nTest 2: Start and Stop');
  
  const scheduler = new BackgroundScheduler();
  
  // Start scheduler
  scheduler.start();
  assert(scheduler.cronJob !== null, 'cronJob should be set after start()');
  
  // Stop scheduler
  scheduler.stop();
  
  console.log('  ✓ Scheduler starts and stops correctly');
}

async function testRunCycle() {
  console.log('\nTest 3: Run Cycle with Fault Isolation');
  
  const scheduler = new BackgroundScheduler();
  
  // Run a cycle
  const results = await scheduler.runCycle();
  
  assert(results !== null, 'Results should be returned');
  assert(typeof results.expired_invitations === 'number', 'expired_invitations should be a number');
  assert(typeof results.expired_slots === 'number', 'expired_slots should be a number');
  assert(typeof results.buffer_backfills === 'number', 'buffer_backfills should be a number');
  assert(typeof results.reminders_sent === 'number', 'reminders_sent should be a number');
  assert(Array.isArray(results.errors), 'errors should be an array');
  
  console.log('  ✓ runCycle() executes and returns results');
  console.log(`    Results: ${JSON.stringify(results)}`);
}

async function testFaultIsolation() {
  console.log('\nTest 4: Task Failures Don\'t Stop Cycle');
  
  const scheduler = new BackgroundScheduler();
  
  // Override a task to throw an error
  scheduler.checkConfirmationDeadlines = async () => {
    throw new Error('Simulated task failure');
  };
  
  // Run cycle - should complete despite error
  const results = await scheduler.runCycle();
  
  assert(results !== null, 'Results should be returned even with task failure');
  assert(results.errors.length > 0, 'Errors array should contain the failure');
  assert(results.errors[0].task === 'confirmation_deadlines', 'Error should be from confirmation_deadlines task');
  assert(results.errors[0].error === 'Simulated task failure', 'Error message should match');
  
  console.log('  ✓ Cycle completes despite task failure (fault isolation works)');
  console.log(`    Captured error: ${results.errors[0].error}`);
}

async function testPlaceholders() {
  console.log('\nTest 5: Placeholder Methods');
  
  const scheduler = new BackgroundScheduler();
  
  // Test implemented methods return 0 when no data
  const confirmationCount = await scheduler.checkConfirmationDeadlines();
  assert(confirmationCount === 0, 'checkConfirmationDeadlines should return 0 when no expired interviews');
  
  const slotCount = await scheduler.checkSlotSelectionDeadlines();
  assert(slotCount === 0, 'checkSlotSelectionDeadlines should return 0 when no expired slot selections');
  
  // Test implemented buffer health checker
  const bufferCount = await scheduler.checkBufferHealth();
  assert(typeof bufferCount === 'number', 'checkBufferHealth should return a number');
  assert(bufferCount >= 0, 'checkBufferHealth should return non-negative count');
  
  // Test placeholder method
  const reminderCount = await scheduler.sendInterviewReminders();
  assert(reminderCount === 0, 'sendInterviewReminders should return 0 (placeholder)');
  
  console.log('  ✓ All methods return expected values');
}

// Run tests
runTests();
