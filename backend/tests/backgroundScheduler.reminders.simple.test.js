/**
 * Simple test for BackgroundScheduler interview reminder functionality
 * 
 * Tests Task 10.5: sendInterviewReminders()
 * 
 * Requirements: 11.7
 */

import { supabase } from '../database/supabaseClient.js';
import BackgroundScheduler from '../managers/BackgroundScheduler.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function runTests() {
  console.log('Starting BackgroundScheduler Interview Reminders Tests...\n');

  let testData = {};

  try {
    // Setup test data
    await setupTestData(testData);

    // Test 1: Send reminders for interviews in 24-hour window
    await testSendRemindersIn24Hours(testData);

    // Test 2: Don't send reminders outside 24-hour window
    await testNoRemindersOutsideWindow(testData);

    // Test 3: Don't send duplicate reminders
    await testNoDuplicateReminders(testData);

    // Test 4: Only send reminders for confirmed interviews
    await testOnlyConfirmedInterviews(testData);

    console.log('\n✅ All BackgroundScheduler reminder tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Clean up test data
    await cleanupTestData(testData);
  }
}

async function setupTestData(testData) {
  console.log('Setting up test data...');

  // Create test recruiter
  const { data: recruiter, error: recruiterError } = await supabase
    .from('users')
    .insert([{
      name: 'Test Recruiter',
      email: `recruiter-${Date.now()}@test.com`,
      phone: '1234567890',
      password: 'hashedpassword',
      role: 'Employer',
      favourite_sport: 'Basketball'
    }])
    .select()
    .single();

  if (recruiterError) throw recruiterError;
  testData.recruiterId = recruiter.id;

  // Create test candidate
  const { data: candidate, error: candidateError } = await supabase
    .from('users')
    .insert([{
      name: 'Test Candidate',
      email: `candidate-${Date.now()}@test.com`,
      phone: '0987654321',
      password: 'hashedpassword',
      role: 'Job Seeker',
      favourite_sport: 'Soccer'
    }])
    .select()
    .single();

  if (candidateError) throw candidateError;
  testData.candidateId = candidate.id;

  // Create test job
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert([{
      title: 'Test Job Reminders',
      description: 'Test job description for reminder testing. We are looking for a qualified candidate.',
      category: 'IT',
      posted_by: testData.recruiterId,
      country: 'USA',
      city: 'New York',
      location: 'New York, USA',
      fixed_salary: 100000,
      number_of_openings: 1,
      shortlisting_buffer: 1,
      applications_closed: true,
      expired: false
    }])
    .select()
    .single();

  if (jobError) throw jobError;
  testData.jobId = job.id;

  // Create test application
  const { data: application, error: appError } = await supabase
    .from('applications')
    .insert([{
      job_id: testData.jobId,
      applicant_id: testData.candidateId,
      applicant_role: 'Job Seeker',
      employer_id: testData.recruiterId,
      employer_role: 'Employer',
      name: 'Test Candidate',
      email: `candidate-${Date.now()}@test.com`,
      phone: '0987654321',
      address: '123 Test St',
      cover_letter: 'I am interested in this position.',
      resume_url: 'https://example.com/resume.pdf',
      resume_public_id: 'test_resume_123',
      fit_score: 85,
      shortlist_status: 'shortlisted',
      rank: 1,
      ai_processed: true
    }])
    .select()
    .single();

  if (appError) throw appError;
  testData.applicationId = application.id;

  testData.interviewIds = [];
  console.log('Test data setup complete\n');
}

async function cleanupTestData(testData) {
  console.log('\nCleaning up test data...');

  // Clean up interviews
  if (testData.interviewIds && testData.interviewIds.length > 0) {
    for (const interviewId of testData.interviewIds) {
      await supabase.from('interviews').delete().eq('id', interviewId);
    }
  }

  // Clean up automation logs
  await supabase
    .from('automation_logs')
    .delete()
    .eq('action_type', 'interview_reminder_sent');

  // Clean up application
  if (testData.applicationId) {
    await supabase.from('applications').delete().eq('id', testData.applicationId);
  }

  // Clean up job
  if (testData.jobId) {
    await supabase.from('jobs').delete().eq('id', testData.jobId);
  }

  // Clean up users
  if (testData.candidateId) {
    await supabase.from('users').delete().eq('id', testData.candidateId);
  }
  if (testData.recruiterId) {
    await supabase.from('users').delete().eq('id', testData.recruiterId);
  }

  console.log('Cleanup complete');
}

async function testSendRemindersIn24Hours(testData) {
  console.log('Test 1: Send reminders for interviews in 24-hour window');

  const scheduler = new BackgroundScheduler();

  // Create interview scheduled in 24 hours
  const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .insert([{
      application_id: testData.applicationId,
      job_id: testData.jobId,
      recruiter_id: testData.recruiterId,
      candidate_id: testData.candidateId,
      status: 'confirmed',
      scheduled_time: scheduledTime.toISOString(),
      rank_at_time: 1,
      no_show_risk: 0.3
    }])
    .select()
    .single();

  if (interviewError) throw interviewError;
  testData.interviewIds.push(interview.id);

  // Send reminders
  const reminderCount = await scheduler.sendInterviewReminders();

  // Should send 1 reminder
  assert(reminderCount === 1, `Expected 1 reminder, got ${reminderCount}`);

  // Verify automation log was created
  const { data: logs, error: logsError } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('action_type', 'interview_reminder_sent')
    .eq('details->>interview_id', interview.id);

  assert(!logsError, `Error fetching logs: ${logsError?.message}`);
  assert(logs.length === 1, `Expected 1 log entry, got ${logs.length}`);
  assert(logs[0].details.interview_id === interview.id, 'Log interview_id mismatch');
  assert(logs[0].details.candidate_id === testData.candidateId, 'Log candidate_id mismatch');
  assert(logs[0].details.recruiter_id === testData.recruiterId, 'Log recruiter_id mismatch');

  console.log('✓ Test 1 passed\n');
}

async function testNoRemindersOutsideWindow(testData) {
  console.log('Test 2: Don\'t send reminders outside 24-hour window');

  const scheduler = new BackgroundScheduler();

  // Create interview scheduled in 48 hours (outside window)
  const scheduledTime = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .insert([{
      application_id: testData.applicationId,
      job_id: testData.jobId,
      recruiter_id: testData.recruiterId,
      candidate_id: testData.candidateId,
      status: 'confirmed',
      scheduled_time: scheduledTime.toISOString(),
      rank_at_time: 1,
      no_show_risk: 0.3
    }])
    .select()
    .single();

  if (interviewError) throw interviewError;
  testData.interviewIds.push(interview.id);

  // Send reminders
  const reminderCount = await scheduler.sendInterviewReminders();

  // Should not send any reminders
  assert(reminderCount === 0, `Expected 0 reminders, got ${reminderCount}`);

  // Verify no automation log was created for this interview
  const { data: logs, error: logsError } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('action_type', 'interview_reminder_sent')
    .eq('details->>interview_id', interview.id);

  assert(!logsError, `Error fetching logs: ${logsError?.message}`);
  assert(logs.length === 0, `Expected 0 log entries, got ${logs.length}`);

  console.log('✓ Test 2 passed\n');
}

async function testNoDuplicateReminders(testData) {
  console.log('Test 3: Don\'t send duplicate reminders');

  const scheduler = new BackgroundScheduler();

  // Create interview scheduled in 24 hours
  const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .insert([{
      application_id: testData.applicationId,
      job_id: testData.jobId,
      recruiter_id: testData.recruiterId,
      candidate_id: testData.candidateId,
      status: 'confirmed',
      scheduled_time: scheduledTime.toISOString(),
      rank_at_time: 1,
      no_show_risk: 0.3
    }])
    .select()
    .single();

  if (interviewError) throw interviewError;
  testData.interviewIds.push(interview.id);

  // Send reminders first time
  const firstCount = await scheduler.sendInterviewReminders();
  assert(firstCount === 1, `Expected 1 reminder on first call, got ${firstCount}`);

  // Send reminders second time
  const secondCount = await scheduler.sendInterviewReminders();
  assert(secondCount === 0, `Expected 0 reminders on second call (duplicate), got ${secondCount}`);

  // Verify only one automation log exists
  const { data: logs, error: logsError } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('action_type', 'interview_reminder_sent')
    .eq('details->>interview_id', interview.id);

  assert(!logsError, `Error fetching logs: ${logsError?.message}`);
  assert(logs.length === 1, `Expected 1 log entry, got ${logs.length}`);

  console.log('✓ Test 3 passed\n');
}

async function testOnlyConfirmedInterviews(testData) {
  console.log('Test 4: Only send reminders for confirmed interviews');

  const scheduler = new BackgroundScheduler();

  // Create interview with status="slot_pending" (not confirmed)
  const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .insert([{
      application_id: testData.applicationId,
      job_id: testData.jobId,
      recruiter_id: testData.recruiterId,
      candidate_id: testData.candidateId,
      status: 'slot_pending',
      scheduled_time: scheduledTime.toISOString(),
      rank_at_time: 1,
      no_show_risk: 0.3
    }])
    .select()
    .single();

  if (interviewError) throw interviewError;
  testData.interviewIds.push(interview.id);

  // Send reminders
  const reminderCount = await scheduler.sendInterviewReminders();

  // Should not send any reminders (status is not "confirmed")
  assert(reminderCount === 0, `Expected 0 reminders for non-confirmed interview, got ${reminderCount}`);

  console.log('✓ Test 4 passed\n');
}

// Run tests
runTests();
