/**
 * Simple tests for InterviewScheduler accept/reject handlers
 * 
 * Tests task 5.3: Implement accept/reject handlers
 * Requirements: 3.5, 3.6
 * 
 * Run with: node backend/tests/interviewScheduler.acceptReject.simple.test.js
 */

import { supabase } from '../database/supabaseClient.js';
import { interviewScheduler } from '../managers/InterviewScheduler.js';
import { interviewModel } from '../models/interviewSchema.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Testing InterviewScheduler Accept/Reject Handlers...\n');

let testJob;
let testUser;
let testCandidate;
let testApplication;
let testInterview;
let acceptToken;
let rejectToken;

// Helper function to clean up test data
async function cleanup() {
  try {
    if (testInterview) {
      await supabase.from('interviews').delete().eq('id', testInterview.id);
    }
    if (testApplication) {
      await supabase.from('applications').delete().eq('id', testApplication.id);
    }
    if (testJob) {
      await supabase.from('jobs').delete().eq('id', testJob.id);
    }
    if (testCandidate) {
      await supabase.from('users').delete().eq('id', testCandidate.id);
    }
    if (testUser) {
      await supabase.from('users').delete().eq('id', testUser.id);
    }
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
}

// Setup test data
async function setup() {
  try {
    console.log('Setting up test data...');

    // Create test user (recruiter)
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        name: 'Test Recruiter',
        email: `recruiter-${Date.now()}@test.com`,
        phone: 1234567890,
        password: 'hashedpassword',
        role: 'Employer',
        favourite_sport: 'Basketball'
      }])
      .select()
      .single();

    if (userError) throw userError;
    testUser = user;

    // Create test candidate
    const { data: candidate, error: candidateError } = await supabase
      .from('users')
      .insert([{
        name: 'Test Candidate',
        email: `candidate-${Date.now()}@test.com`,
        phone: 1234567891,
        password: 'hashedpassword',
        role: 'Job Seeker',
        favourite_sport: 'Soccer'
      }])
      .select()
      .single();

    if (candidateError) throw candidateError;
    testCandidate = candidate;

    // Create test job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert([{
        title: 'Test Job',
        description: 'Test job description with skills: Python, JavaScript, React. We are looking for a talented developer.',
        category: 'IT',
        country: 'USA',
        city: 'New York',
        location: 'New York, USA',
        fixed_salary: 100000,
        posted_by: testUser.id,
        number_of_openings: 3,
        shortlisting_buffer: 3,
        applications_closed: true
      }])
      .select()
      .single();

    if (jobError) throw jobError;
    testJob = job;

    // Create test application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert([{
        job_id: testJob.id,
        applicant_id: testCandidate.id,
        name: testCandidate.name,
        email: testCandidate.email,
        phone: testCandidate.phone,
        address: 'Test Address',
        cover_letter: 'Test cover letter',
        applicant_role: 'Job Seeker',
        employer_id: testUser.id,
        employer_role: 'Employer',
        resume_url: 'https://example.com/resume.pdf',
        resume_public_id: 'test_resume_1',
        fit_score: 85,
        rank: 1,
        shortlist_status: 'shortlisted',
        ai_processed: true
      }])
      .select()
      .single();

    if (appError) throw appError;
    testApplication = application;

    // Create test interview
    const confirmationDeadline = new Date();
    confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);

    const interviewResult = await interviewModel.create({
      application_id: testApplication.id,
      job_id: testJob.id,
      recruiter_id: testUser.id,
      candidate_id: testCandidate.id,
      rank_at_time: 1,
      status: 'invitation_sent',
      confirmation_deadline: confirmationDeadline,
      no_show_risk: 0.5
    });

    if (!interviewResult.success) throw new Error('Failed to create interview');
    testInterview = interviewResult.data;

    // Generate tokens
    acceptToken = interviewScheduler.generateToken(testInterview.id, 'accept');
    rejectToken = interviewScheduler.generateToken(testInterview.id, 'reject');

    console.log('✓ Test data setup complete\n');
  } catch (error) {
    console.error('✗ Setup failed:', error.message);
    await cleanup();
    process.exit(1);
  }
}

// Test 1: Accept invitation with valid token
async function testAcceptWithValidToken() {
  console.log('Test 1: Accept invitation with valid token');
  try {
    const result = await interviewScheduler.handleAccept(testInterview.id, acceptToken);

    if (!result.success) {
      throw new Error(`Accept failed: ${result.error}`);
    }

    if (result.data.interview.status !== 'slot_pending') {
      throw new Error(`Expected status 'slot_pending', got '${result.data.interview.status}'`);
    }

    if (!result.data.interview.slot_selection_deadline) {
      throw new Error('slot_selection_deadline not set');
    }

    if (!result.data.redirect.includes('/interview/select-slot/')) {
      throw new Error('Redirect URL not correct');
    }

    console.log('✓ Accept with valid token works correctly');
    console.log(`  Status: ${result.data.interview.status}`);
    console.log(`  Deadline: ${result.data.interview.slot_selection_deadline}`);
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    await cleanup();
    process.exit(1);
  }
}

// Test 2: Accept with invalid token
async function testAcceptWithInvalidToken() {
  console.log('\nTest 2: Accept with invalid token');
  try {
    // Create a new interview in invitation_sent state
    const confirmationDeadline = new Date();
    confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);

    const interviewResult = await interviewModel.create({
      application_id: testApplication.id,
      job_id: testJob.id,
      recruiter_id: testUser.id,
      candidate_id: testCandidate.id,
      rank_at_time: 1,
      status: 'invitation_sent',
      confirmation_deadline: confirmationDeadline,
      no_show_risk: 0.5
    });

    const newInterview = interviewResult.data;

    const result = await interviewScheduler.handleAccept(newInterview.id, 'invalid-token');

    if (result.success) {
      throw new Error('Should have rejected invalid token');
    }

    if (result.error !== 'Invalid or expired token') {
      throw new Error(`Expected 'Invalid or expired token', got '${result.error}'`);
    }

    // Clean up
    await supabase.from('interviews').delete().eq('id', newInterview.id);

    console.log('✓ Invalid token correctly rejected');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    await cleanup();
    process.exit(1);
  }
}

// Test 3: Reject invitation with valid token
async function testRejectWithValidToken() {
  console.log('\nTest 3: Reject invitation with valid token');
  try {
    // Create a new interview in invitation_sent state
    const confirmationDeadline = new Date();
    confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);

    const interviewResult = await interviewModel.create({
      application_id: testApplication.id,
      job_id: testJob.id,
      recruiter_id: testUser.id,
      candidate_id: testCandidate.id,
      rank_at_time: 1,
      status: 'invitation_sent',
      confirmation_deadline: confirmationDeadline,
      no_show_risk: 0.5
    });

    const newInterview = interviewResult.data;
    const newRejectToken = interviewScheduler.generateToken(newInterview.id, 'reject');

    // Reset application status
    await supabase
      .from('applications')
      .update({ shortlist_status: 'shortlisted' })
      .eq('id', testApplication.id);

    const result = await interviewScheduler.handleReject(newInterview.id, newRejectToken);

    if (!result.success) {
      throw new Error(`Reject failed: ${result.error}`);
    }

    if (result.data.interview.status !== 'cancelled') {
      throw new Error(`Expected status 'cancelled', got '${result.data.interview.status}'`);
    }

    // Check application status
    const { data: app } = await supabase
      .from('applications')
      .select('shortlist_status')
      .eq('id', testApplication.id)
      .single();

    if (app.shortlist_status !== 'rejected') {
      throw new Error(`Expected application status 'rejected', got '${app.shortlist_status}'`);
    }

    // Clean up
    await supabase.from('interviews').delete().eq('id', newInterview.id);

    console.log('✓ Reject with valid token works correctly');
    console.log(`  Interview status: ${result.data.interview.status}`);
    console.log(`  Application status: ${app.shortlist_status}`);
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    await cleanup();
    process.exit(1);
  }
}

// Test 4: Reject with invalid token
async function testRejectWithInvalidToken() {
  console.log('\nTest 4: Reject with invalid token');
  try {
    // Create a new interview in invitation_sent state
    const confirmationDeadline = new Date();
    confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);

    const interviewResult = await interviewModel.create({
      application_id: testApplication.id,
      job_id: testJob.id,
      recruiter_id: testUser.id,
      candidate_id: testCandidate.id,
      rank_at_time: 1,
      status: 'invitation_sent',
      confirmation_deadline: confirmationDeadline,
      no_show_risk: 0.5
    });

    const newInterview = interviewResult.data;

    const result = await interviewScheduler.handleReject(newInterview.id, 'invalid-token');

    if (result.success) {
      throw new Error('Should have rejected invalid token');
    }

    if (result.error !== 'Invalid or expired token') {
      throw new Error(`Expected 'Invalid or expired token', got '${result.error}'`);
    }

    // Clean up
    await supabase.from('interviews').delete().eq('id', newInterview.id);

    console.log('✓ Invalid token correctly rejected');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    await cleanup();
    process.exit(1);
  }
}

// Test 5: Wrong action token (reject token for accept)
async function testWrongActionToken() {
  console.log('\nTest 5: Wrong action token (reject token for accept)');
  try {
    // Create a new interview in invitation_sent state
    const confirmationDeadline = new Date();
    confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);

    const interviewResult = await interviewModel.create({
      application_id: testApplication.id,
      job_id: testJob.id,
      recruiter_id: testUser.id,
      candidate_id: testCandidate.id,
      rank_at_time: 1,
      status: 'invitation_sent',
      confirmation_deadline: confirmationDeadline,
      no_show_risk: 0.5
    });

    const newInterview = interviewResult.data;
    const newRejectToken = interviewScheduler.generateToken(newInterview.id, 'reject');

    const result = await interviewScheduler.handleAccept(newInterview.id, newRejectToken);

    if (result.success) {
      throw new Error('Should have rejected wrong action token');
    }

    if (result.error !== 'Invalid or expired token') {
      throw new Error(`Expected 'Invalid or expired token', got '${result.error}'`);
    }

    // Clean up
    await supabase.from('interviews').delete().eq('id', newInterview.id);

    console.log('✓ Wrong action token correctly rejected');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    await cleanup();
    process.exit(1);
  }
}

// Test 6: Automation logging
async function testAutomationLogging() {
  console.log('\nTest 6: Automation logging');
  try {
    // Create a new interview in invitation_sent state
    const confirmationDeadline = new Date();
    confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);

    const interviewResult = await interviewModel.create({
      application_id: testApplication.id,
      job_id: testJob.id,
      recruiter_id: testUser.id,
      candidate_id: testCandidate.id,
      rank_at_time: 1,
      status: 'invitation_sent',
      confirmation_deadline: confirmationDeadline,
      no_show_risk: 0.5
    });

    const newInterview = interviewResult.data;
    const newAcceptToken = interviewScheduler.generateToken(newInterview.id, 'accept');

    await interviewScheduler.handleAccept(newInterview.id, newAcceptToken);

    // Check automation log
    const { data: logs } = await supabase
      .from('automation_logs')
      .select('*')
      .eq('job_id', testJob.id)
      .eq('action_type', 'invitation_accepted')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!logs || logs.length === 0) {
      throw new Error('No automation log found');
    }

    if (logs[0].details.interview_id !== newInterview.id) {
      throw new Error('Log interview_id mismatch');
    }

    if (logs[0].details.new_status !== 'slot_pending') {
      throw new Error('Log status mismatch');
    }

    // Clean up
    await supabase.from('interviews').delete().eq('id', newInterview.id);

    console.log('✓ Automation logging works correctly');
    console.log(`  Action type: ${logs[0].action_type}`);
    console.log(`  Trigger source: ${logs[0].trigger_source}`);
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    await cleanup();
    process.exit(1);
  }
}

// Run all tests
async function runTests() {
  try {
    await setup();
    await testAcceptWithValidToken();
    await testAcceptWithInvalidToken();
    await testRejectWithValidToken();
    await testRejectWithInvalidToken();
    await testWrongActionToken();
    await testAutomationLogging();

    console.log('\n✓ All tests passed!');
    await cleanup();
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Test suite failed:', error.message);
    await cleanup();
    process.exit(1);
  }
}

// Run the tests
runTests();
