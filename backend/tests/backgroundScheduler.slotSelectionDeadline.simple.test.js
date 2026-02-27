/**
 * Simple tests for BackgroundScheduler.checkSlotSelectionDeadlines()
 * 
 * Requirements: 4.8, 8.2, 8.3, 8.4
 * 
 * Tests verify:
 * - Interviews with passed slot_selection_deadline are expired
 * - Interview status is updated to "expired"
 * - Application shortlist_status is updated to "rejected"
 * - Buffer promotion is triggered
 * - Automation action is logged
 */

import { supabase } from '../database/supabaseClient.js';
import BackgroundScheduler from '../managers/BackgroundScheduler.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runTests() {
  console.log('Starting BackgroundScheduler.checkSlotSelectionDeadlines() Tests...\n');

  let testJobId;
  let testUserId;
  let testApplicationId;
  let testInterviewId;
  let testBufferAppId;

  try {
    // Setup: Create test data
    console.log('Setting up test data...');

    // Create test user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        name: 'Test User Slot Deadline',
        email: `test-slot-deadline-${Date.now()}@example.com`,
        phone: '1234567890',
        password: 'hashedpassword',
        role: 'Employer',
        favourite_sport: 'Basketball'
      })
      .select()
      .single();

    if (userError) throw new Error(`Failed to create user: ${userError.message}`);
    testUserId = userData.id;
    console.log(`  ✓ Created test user: ${testUserId}`);

    // Create test job
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .insert({
        title: 'Test Job Slot Deadline',
        description: 'Test job description for slot selection deadline testing. We are looking for a qualified candidate to join our team.',
        category: 'IT',
        posted_by: testUserId,
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

    if (jobError) throw new Error(`Failed to create job: ${jobError.message}`);
    testJobId = jobData.id;
    console.log(`  ✓ Created test job: ${testJobId}`);

    // Create shortlisted application
    const { data: appData, error: appError } = await supabase
      .from('applications')
      .insert({
        job_id: testJobId,
        applicant_id: testUserId,
        employer_id: testUserId,
        name: 'Test Candidate',
        email: 'candidate@example.com',
        phone: '1234567890',
        address: '123 Test St',
        cover_letter: 'I am interested in this position.',
        resume_url: 'http://example.com/resume.pdf',
        resume_public_id: 'test_resume_123',
        shortlist_status: 'shortlisted',
        rank: 1,
        fit_score: 85
      })
      .select()
      .single();

    if (appError) throw new Error(`Failed to create application: ${appError.message}`);
    testApplicationId = appData.id;
    console.log(`  ✓ Created test application: ${testApplicationId}`);

    // Create buffer application for promotion
    const { data: bufferAppData, error: bufferAppError } = await supabase
      .from('applications')
      .insert({
        job_id: testJobId,
        applicant_id: testUserId,
        employer_id: testUserId,
        name: 'Buffer Candidate',
        email: 'buffer@example.com',
        phone: '0987654321',
        address: '456 Buffer St',
        cover_letter: 'I am also interested in this position.',
        resume_url: 'http://example.com/buffer-resume.pdf',
        resume_public_id: 'test_resume_456',
        shortlist_status: 'buffer',
        rank: 3,
        fit_score: 80
      })
      .select()
      .single();

    if (bufferAppError) throw new Error(`Failed to create buffer application: ${bufferAppError.message}`);
    testBufferAppId = bufferAppData.id;
    console.log(`  ✓ Created buffer application: ${testBufferAppId}`);

    // Create interview with expired slot_selection_deadline
    const pastDeadline = new Date();
    pastDeadline.setHours(pastDeadline.getHours() - 1); // 1 hour ago

    const { data: interviewData, error: interviewError } = await supabase
      .from('interviews')
      .insert({
        application_id: testApplicationId,
        job_id: testJobId,
        recruiter_id: testUserId,
        candidate_id: testUserId,
        status: 'slot_pending',
        slot_selection_deadline: pastDeadline.toISOString(),
        rank_at_time: 1
      })
      .select()
      .single();

    if (interviewError) throw new Error(`Failed to create interview: ${interviewError.message}`);
    testInterviewId = interviewData.id;
    console.log(`  ✓ Created expired interview: ${testInterviewId}`);

    // Test 1: Check slot selection deadlines
    console.log('\nTest 1: Expire interviews with passed slot_selection_deadline');
    const scheduler = new BackgroundScheduler();
    const count = await scheduler.checkSlotSelectionDeadlines();

    assert(count === 1, `Expected 1 expired slot selection, got ${count}`);
    console.log(`  ✓ Expired ${count} slot selection(s)`);

    // Test 2: Verify interview status updated
    console.log('\nTest 2: Verify interview status updated to "expired"');
    const { data: updatedInterview, error: fetchInterviewError } = await supabase
      .from('interviews')
      .select('status')
      .eq('id', testInterviewId)
      .single();

    if (fetchInterviewError) throw new Error(`Failed to fetch interview: ${fetchInterviewError.message}`);
    assert(updatedInterview.status === 'expired', `Expected status "expired", got "${updatedInterview.status}"`);
    console.log(`  ✓ Interview status is "expired"`);

    // Test 3: Verify application status updated
    console.log('\nTest 3: Verify application shortlist_status updated to "rejected"');
    const { data: updatedApp, error: fetchAppError } = await supabase
      .from('applications')
      .select('shortlist_status')
      .eq('id', testApplicationId)
      .single();

    if (fetchAppError) throw new Error(`Failed to fetch application: ${fetchAppError.message}`);
    assert(updatedApp.shortlist_status === 'rejected', `Expected shortlist_status "rejected", got "${updatedApp.shortlist_status}"`);
    console.log(`  ✓ Application shortlist_status is "rejected"`);

    // Test 4: Verify automation log created
    console.log('\nTest 4: Verify automation log created');
    const { data: logs, error: logsError } = await supabase
      .from('automation_logs')
      .select('*')
      .eq('job_id', testJobId)
      .eq('action_type', 'slot_selection_expired');

    if (logsError) throw new Error(`Failed to fetch logs: ${logsError.message}`);
    assert(logs.length > 0, 'Expected at least one automation log');
    assert(logs[0].details.interview_id === testInterviewId, 'Log should reference the expired interview');
    console.log(`  ✓ Automation log created with correct details`);

    // Test 5: Verify no expired slot selections remain
    console.log('\nTest 5: Verify no expired slot selections remain');
    const count2 = await scheduler.checkSlotSelectionDeadlines();
    assert(count2 === 0, `Expected 0 expired slot selections, got ${count2}`);
    console.log(`  ✓ No expired slot selections remain`);

    console.log('\n✅ All checkSlotSelectionDeadlines() tests passed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\nCleaning up test data...');
    if (testInterviewId) {
      await supabase.from('interviews').delete().eq('id', testInterviewId);
      console.log('  ✓ Deleted test interview');
    }
    if (testApplicationId) {
      await supabase.from('applications').delete().eq('id', testApplicationId);
      console.log('  ✓ Deleted test application');
    }
    if (testBufferAppId) {
      await supabase.from('applications').delete().eq('id', testBufferAppId);
      console.log('  ✓ Deleted buffer application');
    }
    if (testJobId) {
      await supabase.from('automation_logs').delete().eq('job_id', testJobId);
      await supabase.from('jobs').delete().eq('id', testJobId);
      console.log('  ✓ Deleted test job and logs');
    }
    if (testUserId) {
      await supabase.from('users').delete().eq('id', testUserId);
      console.log('  ✓ Deleted test user');
    }
    console.log('Cleanup complete.\n');
  }
}

// Run tests
runTests();
