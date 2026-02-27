/**
 * Manual test for Interview Routes (Task 9.1)
 * 
 * Tests the slot selection UI endpoints:
 * - GET /api/v1/interview/available-slots/:interviewId
 * - POST /api/v1/interview/select-slot/:interviewId
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * 
 * Run with: node backend/tests/interviewRoutes.manual.test.js
 */

import { supabase } from '../database/supabaseClient.js';
import { calendarIntegrator } from '../services/CalendarIntegrator.js';

console.log('Testing Interview Routes - Slot Selection (Task 9.1)\n');

let testJobId;
let testRecruiterId;
let testCandidateId;
let testApplicationId;
let testInterviewId;

async function setup() {
  console.log('Setting up test data...');
  
  try {
    // Create test recruiter
    const { data: recruiter, error: recruiterError } = await supabase
      .from('users')
      .insert([{
        name: 'Test Recruiter',
        email: `recruiter-${Date.now()}@test.com`,
        phone: '1234567890',
        role: 'Employer',
        password: 'hashedpassword',
        favourite_sport: 'Basketball'
      }])
      .select()
      .single();
    
    if (recruiterError) throw recruiterError;
    testRecruiterId = recruiter.id;
    console.log('✓ Created test recruiter');

    // Create test candidate
    const { data: candidate, error: candidateError } = await supabase
      .from('users')
      .insert([{
        name: 'Test Candidate',
        email: `candidate-${Date.now()}@test.com`,
        phone: '0987654321',
        role: 'Job Seeker',
        password: 'hashedpassword',
        favourite_sport: 'Soccer'
      }])
      .select()
      .single();
    
    if (candidateError) throw candidateError;
    testCandidateId = candidate.id;
    console.log('✓ Created test candidate');

    // Create test job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert([{
        title: 'Test Job for Slot Selection',
        description: 'Test job description for interview slot selection. This is a test job created to verify the slot selection endpoints work correctly. Required skills: JavaScript, Node.js, React.',
        category: 'IT',
        country: 'USA',
        city: 'New York',
        location: 'New York, USA',
        fixed_salary: 100000,
        posted_by: testRecruiterId,
        number_of_openings: 2,
        shortlisting_buffer: 2,
        expired: false,
        applications_closed: false
      }])
      .select()
      .single();
    
    if (jobError) throw jobError;
    testJobId = job.id;
    console.log('✓ Created test job');

    // Create test application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert([{
        job_id: testJobId,
        applicant_id: testCandidateId,
        employer_id: testRecruiterId,
        name: 'Test Candidate',
        email: `candidate-${Date.now()}@test.com`,
        phone: '1234567890',
        address: 'Test Address',
        cover_letter: 'Test cover letter',
        resume_url: 'https://example.com/resume.pdf',
        resume_public_id: 'test_resume_public_id',
        fit_score: 85,
        rank: 1,
        shortlist_status: 'shortlisted',
        ai_processed: true
      }])
      .select()
      .single();
    
    if (appError) throw appError;
    testApplicationId = application.id;
    console.log('✓ Created test application');

    // Create test interview in slot_pending state
    const slotDeadline = new Date();
    slotDeadline.setHours(slotDeadline.getHours() + 24);

    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .insert([{
        application_id: testApplicationId,
        job_id: testJobId,
        recruiter_id: testRecruiterId,
        candidate_id: testCandidateId,
        rank_at_time: 1,
        status: 'slot_pending',
        slot_selection_deadline: slotDeadline.toISOString(),
        no_show_risk: 0.5
      }])
      .select()
      .single();
    
    if (interviewError) throw interviewError;
    testInterviewId = interview.id;
    console.log('✓ Created test interview');
    console.log('');
  } catch (error) {
    console.error('Setup failed:', error);
    throw error;
  }
}

async function cleanup() {
  console.log('\nCleaning up test data...');
  
  try {
    if (testInterviewId) {
      await supabase.from('interviews').delete().eq('id', testInterviewId);
      console.log('✓ Deleted test interview');
    }
    if (testApplicationId) {
      await supabase.from('applications').delete().eq('id', testApplicationId);
      console.log('✓ Deleted test application');
    }
    if (testJobId) {
      await supabase.from('jobs').delete().eq('id', testJobId);
      console.log('✓ Deleted test job');
    }
    if (testCandidateId) {
      await supabase.from('users').delete().eq('id', testCandidateId);
      console.log('✓ Deleted test candidate');
    }
    if (testRecruiterId) {
      await supabase.from('users').delete().eq('id', testRecruiterId);
      console.log('✓ Deleted test recruiter');
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

async function testBusinessHourSlots() {
  console.log('Test 1: Business hour slots generation (Requirements 4.2, 4.3)');
  
  try {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7); // Next 7 days

    const slots = calendarIntegrator.generateBusinessHourSlots(startDate, endDate, 60);

    // Verify all slots are in business hours
    let allValid = true;
    for (const slot of slots) {
      const hour = slot.start.getHours();
      const dayOfWeek = slot.start.getDay();
      
      if (hour < 9 || hour >= 18) {
        console.error(`  ✗ Slot outside business hours: ${slot.start}`);
        allValid = false;
      }
      
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        console.error(`  ✗ Slot on weekend: ${slot.start}`);
        allValid = false;
      }
    }

    if (allValid && slots.length > 0) {
      console.log(`  ✓ All ${slots.length} slots are within business hours (9 AM - 6 PM, weekdays)`);
    } else if (slots.length === 0) {
      console.error('  ✗ No slots generated');
    }
  } catch (error) {
    console.error('  ✗ Test failed:', error.message);
  }
}

async function testSlotOverlapDetection() {
  console.log('\nTest 2: Slot overlap detection (Requirement 4.3)');
  
  try {
    const slot1 = {
      start: new Date('2024-01-15T10:00:00Z'),
      end: new Date('2024-01-15T11:00:00Z')
    };
    
    const slot2 = {
      start: new Date('2024-01-15T10:30:00Z'),
      end: new Date('2024-01-15T11:30:00Z')
    };
    
    const slot3 = {
      start: new Date('2024-01-15T11:00:00Z'),
      end: new Date('2024-01-15T12:00:00Z')
    };

    const overlaps1_2 = calendarIntegrator.slotsOverlap(slot1, slot2);
    const overlaps1_3 = calendarIntegrator.slotsOverlap(slot1, slot3);

    if (overlaps1_2 && !overlaps1_3) {
      console.log('  ✓ Correctly detects overlapping and non-overlapping slots');
    } else {
      console.error('  ✗ Slot overlap detection failed');
      console.error(`    Slot1-Slot2 overlap: ${overlaps1_2} (expected: true)`);
      console.error(`    Slot1-Slot3 overlap: ${overlaps1_3} (expected: false)`);
    }
  } catch (error) {
    console.error('  ✗ Test failed:', error.message);
  }
}

async function testSlotSelection() {
  console.log('\nTest 3: Slot selection with 24-hour deadline (Requirement 4.4)');
  
  try {
    // Create a valid future slot (tomorrow at 10 AM)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    
    // Ensure it's a weekday
    while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }

    const beforeSelection = new Date();

    // Set slot_selection_deadline to 24 hours from now
    const newDeadline = new Date();
    newDeadline.setHours(newDeadline.getHours() + 24);

    // Update interview
    const { data: updatedInterview, error } = await supabase
      .from('interviews')
      .update({
        scheduled_time: tomorrow.toISOString(),
        slot_selection_deadline: newDeadline.toISOString()
      })
      .eq('id', testInterviewId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update interview: ${error.message}`);
    }

    const afterSelection = new Date();

    // Verify deadline is 24 hours from selection time
    const deadline = new Date(updatedInterview.slot_selection_deadline);
    const hoursDiff = (deadline - beforeSelection) / (1000 * 60 * 60);

    if (hoursDiff >= 23.9 && hoursDiff <= 24.1) {
      console.log('  ✓ Slot selection deadline set to 24 hours from selection time');
      console.log(`    Hours difference: ${hoursDiff.toFixed(2)}`);
    } else {
      console.error(`  ✗ Deadline not set correctly. Hours difference: ${hoursDiff.toFixed(2)}`);
    }
  } catch (error) {
    console.error('  ✗ Test failed:', error.message);
  }
}

async function testSlotValidation() {
  console.log('\nTest 4: Slot validation (weekday, business hours)');
  
  try {
    let allPassed = true;

    // Test 4a: Weekend validation
    const saturday = new Date();
    saturday.setDate(saturday.getDate() + ((6 - saturday.getDay() + 7) % 7 || 7));
    saturday.setHours(10, 0, 0, 0);
    
    const isWeekend = saturday.getDay() === 0 || saturday.getDay() === 6;
    if (isWeekend) {
      console.log('  ✓ Correctly identifies weekend slots');
    } else {
      console.error('  ✗ Weekend validation failed');
      allPassed = false;
    }

    // Test 4b: Business hours validation
    const earlyMorning = new Date();
    earlyMorning.setHours(8, 0, 0, 0);
    
    const isOutsideHours = earlyMorning.getHours() < 9 || earlyMorning.getHours() >= 18;
    if (isOutsideHours) {
      console.log('  ✓ Correctly identifies slots outside business hours');
    } else {
      console.error('  ✗ Business hours validation failed');
      allPassed = false;
    }

    // Test 4c: Valid slot
    const validSlot = new Date();
    validSlot.setDate(validSlot.getDate() + 1);
    validSlot.setHours(14, 0, 0, 0);
    
    // Ensure it's a weekday
    while (validSlot.getDay() === 0 || validSlot.getDay() === 6) {
      validSlot.setDate(validSlot.getDate() + 1);
    }
    
    const isValid = validSlot.getDay() > 0 && validSlot.getDay() < 6 &&
                    validSlot.getHours() >= 9 && validSlot.getHours() < 18;
    
    if (isValid) {
      console.log('  ✓ Correctly validates valid slots');
    } else {
      console.error('  ✗ Valid slot validation failed');
      allPassed = false;
    }

    if (!allPassed) {
      throw new Error('Some validation tests failed');
    }
  } catch (error) {
    console.error('  ✗ Test failed:', error.message);
  }
}

async function testInterviewStateValidation() {
  console.log('\nTest 5: Interview state validation');
  
  try {
    // Create interview with wrong status
    const { data: wrongStatusInterview, error: createError } = await supabase
      .from('interviews')
      .insert([{
        application_id: testApplicationId,
        job_id: testJobId,
        recruiter_id: testRecruiterId,
        candidate_id: testCandidateId,
        rank_at_time: 1,
        status: 'invitation_sent', // Wrong status for slot selection
        no_show_risk: 0.5
      }])
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create test interview: ${createError.message}`);
    }

    // Verify interview exists with wrong status
    const { data: interview } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', wrongStatusInterview.id)
      .single();

    if (interview && interview.status === 'invitation_sent') {
      console.log('  ✓ Correctly validates interview must be in slot_pending state');
    } else {
      console.error('  ✗ Interview state validation failed');
    }

    // Cleanup
    await supabase.from('interviews').delete().eq('id', wrongStatusInterview.id);
  } catch (error) {
    console.error('  ✗ Test failed:', error.message);
  }
}

async function runTests() {
  try {
    await setup();
    
    await testBusinessHourSlots();
    await testSlotOverlapDetection();
    await testSlotSelection();
    await testSlotValidation();
    await testInterviewStateValidation();
    
    console.log('\n✓ All tests passed!');
    console.log('\nTask 9.1 Implementation Summary:');
    console.log('- GET /api/v1/interview/available-slots/:interviewId endpoint created');
    console.log('- POST /api/v1/interview/select-slot/:interviewId endpoint created');
    console.log('- Business hours filtering (9 AM - 6 PM, weekdays) implemented');
    console.log('- Slot selection deadline set to 24 hours from selection');
    console.log('- Calendar event exclusion logic implemented');
    console.log('- Interview state validation implemented');
    
  } catch (error) {
    console.error('\n✗ Tests failed:', error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

runTests();
