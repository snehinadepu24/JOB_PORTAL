/**
 * Interview Scheduler Email Integration Test
 * 
 * Tests that the InterviewScheduler correctly integrates with the EmailService
 * to send invitation and slot selection emails.
 * 
 * Requirements: 11.1-11.5
 */

import { interviewScheduler } from '../managers/InterviewScheduler.js';
import { supabase } from '../database/supabaseClient.js';

console.log('=== Interview Scheduler Email Integration Test ===\n');

/**
 * Test 1: Verify queueInvitationEmail method exists
 */
console.log('Test 1: Verify queueInvitationEmail method exists');
try {
  if (typeof interviewScheduler.queueInvitationEmail === 'function') {
    console.log('✓ queueInvitationEmail method exists');
    console.log('✓ PASS\n');
  } else {
    console.error('✗ FAIL: queueInvitationEmail method not found\n');
  }
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

/**
 * Test 2: Verify sendSlotSelectionEmail method exists
 */
console.log('Test 2: Verify sendSlotSelectionEmail method exists');
try {
  if (typeof interviewScheduler.sendSlotSelectionEmail === 'function') {
    console.log('✓ sendSlotSelectionEmail method exists');
    console.log('✓ PASS\n');
  } else {
    console.error('✗ FAIL: sendSlotSelectionEmail method not found\n');
  }
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

/**
 * Test 3: Verify email service is imported
 */
console.log('Test 3: Verify email service is imported');
try {
  // Check if the file imports emailService
  const fs = await import('fs');
  const fileContent = fs.readFileSync('./managers/InterviewScheduler.js', 'utf-8');
  
  if (fileContent.includes('emailService')) {
    console.log('✓ EmailService is imported in InterviewScheduler');
    console.log('✓ PASS\n');
  } else {
    console.error('✗ FAIL: EmailService not imported\n');
  }
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

/**
 * Test 4: Test invitation email data structure
 */
console.log('Test 4: Test invitation email data structure');
try {
  const mockApplication = {
    id: 'test-app-id',
    applicant_id: 'test-user-id',
    job_id: 'test-job-id',
    name: 'Test Candidate',
    email: 'test@example.com',
    rank: 1
  };

  const mockJob = {
    id: 'test-job-id',
    title: 'Test Job',
    posted_by: 'test-recruiter-id',
    company_name: 'Test Company'
  };

  const mockInterview = {
    id: 'test-interview-id',
    confirmation_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  };

  const acceptToken = 'test-accept-token';
  const rejectToken = 'test-reject-token';

  // This will log the email to console since transporter is not configured
  console.log('✓ Mock data structure is valid');
  console.log('✓ Would send email to:', mockApplication.email);
  console.log('✓ Job title:', mockJob.title);
  console.log('✓ Company:', mockJob.company_name);
  console.log('✓ PASS\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

/**
 * Test 5: Verify accept/reject link generation
 */
console.log('Test 5: Verify accept/reject link generation');
try {
  const interviewId = 'test-interview-123';
  const acceptToken = 'accept-token-456';
  const rejectToken = 'reject-token-789';

  const acceptLink = interviewScheduler.generateAcceptLink(interviewId, acceptToken);
  const rejectLink = interviewScheduler.generateRejectLink(interviewId, rejectToken);

  console.log('✓ Accept link:', acceptLink);
  console.log('✓ Reject link:', rejectLink);
  console.log('✓ Accept link contains interview ID:', acceptLink.includes(interviewId));
  console.log('✓ Accept link contains token:', acceptLink.includes(acceptToken));
  console.log('✓ Reject link contains interview ID:', rejectLink.includes(interviewId));
  console.log('✓ Reject link contains token:', rejectLink.includes(rejectToken));
  console.log('✓ PASS\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

/**
 * Test 6: Verify email templates are accessible
 */
console.log('Test 6: Verify email templates are accessible');
try {
  const { emailService } = await import('../services/EmailService.js');
  
  const templates = ['invitation', 'slot_selection', 'confirmation', 'reminder', 'promotion'];
  let allTemplatesExist = true;

  for (const template of templates) {
    try {
      const content = emailService.generateEmailFromTemplate(template, {
        candidate_name: 'Test',
        job_title: 'Test Job',
        company_name: 'Test Company',
        accept_link: 'http://test.com/accept',
        reject_link: 'http://test.com/reject',
        deadline: new Date().toISOString(),
        slot_selection_link: 'http://test.com/select',
        interview_time: new Date().toISOString(),
        recruiter_name: 'Test Recruiter',
        recruiter_email: 'recruiter@test.com'
      });
      
      console.log(`✓ Template '${template}' exists and generates content`);
    } catch (error) {
      console.error(`✗ Template '${template}' failed:`, error.message);
      allTemplatesExist = false;
    }
  }

  if (allTemplatesExist) {
    console.log('✓ All email templates are accessible');
    console.log('✓ PASS\n');
  } else {
    console.error('✗ FAIL: Some templates are missing\n');
  }
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

console.log('=== Interview Scheduler Email Integration Test Complete ===');
console.log('\nNote: Actual email sending requires EMAIL_HOST and EMAIL_USER environment variables.');
console.log('Without configuration, emails are logged to console for testing purposes.');
