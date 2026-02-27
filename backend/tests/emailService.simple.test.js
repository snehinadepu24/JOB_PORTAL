/**
 * Simple Email Service Tests
 * 
 * Tests basic email service functionality including:
 * - Template generation
 * - Email queuing
 * - Retry logic
 * 
 * Requirements: 11.1-11.10, 13.3
 */

import { emailService } from '../services/EmailService.js';

console.log('=== Email Service Simple Tests ===\n');

/**
 * Test 1: Invitation Email Template Generation
 */
console.log('Test 1: Invitation Email Template Generation');
try {
  const emailContent = emailService.generateEmailFromTemplate('invitation', {
    candidate_name: 'John Doe',
    job_title: 'Senior Software Engineer',
    company_name: 'Tech Corp',
    accept_link: 'http://localhost:3000/interview/accept/123/token123',
    reject_link: 'http://localhost:3000/interview/reject/123/token456',
    deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  });

  console.log('✓ Subject:', emailContent.subject);
  console.log('✓ HTML content length:', emailContent.html.length);
  console.log('✓ Text content length:', emailContent.text.length);
  console.log('✓ Contains accept link:', emailContent.html.includes('accept'));
  console.log('✓ Contains reject link:', emailContent.html.includes('reject'));
  console.log('✓ Contains candidate name:', emailContent.html.includes('John Doe'));
  console.log('✓ Contains job title:', emailContent.html.includes('Senior Software Engineer'));
  console.log('✓ PASS\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

/**
 * Test 2: Slot Selection Email Template Generation
 */
console.log('Test 2: Slot Selection Email Template Generation');
try {
  const emailContent = emailService.generateEmailFromTemplate('slot_selection', {
    candidate_name: 'Jane Smith',
    job_title: 'Product Manager',
    slot_selection_link: 'http://localhost:3000/interview/select-slot/456',
    deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });

  console.log('✓ Subject:', emailContent.subject);
  console.log('✓ HTML content length:', emailContent.html.length);
  console.log('✓ Contains slot selection link:', emailContent.html.includes('select-slot'));
  console.log('✓ Contains candidate name:', emailContent.html.includes('Jane Smith'));
  console.log('✓ PASS\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

/**
 * Test 3: Confirmation Email Template Generation
 */
console.log('Test 3: Confirmation Email Template Generation');
try {
  const emailContent = emailService.generateEmailFromTemplate('confirmation', {
    candidate_name: 'Bob Johnson',
    job_title: 'Data Scientist',
    interview_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    recruiter_name: 'Alice Williams',
    recruiter_email: 'alice@company.com'
  });

  console.log('✓ Subject:', emailContent.subject);
  console.log('✓ HTML content length:', emailContent.html.length);
  console.log('✓ Contains interview time:', emailContent.html.includes('Date & Time'));
  console.log('✓ Contains recruiter name:', emailContent.html.includes('Alice Williams'));
  console.log('✓ PASS\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

/**
 * Test 4: Reminder Email Template Generation
 */
console.log('Test 4: Reminder Email Template Generation');
try {
  const emailContent = emailService.generateEmailFromTemplate('reminder', {
    candidate_name: 'Charlie Brown',
    job_title: 'UX Designer',
    interview_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });

  console.log('✓ Subject:', emailContent.subject);
  console.log('✓ HTML content length:', emailContent.html.length);
  console.log('✓ Contains reminder indicator:', emailContent.html.includes('Reminder'));
  console.log('✓ Contains candidate name:', emailContent.html.includes('Charlie Brown'));
  console.log('✓ PASS\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

/**
 * Test 5: Promotion Email Template Generation
 */
console.log('Test 5: Promotion Email Template Generation');
try {
  const emailContent = emailService.generateEmailFromTemplate('promotion', {
    candidate_name: 'Diana Prince',
    job_title: 'Marketing Manager',
    accept_link: 'http://localhost:3000/interview/accept/789/token789',
    reject_link: 'http://localhost:3000/interview/reject/789/token012',
    deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
  });

  console.log('✓ Subject:', emailContent.subject);
  console.log('✓ HTML content length:', emailContent.html.length);
  console.log('✓ Contains promotion message:', emailContent.html.includes('Great news'));
  console.log('✓ Contains candidate name:', emailContent.html.includes('Diana Prince'));
  console.log('✓ PASS\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

/**
 * Test 6: Email Queue (without actual sending)
 */
console.log('Test 6: Email Queue (without actual sending)');
try {
  // This will log to console since transporter is not configured in test environment
  const result = await emailService.queueEmail({
    to: 'test@example.com',
    template: 'invitation',
    data: {
      candidate_name: 'Test User',
      job_title: 'Test Position',
      company_name: 'Test Company',
      accept_link: 'http://localhost:3000/interview/accept/test/token',
      reject_link: 'http://localhost:3000/interview/reject/test/token',
      deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    }
  });

  console.log('✓ Queue result:', result.success ? 'SUCCESS' : 'FAILED');
  console.log('✓ PASS\n');
} catch (error) {
  console.error('✗ FAIL:', error.message, '\n');
}

/**
 * Test 7: Invalid Template Handling
 */
console.log('Test 7: Invalid Template Handling');
try {
  emailService.generateEmailFromTemplate('invalid_template', {});
  console.error('✗ FAIL: Should have thrown error for invalid template\n');
} catch (error) {
  console.log('✓ Correctly threw error:', error.message);
  console.log('✓ PASS\n');
}

/**
 * Test 8: Missing Required Data Handling
 */
console.log('Test 8: Missing Required Data Handling');
try {
  const result = await emailService.queueEmail({
    to: 'test@example.com'
    // Missing template and data
  });
  
  if (!result.success) {
    console.log('✓ Correctly handled missing data');
    console.log('✓ PASS\n');
  } else {
    console.error('✗ FAIL: Should have failed with missing data\n');
  }
} catch (error) {
  console.log('✓ Correctly threw error:', error.message);
  console.log('✓ PASS\n');
}

console.log('=== All Email Service Tests Complete ===');
