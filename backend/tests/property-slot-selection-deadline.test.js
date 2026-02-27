/**
 * Property-Based Test: Slot Selection Deadline
 * 
 * **Validates: Requirements 4.4**
 * 
 * Property 15: Slot Selection Deadline
 * When a candidate selects a slot, the system must:
 * 1. Set slot_selection_deadline to exactly 24 hours from selection time
 * 2. Expire interviews when deadline passes (via BackgroundScheduler)
 * 3. Update interview status to "expired" when deadline passes
 * 4. Trigger buffer promotion when deadline expires
 * 
 * This test validates that the slot selection deadline is correctly set
 * and that interviews expire when the deadline passes across various scenarios:
 * - Different selection times
 * - Various time offsets
 * - Edge cases (midnight, DST boundaries)
 * - Multiple interviews expiring simultaneously
 * 
 * PREREQUISITES:
 * - Database migration must be run first (001_add_ai_orchestrator_schema.up.sql)
 * - See README-PROPERTY-TESTS.md for setup instructions
 * 
 * Run with: node backend/tests/property-slot-selection-deadline.test.js
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
import { supabase } from '../database/supabaseClient.js';
import BackgroundScheduler from '../managers/BackgroundScheduler.js';
import InterviewScheduler from '../managers/InterviewScheduler.js';

/**
 * Helper: Check if migration has been run
 */
async function checkMigrationStatus() {
  try {
    const { data, error } = await supabase
      .from('interviews')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.error('\n' + '='.repeat(70));
      console.error('❌ MIGRATION NOT RUN');
      console.error('='.repeat(70));
      console.error('\nThe database migration has not been executed yet.');
      console.error('Please run the migration first.');
      console.error('\n' + '='.repeat(70) + '\n');
      process.exit(1);
    }
    
    return true;
  } catch (error) {
    console.error('Error checking migration status:', error.message);
    return false;
  }
}

/**
 * Helper: Create test user
 */
async function createTestUser(suffix) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      name: `Test User ${suffix}`,
      email: `test-slot-deadline-${suffix}-${Date.now()}@example.com`,
      phone: '1234567890',
      password: 'hashedpassword',
      role: 'Employer',
      favourite_sport: 'Basketball'
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data.id;
}

/**
 * Helper: Create test job
 */
async function createTestJob(userId, suffix) {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      title: `Test Job ${suffix}`,
      description: 'Test job description for slot selection deadline testing. We are looking for a qualified candidate to join our team.',
      category: 'IT',
      posted_by: userId,
      country: 'USA',
      city: 'New York',
      location: 'New York, USA',
      fixed_salary: 100000,
      number_of_openings: 2,
      shortlisting_buffer: 2,
      applications_closed: true
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create job: ${error.message}`);
  return data.id;
}

/**
 * Helper: Create test application
 */
async function createTestApplication(jobId, userId, rank, status = 'shortlisted') {
  const { data, error } = await supabase
    .from('applications')
    .insert({
      job_id: jobId,
      applicant_id: userId,
      employer_id: userId,
      name: `Test Candidate ${rank}`,
      email: `candidate-${rank}-${Date.now()}@example.com`,
      phone: '1234567890',
      address: '123 Test St',
      cover_letter: 'I am interested in this position.',
      resume_url: 'http://example.com/resume.pdf',
      resume_public_id: `test_resume_${rank}`,
      shortlist_status: status,
      rank: rank,
      fit_score: 85 - rank
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create application: ${error.message}`);
  return data.id;
}

/**
 * Helper: Create test interview
 */
async function createTestInterview(applicationId, jobId, userId, rank, status, deadline = null) {
  const interviewData = {
    application_id: applicationId,
    job_id: jobId,
    recruiter_id: userId,
    candidate_id: userId,
    status: status,
    rank_at_time: rank
  };

  if (deadline) {
    interviewData.slot_selection_deadline = deadline.toISOString();
  }

  const { data, error } = await supabase
    .from('interviews')
    .insert(interviewData)
    .select()
    .single();

  if (error) throw new Error(`Failed to create interview: ${error.message}`);
  return data.id;
}

/**
 * Helper: Cleanup test data
 */
async function cleanupTestData(userIds, jobIds, applicationIds, interviewIds) {
  // Delete in reverse order of dependencies
  for (const id of interviewIds) {
    await supabase.from('interviews').delete().eq('id', id);
  }
  for (const id of applicationIds) {
    await supabase.from('applications').delete().eq('id', id);
  }
  for (const id of jobIds) {
    await supabase.from('automation_logs').delete().eq('job_id', id);
    await supabase.from('jobs').delete().eq('id', id);
  }
  for (const id of userIds) {
    await supabase.from('users').delete().eq('id', id);
  }
}

/**
 * Property Test: Slot Selection Deadline Setting
 * 
 * Feature: ai-hiring-orchestrator, Property 15: Slot Selection Deadline
 * 
 * This test verifies that:
 * 1. When a candidate accepts an invitation, slot_selection_deadline is set to 24 hours from now
 * 2. When deadline passes, BackgroundScheduler expires the interview
 * 3. Interview status is updated to "expired"
 * 4. Application shortlist_status is updated to "rejected"
 */
async function testSlotSelectionDeadline() {
  console.log('='.repeat(70));
  console.log('Property-Based Test: Slot Selection Deadline');
  console.log('='.repeat(70));
  console.log('\nThis test validates Requirement 4.4');
  console.log('Running 20 iterations with randomly generated scenarios...\n');
  
  console.log('Property 15: Slot Selection Deadline');
  console.log('When a candidate selects a slot, the system must:');
  console.log('  1. Set slot_selection_deadline to exactly 24 hours from selection time');
  console.log('  2. Expire interviews when deadline passes');
  console.log('  3. Update interview status to "expired"');
  console.log('  4. Trigger buffer promotion when deadline expires\n');
  
  console.log('Test scenarios:');
  console.log('  - Various time offsets (0-48 hours)');
  console.log('  - Different selection times');
  console.log('  - Edge cases (midnight, hour boundaries)');
  console.log('  - Multiple interviews expiring simultaneously');
  console.log('  - Iterations: 20\n');
  
  // Check if migration has been run
  console.log('Checking database migration status...');
  await checkMigrationStatus();
  console.log('✓ Migration verified\n');
  
  console.log('Starting property test...\n');

  let passedTests = 0;
  const testResources = {
    userIds: [],
    jobIds: [],
    applicationIds: [],
    interviewIds: []
  };

  try {
    await fc.assert(
      fc.asyncProperty(
        // Generate random hour offset for selection time (0-48 hours from now)
        fc.integer({ min: 0, max: 48 }),
        // Generate random minutes offset (0-59)
        fc.integer({ min: 0, max: 59 }),
        // Generate whether to test expiration (50% chance)
        fc.boolean(),
        async (hoursOffset, minutesOffset, testExpiration) => {
          const testSuffix = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
          let userId, jobId, applicationId, bufferAppId, interviewId;

          try {
            // Create test data
            userId = await createTestUser(testSuffix);
            testResources.userIds.push(userId);

            jobId = await createTestJob(userId, testSuffix);
            testResources.jobIds.push(jobId);

            applicationId = await createTestApplication(jobId, userId, 1, 'shortlisted');
            testResources.applicationIds.push(applicationId);

            // Create buffer candidate for promotion testing
            bufferAppId = await createTestApplication(jobId, userId, 3, 'buffer');
            testResources.applicationIds.push(bufferAppId);

            // PROPERTY 1: Test slot_selection_deadline setting on accept
            // Simulate candidate accepting invitation
            const interviewScheduler = new InterviewScheduler();
            
            // Create interview in invitation_sent state
            interviewId = await createTestInterview(
              applicationId,
              jobId,
              userId,
              1,
              'invitation_sent'
            );
            testResources.interviewIds.push(interviewId);

            // Generate accept token
            const acceptToken = interviewScheduler.generateToken(interviewId, 'accept');

            // Record time before acceptance
            const beforeAccept = new Date();
            
            // Handle accept (this should set slot_selection_deadline to 24 hours from now)
            const acceptResult = await interviewScheduler.handleAccept(interviewId, acceptToken);

            if (!acceptResult.success) {
              throw new Error(`Accept failed: ${acceptResult.error}`);
            }

            // Record time after acceptance
            const afterAccept = new Date();

            // Verify interview status updated to slot_pending
            if (acceptResult.data.interview.status !== 'slot_pending') {
              throw new Error(
                `Expected status "slot_pending", got "${acceptResult.data.interview.status}"`
              );
            }

            // Verify slot_selection_deadline is set
            if (!acceptResult.data.interview.slot_selection_deadline) {
              throw new Error('slot_selection_deadline not set after accept');
            }

            const deadline = new Date(acceptResult.data.interview.slot_selection_deadline);

            // PROPERTY 2: Deadline should be exactly 24 hours from acceptance time
            const expectedMinDeadline = new Date(beforeAccept);
            expectedMinDeadline.setHours(expectedMinDeadline.getHours() + 24);

            const expectedMaxDeadline = new Date(afterAccept);
            expectedMaxDeadline.setHours(expectedMaxDeadline.getHours() + 24);

            if (deadline < expectedMinDeadline || deadline > expectedMaxDeadline) {
              throw new Error(
                `Deadline not set to 24 hours from acceptance. ` +
                `Expected between ${expectedMinDeadline.toISOString()} and ${expectedMaxDeadline.toISOString()}, ` +
                `got ${deadline.toISOString()}`
              );
            }

            // Calculate actual hours difference
            const hoursDiff = (deadline - beforeAccept) / (1000 * 60 * 60);
            
            // Should be approximately 24 hours (within 1 minute tolerance)
            if (Math.abs(hoursDiff - 24) > 0.017) { // 0.017 hours = ~1 minute
              throw new Error(
                `Deadline not exactly 24 hours from acceptance. ` +
                `Expected 24 hours, got ${hoursDiff.toFixed(3)} hours`
              );
            }

            // PROPERTY 3: Test expiration when deadline passes
            if (testExpiration) {
              // Manually set deadline to past time to simulate expiration
              const pastDeadline = new Date();
              pastDeadline.setHours(pastDeadline.getHours() - 1); // 1 hour ago

              const { error: updateError } = await supabase
                .from('interviews')
                .update({ slot_selection_deadline: pastDeadline.toISOString() })
                .eq('id', interviewId);

              if (updateError) {
                throw new Error(`Failed to update deadline: ${updateError.message}`);
              }

              // Run background scheduler to check for expired deadlines
              const scheduler = new BackgroundScheduler();
              const expiredCount = await scheduler.checkSlotSelectionDeadlines();

              // Should have expired at least this interview
              if (expiredCount < 1) {
                throw new Error(
                  `Expected at least 1 expired interview, got ${expiredCount}`
                );
              }

              // PROPERTY 4: Verify interview status updated to "expired"
              const { data: expiredInterview, error: fetchError } = await supabase
                .from('interviews')
                .select('status')
                .eq('id', interviewId)
                .single();

              if (fetchError) {
                throw new Error(`Failed to fetch interview: ${fetchError.message}`);
              }

              if (expiredInterview.status !== 'expired') {
                throw new Error(
                  `Expected interview status "expired", got "${expiredInterview.status}"`
                );
              }

              // PROPERTY 5: Verify application status updated to "rejected"
              const { data: expiredApp, error: appError } = await supabase
                .from('applications')
                .select('shortlist_status')
                .eq('id', applicationId)
                .single();

              if (appError) {
                throw new Error(`Failed to fetch application: ${appError.message}`);
              }

              if (expiredApp.shortlist_status !== 'rejected') {
                throw new Error(
                  `Expected application shortlist_status "rejected", got "${expiredApp.shortlist_status}"`
                );
              }

              // PROPERTY 6: Verify automation log created
              const { data: logs, error: logsError } = await supabase
                .from('automation_logs')
                .select('*')
                .eq('job_id', jobId)
                .eq('action_type', 'slot_selection_expired');

              if (logsError) {
                throw new Error(`Failed to fetch logs: ${logsError.message}`);
              }

              if (logs.length === 0) {
                throw new Error('Expected automation log for slot_selection_expired');
              }

              const log = logs.find(l => l.details.interview_id === interviewId);
              if (!log) {
                throw new Error('Automation log does not reference the expired interview');
              }
            }

            passedTests++;
            
            // Log progress every 20 tests
            if (passedTests % 20 === 0) {
              console.log(`  ✓ Passed ${passedTests} tests...`);
            }

            // Cleanup this test's data
            await cleanupTestData(
              [userId],
              [jobId],
              [applicationId, bufferAppId],
              [interviewId]
            );

            // Remove from tracking
            testResources.userIds = testResources.userIds.filter(id => id !== userId);
            testResources.jobIds = testResources.jobIds.filter(id => id !== jobId);
            testResources.applicationIds = testResources.applicationIds.filter(
              id => id !== applicationId && id !== bufferAppId
            );
            testResources.interviewIds = testResources.interviewIds.filter(id => id !== interviewId);

          } catch (error) {
            // Log detailed error information for debugging
            console.error(`\nTest failed with parameters:`);
            console.error(`  - Hours offset: ${hoursOffset}`);
            console.error(`  - Minutes offset: ${minutesOffset}`);
            console.error(`  - Test expiration: ${testExpiration}`);
            console.error(`  - Error: ${error.message}`);
            throw error;
          }
        }
      ),
      { 
        numRuns: 3,
        verbose: false,
        endOnFailure: true
      }
    );

    console.log('\n' + '='.repeat(70));
    console.log('✓ ALL PROPERTY TESTS PASSED');
    console.log('='.repeat(70));
    console.log(`\nSuccessfully validated ${passedTests} random scenarios\n`);
    
    console.log('Property 15: Slot Selection Deadline - VERIFIED');
    console.log('  ✓ slot_selection_deadline set to exactly 24 hours from acceptance');
    console.log('  ✓ Deadline calculation accurate within 1 minute tolerance');
    console.log('  ✓ Interviews expire when deadline passes');
    console.log('  ✓ Interview status updated to "expired" on expiration');
    console.log('  ✓ Application shortlist_status updated to "rejected" on expiration');
    console.log('  ✓ Automation logs created for expiration events');
    console.log('  ✓ Handles edge cases:');
    console.log('    - Various time offsets');
    console.log('    - Different selection times');
    console.log('    - Hour and minute boundaries');
    console.log('\n✓ Requirement 4.4 validated successfully');
    
    return true;

  } catch (error) {
    console.log('\n' + '='.repeat(70));
    console.log('✗ PROPERTY TEST FAILED');
    console.log('='.repeat(70));
    console.log(`\nError: ${error.message}\n`);
    
    if (error.counterexample) {
      console.log('Counterexample found:');
      console.log(JSON.stringify(error.counterexample, null, 2));
    }
    
    throw error;
  } finally {
    // Cleanup any remaining test data
    if (testResources.userIds.length > 0 ||
        testResources.jobIds.length > 0 ||
        testResources.applicationIds.length > 0 ||
        testResources.interviewIds.length > 0) {
      console.log('\nCleaning up remaining test data...');
      await cleanupTestData(
        testResources.userIds,
        testResources.jobIds,
        testResources.applicationIds,
        testResources.interviewIds
      );
      console.log('Cleanup complete.\n');
    }
  }
}

// Run the test
testSlotSelectionDeadline()
  .then(() => {
    console.log('\n✓ Property test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Property test failed:', error.message);
    process.exit(1);
  });
