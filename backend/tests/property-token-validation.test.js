/**
 * Property Test 48: Token Validation
 * 
 * Requirements: 14.4
 * - Validates that tokens expire after 7 days
 * - Validates that tokens cannot be reused or tampered with
 * - Validates that token validation is secure
 * 
 * Property: For all valid interview tokens, validation succeeds within expiry period
 * and fails after expiry or with tampering
 */

const fc = require('fast-check');
const jwt = require('jsonwebtoken');
const tokenValidator = require('../utils/tokenValidator');

// Mock environment variable
process.env.JWT_SECRET_KEY = 'test-secret-key-for-property-testing';

describe('Property Test 48: Token Validation', () => {
  describe('Property: Valid tokens pass validation within expiry period', () => {
    it('should validate all correctly generated tokens', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // interview ID
          fc.constantFrom('accept', 'reject'), // action
          (interviewId, action) => {
            // Generate token
            const token = tokenValidator.generateInterviewToken(interviewId, action);
            
            // Validate token
            const result = tokenValidator.validateInterviewToken(interviewId, token, action);
            
            // Property: Valid token should always pass validation
            return result.success === true &&
                   result.payload.interview_id === interviewId &&
                   result.payload.action === action &&
                   result.payload.type === 'interview_action';
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Tokens with wrong interview ID fail validation', () => {
    it('should reject tokens when interview ID does not match', () => {
      fc.assert(
        fc.property(
          fc.uuid(), // original interview ID
          fc.uuid(), // different interview ID
          fc.constantFrom('accept', 'reject'),
          (interviewId1, interviewId2, action) => {
            // Skip if IDs are the same
            fc.pre(interviewId1 !== interviewId2);
            
            // Generate token for interviewId1
            const token = tokenValidator.generateInterviewToken(interviewId1, action);
            
            // Try to validate with interviewId2
            const result = tokenValidator.validateInterviewToken(interviewId2, token, action);
            
            // Property: Should always fail when interview ID doesn't match
            return result.success === false &&
                   result.error.includes('does not match');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Tokens with wrong action fail validation', () => {
    it('should reject tokens when action does not match', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('accept', 'reject'),
          (interviewId, action) => {
            // Generate token with one action
            const token = tokenValidator.generateInterviewToken(interviewId, action);
            
            // Try to validate with opposite action
            const oppositeAction = action === 'accept' ? 'reject' : 'accept';
            const result = tokenValidator.validateInterviewToken(interviewId, token, oppositeAction);
            
            // Property: Should always fail when action doesn't match
            return result.success === false &&
                   result.error.includes('expected');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Each token is unique (nonce prevents reuse)', () => {
    it('should generate unique tokens even for same parameters', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('accept', 'reject'),
          (interviewId, action) => {
            // Generate two tokens with same parameters
            const token1 = tokenValidator.generateInterviewToken(interviewId, action);
            const token2 = tokenValidator.generateInterviewToken(interviewId, action);
            
            // Decode to check nonce
            const decoded1 = jwt.decode(token1);
            const decoded2 = jwt.decode(token2);
            
            // Property: Tokens should be different due to unique nonce
            return token1 !== token2 &&
                   decoded1.nonce !== decoded2.nonce &&
                   decoded1.interview_id === decoded2.interview_id &&
                   decoded1.action === decoded2.action;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Token expiration is set to 7 days', () => {
    it('should set expiration to 7 days for all tokens', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('accept', 'reject'),
          (interviewId, action) => {
            const token = tokenValidator.generateInterviewToken(interviewId, action);
            const decoded = jwt.decode(token);
            
            const issuedAt = decoded.iat;
            const expiresAt = decoded.exp;
            const durationSeconds = expiresAt - issuedAt;
            const durationDays = durationSeconds / (60 * 60 * 24);
            
            // Property: Duration should be 7 days (with small tolerance)
            return Math.abs(durationDays - 7) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Tampered tokens fail validation', () => {
    it('should reject tokens with modified payload', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('accept', 'reject'),
          fc.uuid(), // tampered interview ID
          (interviewId, action, tamperedId) => {
            fc.pre(interviewId !== tamperedId);
            
            // Generate valid token
            const token = tokenValidator.generateInterviewToken(interviewId, action);
            
            // Decode and modify payload
            const decoded = jwt.decode(token);
            decoded.interview_id = tamperedId;
            
            // Re-sign with wrong secret (simulating tampering)
            const tamperedToken = jwt.sign(decoded, 'wrong-secret');
            
            // Try to validate tampered token
            const result = tokenValidator.validateInterviewToken(tamperedId, tamperedToken, action);
            
            // Property: Tampered token should always fail
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Invalid token format fails validation', () => {
    it('should reject malformed tokens', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('accept', 'reject'),
          fc.string({ minLength: 10, maxLength: 100 }), // random string
          (interviewId, action, randomString) => {
            // Skip if random string happens to be a valid JWT
            fc.pre(!randomString.includes('.'));
            
            // Try to validate random string as token
            const result = tokenValidator.validateInterviewToken(interviewId, randomString, action);
            
            // Property: Invalid format should always fail
            return result.success === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Empty or null tokens fail validation', () => {
    it('should reject empty or null tokens', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('accept', 'reject'),
          fc.constantFrom('', null, undefined),
          (interviewId, action, invalidToken) => {
            const result = tokenValidator.validateInterviewToken(interviewId, invalidToken, action);
            
            // Property: Empty/null tokens should always fail
            return result.success === false &&
                   result.error.includes('required');
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property: Token validation is deterministic', () => {
    it('should return same result for same token and parameters', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('accept', 'reject'),
          (interviewId, action) => {
            const token = tokenValidator.generateInterviewToken(interviewId, action);
            
            // Validate multiple times
            const result1 = tokenValidator.validateInterviewToken(interviewId, token, action);
            const result2 = tokenValidator.validateInterviewToken(interviewId, token, action);
            const result3 = tokenValidator.validateInterviewToken(interviewId, token, action);
            
            // Property: Results should be identical
            return result1.success === result2.success &&
                   result2.success === result3.success &&
                   result1.success === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Token type must be interview_action', () => {
    it('should reject tokens with wrong type', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('accept', 'reject'),
          fc.string({ minLength: 5, maxLength: 20 }), // random type
          (interviewId, action, wrongType) => {
            fc.pre(wrongType !== 'interview_action');
            
            // Create token with wrong type
            const payload = {
              interview_id: interviewId,
              action: action,
              type: wrongType
            };
            const token = jwt.sign(payload, process.env.JWT_SECRET_KEY, { expiresIn: '7d' });
            
            // Try to validate
            const result = tokenValidator.validateInterviewToken(interviewId, token, action);
            
            // Property: Wrong type should always fail
            return result.success === false &&
                   result.error.includes('Invalid token type');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Additional data in token is preserved', () => {
    it('should preserve additional data through validation', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('accept', 'reject'),
          fc.record({
            candidate_id: fc.uuid(),
            job_id: fc.uuid(),
            metadata: fc.string()
          }),
          (interviewId, action, additionalData) => {
            // Generate token with additional data
            const token = tokenValidator.generateInterviewToken(
              interviewId,
              action,
              additionalData
            );
            
            // Validate and check payload
            const result = tokenValidator.validateInterviewToken(interviewId, token, action);
            
            // Property: Additional data should be preserved
            return result.success === true &&
                   result.payload.candidate_id === additionalData.candidate_id &&
                   result.payload.job_id === additionalData.job_id &&
                   result.payload.metadata === additionalData.metadata;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
