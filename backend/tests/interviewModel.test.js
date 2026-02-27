import { interviewModel } from '../models/interviewSchema.js';
import { supabase } from '../database/supabaseClient.js';

/**
 * Test suite for Interview Model
 * 
 * Tests CRUD operations and status transition validation
 * Requirements: 3.2, 3.3
 */

// Test data
const testJobId = '00000000-0000-0000-0000-000000000001';
const testApplicationId = '00000000-0000-0000-0000-000000000002';
const testRecruiterId = '00000000-0000-0000-0000-000000000003';
const testCandidateId = '00000000-0000-0000-0000-000000000004';

let createdInterviewId = null;

async function runTests() {
  console.log('Starting Interview Model Tests...\n');

  try {
    // Test 1: Create Interview
    await testCreateInterview();

    // Test 2: Get Interview by ID
    await testGetById();

    // Test 3: Get Interview by Application ID
    await testGetByApplicationId();

    // Test 4: Valid Status Transitions
    await testValidStatusTransitions();

    // Test 5: Invalid Status Transitions
    await testInvalidStatusTransitions();

    // Test 6: Update Interview Fields
    await testUpdateFields();

    // Test 7: Get Expired Interviews
    await testGetExpiredInterviews();

    // Test 8: Get Upcoming Interviews
    await testGetUpcomingInterviews();

    // Test 9: Get by Status
    await testGetByStatus();

    // Test 10: Validation Tests
    await testValidation();

    // Cleanup
    await cleanup();

    console.log('\n✅ All Interview Model tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await cleanup();
    process.exit(1);
  }
}

async function testCreateInterview() {
  console.log('Test 1: Create Interview');

  const confirmationDeadline = new Date();
  confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);

  const interviewData = {
    application_id: testApplicationId,
    job_id: testJobId,
    recruiter_id: testRecruiterId,
    candidate_id: testCandidateId,
    rank_at_time: 1,
    status: 'invitation_sent',
    confirmation_deadline: confirmationDeadline.toISOString(),
    no_show_risk: 0.3
  };

  const result = await interviewModel.create(interviewData);

  if (!result.success || !result.data) {
    throw new Error('Failed to create interview');
  }

  createdInterviewId = result.data.id;

  if (result.data.status !== 'invitation_sent') {
    throw new Error('Interview status not set correctly');
  }

  if (result.data.no_show_risk !== 0.3) {
    throw new Error('No-show risk not set correctly');
  }

  console.log('✓ Interview created successfully');
  console.log(`  Interview ID: ${createdInterviewId}`);
}

async function testGetById() {
  console.log('\nTest 2: Get Interview by ID');

  const result = await interviewModel.getById(createdInterviewId);

  if (!result.success || !result.data) {
    throw new Error('Failed to get interview by ID');
  }

  if (result.data.id !== createdInterviewId) {
    throw new Error('Retrieved wrong interview');
  }

  console.log('✓ Interview retrieved by ID successfully');
}

async function testGetByApplicationId() {
  console.log('\nTest 3: Get Interview by Application ID');

  const result = await interviewModel.getByApplicationId(testApplicationId);

  if (!result.success) {
    throw new Error('Failed to get interview by application ID');
  }

  if (result.data && result.data.application_id !== testApplicationId) {
    throw new Error('Retrieved wrong interview');
  }

  console.log('✓ Interview retrieved by application ID successfully');
}

async function testValidStatusTransitions() {
  console.log('\nTest 4: Valid Status Transitions');

  // Test: invitation_sent → slot_pending
  let result = await interviewModel.update(createdInterviewId, {
    status: 'slot_pending'
  });

  if (!result.success || result.data.status !== 'slot_pending') {
    throw new Error('Failed to transition invitation_sent → slot_pending');
  }
  console.log('✓ Valid transition: invitation_sent → slot_pending');

  // Test: slot_pending → confirmed
  const scheduledTime = new Date();
  scheduledTime.setDate(scheduledTime.getDate() + 7);

  result = await interviewModel.update(createdInterviewId, {
    status: 'confirmed',
    scheduled_time: scheduledTime.toISOString()
  });

  if (!result.success || result.data.status !== 'confirmed') {
    throw new Error('Failed to transition slot_pending → confirmed');
  }
  console.log('✓ Valid transition: slot_pending → confirmed');

  // Test: confirmed → completed
  result = await interviewModel.update(createdInterviewId, {
    status: 'completed'
  });

  if (!result.success || result.data.status !== 'completed') {
    throw new Error('Failed to transition confirmed → completed');
  }
  console.log('✓ Valid transition: confirmed → completed');
}

async function testInvalidStatusTransitions() {
  console.log('\nTest 5: Invalid Status Transitions');

  // Create a new interview for invalid transition tests
  const confirmationDeadline = new Date();
  confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);

  const interviewData = {
    application_id: testApplicationId,
    job_id: testJobId,
    recruiter_id: testRecruiterId,
    candidate_id: testCandidateId,
    rank_at_time: 2,
    status: 'invitation_sent',
    confirmation_deadline: confirmationDeadline.toISOString()
  };

  const createResult = await interviewModel.create(interviewData);
  const testInterviewId = createResult.data.id;

  // Test: invitation_sent → completed (invalid)
  try {
    await interviewModel.update(testInterviewId, {
      status: 'completed'
    });
    throw new Error('Should have rejected invalid transition invitation_sent → completed');
  } catch (error) {
    if (!error.message.includes('Invalid status transition')) {
      throw error;
    }
    console.log('✓ Invalid transition rejected: invitation_sent → completed');
  }

  // Test: invitation_sent → no_show (invalid)
  try {
    await interviewModel.update(testInterviewId, {
      status: 'no_show'
    });
    throw new Error('Should have rejected invalid transition invitation_sent → no_show');
  } catch (error) {
    if (!error.message.includes('Invalid status transition')) {
      throw error;
    }
    console.log('✓ Invalid transition rejected: invitation_sent → no_show');
  }

  // Cleanup test interview
  await interviewModel.delete(testInterviewId);
}

async function testUpdateFields() {
  console.log('\nTest 6: Update Interview Fields');

  // Create a new interview for update tests
  const confirmationDeadline = new Date();
  confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);

  const interviewData = {
    application_id: testApplicationId,
    job_id: testJobId,
    recruiter_id: testRecruiterId,
    candidate_id: testCandidateId,
    rank_at_time: 3,
    status: 'invitation_sent',
    confirmation_deadline: confirmationDeadline.toISOString()
  };

  const createResult = await interviewModel.create(interviewData);
  const testInterviewId = createResult.data.id;

  // Update calendar_event_id
  let result = await interviewModel.update(testInterviewId, {
    calendar_event_id: 'test-calendar-event-123'
  });

  if (result.data.calendar_event_id !== 'test-calendar-event-123') {
    throw new Error('Failed to update calendar_event_id');
  }
  console.log('✓ Calendar event ID updated');

  // Update no_show_risk
  result = await interviewModel.update(testInterviewId, {
    no_show_risk: 0.75
  });

  if (result.data.no_show_risk !== 0.75) {
    throw new Error('Failed to update no_show_risk');
  }
  console.log('✓ No-show risk updated');

  // Cleanup test interview
  await interviewModel.delete(testInterviewId);
}

async function testGetExpiredInterviews() {
  console.log('\nTest 7: Get Expired Interviews');

  // Create interview with expired confirmation deadline
  const pastDeadline = new Date();
  pastDeadline.setHours(pastDeadline.getHours() - 1);

  const expiredInterviewData = {
    application_id: testApplicationId,
    job_id: testJobId,
    recruiter_id: testRecruiterId,
    candidate_id: testCandidateId,
    rank_at_time: 4,
    status: 'invitation_sent',
    confirmation_deadline: pastDeadline.toISOString()
  };

  const createResult = await interviewModel.create(expiredInterviewData);
  const expiredInterviewId = createResult.data.id;

  // Get expired interviews
  const result = await interviewModel.getExpiredInterviews();

  if (!result.success) {
    throw new Error('Failed to get expired interviews');
  }

  const foundExpired = result.expiredConfirmation.some(
    interview => interview.id === expiredInterviewId
  );

  if (!foundExpired) {
    throw new Error('Expired interview not found in results');
  }

  console.log('✓ Expired interviews retrieved successfully');
  console.log(`  Found ${result.expiredConfirmation.length} expired confirmations`);
  console.log(`  Found ${result.expiredSlots.length} expired slot selections`);

  // Cleanup
  await interviewModel.delete(expiredInterviewId);
}

async function testGetUpcomingInterviews() {
  console.log('\nTest 8: Get Upcoming Interviews');

  // Create interview scheduled in 12 hours
  const futureTime = new Date();
  futureTime.setHours(futureTime.getHours() + 12);

  const upcomingInterviewData = {
    application_id: testApplicationId,
    job_id: testJobId,
    recruiter_id: testRecruiterId,
    candidate_id: testCandidateId,
    rank_at_time: 5,
    status: 'confirmed',
    scheduled_time: futureTime.toISOString()
  };

  const createResult = await interviewModel.create(upcomingInterviewData);
  const upcomingInterviewId = createResult.data.id;

  // Get upcoming interviews within 24 hours
  const result = await interviewModel.getUpcomingInterviews(24);

  if (!result.success) {
    throw new Error('Failed to get upcoming interviews');
  }

  const foundUpcoming = result.data.some(
    interview => interview.id === upcomingInterviewId
  );

  if (!foundUpcoming) {
    throw new Error('Upcoming interview not found in results');
  }

  console.log('✓ Upcoming interviews retrieved successfully');
  console.log(`  Found ${result.data.length} upcoming interviews`);

  // Cleanup
  await interviewModel.delete(upcomingInterviewId);
}

async function testGetByStatus() {
  console.log('\nTest 9: Get by Status');

  // Create interview with specific status
  const interviewData = {
    application_id: testApplicationId,
    job_id: testJobId,
    recruiter_id: testRecruiterId,
    candidate_id: testCandidateId,
    rank_at_time: 6,
    status: 'slot_pending'
  };

  const createResult = await interviewModel.create(interviewData);
  const testInterviewId = createResult.data.id;

  // Get interviews by status
  const result = await interviewModel.getByStatus('slot_pending');

  if (!result.success) {
    throw new Error('Failed to get interviews by status');
  }

  const foundInterview = result.data.some(
    interview => interview.id === testInterviewId
  );

  if (!foundInterview) {
    throw new Error('Interview not found in status results');
  }

  console.log('✓ Interviews retrieved by status successfully');
  console.log(`  Found ${result.data.length} interviews with status 'slot_pending'`);

  // Cleanup
  await interviewModel.delete(testInterviewId);
}

async function testValidation() {
  console.log('\nTest 10: Validation Tests');

  // Test: Missing required fields
  try {
    await interviewModel.create({
      job_id: testJobId,
      recruiter_id: testRecruiterId
      // Missing application_id, candidate_id, rank_at_time
    });
    throw new Error('Should have rejected missing required fields');
  } catch (error) {
    if (!error.message.includes('Missing required field')) {
      throw error;
    }
    console.log('✓ Missing required fields rejected');
  }

  // Test: Invalid no_show_risk (> 1)
  try {
    await interviewModel.create({
      application_id: testApplicationId,
      job_id: testJobId,
      recruiter_id: testRecruiterId,
      candidate_id: testCandidateId,
      rank_at_time: 1,
      no_show_risk: 1.5
    });
    throw new Error('Should have rejected invalid no_show_risk');
  } catch (error) {
    if (!error.message.includes('no_show_risk must be between 0 and 1')) {
      throw error;
    }
    console.log('✓ Invalid no_show_risk rejected');
  }

  // Test: Invalid status
  try {
    await interviewModel.create({
      application_id: testApplicationId,
      job_id: testJobId,
      recruiter_id: testRecruiterId,
      candidate_id: testCandidateId,
      rank_at_time: 1,
      status: 'invalid_status'
    });
    throw new Error('Should have rejected invalid status');
  } catch (error) {
    if (!error.message.includes('Invalid status')) {
      throw error;
    }
    console.log('✓ Invalid status rejected');
  }

  // Test: Get valid statuses
  const validStatuses = interviewModel.getValidStatuses();
  if (validStatuses.length !== 7) {
    throw new Error('Should return 7 valid statuses');
  }
  console.log('✓ Valid statuses retrieved');

  // Test: Get valid transitions
  const transitions = interviewModel.getValidTransitions('invitation_sent');
  if (!transitions.includes('slot_pending')) {
    throw new Error('Should include slot_pending in valid transitions');
  }
  console.log('✓ Valid transitions retrieved');
}

async function cleanup() {
  console.log('\nCleaning up test data...');

  if (createdInterviewId) {
    try {
      await interviewModel.delete(createdInterviewId);
      console.log('✓ Test data cleaned up');
    } catch (error) {
      console.log('Note: Cleanup may have already been done');
    }
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
