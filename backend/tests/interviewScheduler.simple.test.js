/**
 * Simple tests for InterviewScheduler
 * 
 * Tests token generation and validation logic without database dependencies
 */

import { interviewScheduler } from '../managers/InterviewScheduler.js';
import jwt from 'jsonwebtoken';

// Set up test environment
process.env.JWT_SECRET_KEY = 'test-secret-key-for-interview-scheduler';
process.env.FRONTEND_URL = 'http://localhost:3000';

console.log('Testing InterviewScheduler...\n');

// Test 1: Token generation
console.log('Test 1: Generate accept token');
try {
  const interviewId = '123e4567-e89b-12d3-a456-426614174000';
  const acceptToken = interviewScheduler.generateToken(interviewId, 'accept');
  
  if (!acceptToken || typeof acceptToken !== 'string') {
    throw new Error('Token generation failed');
  }
  
  // Decode token to verify payload
  const decoded = jwt.verify(acceptToken, process.env.JWT_SECRET_KEY);
  
  if (decoded.interview_id !== interviewId) {
    throw new Error('Token interview_id mismatch');
  }
  
  if (decoded.action !== 'accept') {
    throw new Error('Token action mismatch');
  }
  
  if (decoded.type !== 'interview_action') {
    throw new Error('Token type mismatch');
  }
  
  console.log('✓ Accept token generated successfully');
  console.log('  Token payload:', decoded);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 2: Token generation for reject
console.log('\nTest 2: Generate reject token');
try {
  const interviewId = '123e4567-e89b-12d3-a456-426614174000';
  const rejectToken = interviewScheduler.generateToken(interviewId, 'reject');
  
  const decoded = jwt.verify(rejectToken, process.env.JWT_SECRET_KEY);
  
  if (decoded.action !== 'reject') {
    throw new Error('Token action should be reject');
  }
  
  console.log('✓ Reject token generated successfully');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 3: Invalid action should throw error
console.log('\nTest 3: Invalid action should throw error');
try {
  const interviewId = '123e4567-e89b-12d3-a456-426614174000';
  interviewScheduler.generateToken(interviewId, 'invalid');
  console.error('✗ Test failed: Should have thrown error for invalid action');
  process.exit(1);
} catch (error) {
  if (error.message.includes('Invalid action')) {
    console.log('✓ Correctly rejected invalid action');
  } else {
    console.error('✗ Test failed: Wrong error message:', error.message);
    process.exit(1);
  }
}

// Test 4: Token validation - valid token
console.log('\nTest 4: Validate valid accept token');
try {
  const interviewId = '123e4567-e89b-12d3-a456-426614174000';
  const acceptToken = interviewScheduler.generateToken(interviewId, 'accept');
  
  const isValid = interviewScheduler.validateToken(interviewId, acceptToken, 'accept');
  
  if (!isValid) {
    throw new Error('Valid token was rejected');
  }
  
  console.log('✓ Valid token accepted');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 5: Token validation - wrong interview ID
console.log('\nTest 5: Reject token with wrong interview ID');
try {
  const interviewId1 = '123e4567-e89b-12d3-a456-426614174000';
  const interviewId2 = '223e4567-e89b-12d3-a456-426614174000';
  const acceptToken = interviewScheduler.generateToken(interviewId1, 'accept');
  
  const isValid = interviewScheduler.validateToken(interviewId2, acceptToken, 'accept');
  
  if (isValid) {
    throw new Error('Token with wrong interview ID was accepted');
  }
  
  console.log('✓ Token with wrong interview ID rejected');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 6: Token validation - wrong action
console.log('\nTest 6: Reject token with wrong action');
try {
  const interviewId = '123e4567-e89b-12d3-a456-426614174000';
  const acceptToken = interviewScheduler.generateToken(interviewId, 'accept');
  
  const isValid = interviewScheduler.validateToken(interviewId, acceptToken, 'reject');
  
  if (isValid) {
    throw new Error('Token with wrong action was accepted');
  }
  
  console.log('✓ Token with wrong action rejected');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 7: Token validation - invalid token string
console.log('\nTest 7: Reject invalid token string');
try {
  const interviewId = '123e4567-e89b-12d3-a456-426614174000';
  const invalidToken = 'invalid.token.string';
  
  const isValid = interviewScheduler.validateToken(interviewId, invalidToken, 'accept');
  
  if (isValid) {
    throw new Error('Invalid token string was accepted');
  }
  
  console.log('✓ Invalid token string rejected');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 8: Token validation - expired token
console.log('\nTest 8: Reject expired token');
try {
  const interviewId = '123e4567-e89b-12d3-a456-426614174000';
  
  // Create a token that expires immediately
  const expiredToken = jwt.sign(
    {
      interview_id: interviewId,
      action: 'accept',
      type: 'interview_action'
    },
    process.env.JWT_SECRET_KEY,
    { expiresIn: '0s' }
  );
  
  // Wait a moment to ensure expiration
  setTimeout(() => {
    const isValid = interviewScheduler.validateToken(interviewId, expiredToken, 'accept');
    
    if (isValid) {
      console.error('✗ Test failed: Expired token was accepted');
      process.exit(1);
    }
    
    console.log('✓ Expired token rejected');
    
    // Test 9: Link generation
    console.log('\nTest 9: Generate accept and reject links');
    try {
      const acceptToken = interviewScheduler.generateToken(interviewId, 'accept');
      const rejectToken = interviewScheduler.generateToken(interviewId, 'reject');
      
      const acceptLink = interviewScheduler.generateAcceptLink(interviewId, acceptToken);
      const rejectLink = interviewScheduler.generateRejectLink(interviewId, rejectToken);
      
      if (!acceptLink.includes('/interview/accept/')) {
        throw new Error('Accept link format incorrect');
      }
      
      if (!rejectLink.includes('/interview/reject/')) {
        throw new Error('Reject link format incorrect');
      }
      
      if (!acceptLink.includes(interviewId)) {
        throw new Error('Accept link missing interview ID');
      }
      
      if (!rejectLink.includes(interviewId)) {
        throw new Error('Reject link missing interview ID');
      }
      
      console.log('✓ Links generated correctly');
      console.log('  Accept link:', acceptLink);
      console.log('  Reject link:', rejectLink);
      
      console.log('\n✅ All tests passed!');
    } catch (error) {
      console.error('✗ Test failed:', error.message);
      process.exit(1);
    }
  }, 100);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}
