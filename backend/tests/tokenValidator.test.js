/**
 * Unit Tests for Token Validator
 * 
 * Requirements: 14.3, 14.4
 * - Test secure token generation
 * - Test token expiration (7 days)
 * - Test token validation
 */

const jwt = require('jsonwebtoken');
const tokenValidator = require('../utils/tokenValidator');

// Mock environment variable
process.env.JWT_SECRET_KEY = 'test-secret-key-for-token-validation';

describe('TokenValidator', () => {
  const testInterviewId = '123e4567-e89b-12d3-a456-426614174000';

  describe('generateInterviewToken', () => {
    it('should generate a valid token for accept action', () => {
      const token = tokenValidator.generateInterviewToken(testInterviewId, 'accept');
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      const decoded = jwt.decode(token);
      expect(decoded.interview_id).toBe(testInterviewId);
      expect(decoded.action).toBe('accept');
      expect(decoded.type).toBe('interview_action');
      expect(decoded.nonce).toBeDefined();
    });

    it('should generate a valid token for reject action', () => {
      const token = tokenValidator.generateInterviewToken(testInterviewId, 'reject');
      
      const decoded = jwt.decode(token);
      expect(decoded.action).toBe('reject');
    });

    it('should throw error for invalid action', () => {
      expect(() => {
        tokenValidator.generateInterviewToken(testInterviewId, 'invalid');
      }).toThrow('Invalid action');
    });

    it('should throw error for missing interview ID', () => {
      expect(() => {
        tokenValidator.generateInterviewToken(null, 'accept');
      }).toThrow('Interview ID is required');
    });

    it('should include additional data in token', () => {
      const additionalData = { candidate_id: 'test-candidate' };
      const token = tokenValidator.generateInterviewToken(
        testInterviewId,
        'accept',
        additionalData
      );
      
      const decoded = jwt.decode(token);
      expect(decoded.candidate_id).toBe('test-candidate');
    });

    it('should generate unique tokens with nonce', () => {
      const token1 = tokenValidator.generateInterviewToken(testInterviewId, 'accept');
      const token2 = tokenValidator.generateInterviewToken(testInterviewId, 'accept');
      
      expect(token1).not.toBe(token2);
      
      const decoded1 = jwt.decode(token1);
      const decoded2 = jwt.decode(token2);
      expect(decoded1.nonce).not.toBe(decoded2.nonce);
    });
  });

  describe('validateInterviewToken', () => {
    it('should validate a correct token', () => {
      const token = tokenValidator.generateInterviewToken(testInterviewId, 'accept');
      const result = tokenValidator.validateInterviewToken(testInterviewId, token, 'accept');
      
      expect(result.success).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload.interview_id).toBe(testInterviewId);
    });

    it('should reject token with wrong interview ID', () => {
      const token = tokenValidator.generateInterviewToken(testInterviewId, 'accept');
      const wrongId = '999e4567-e89b-12d3-a456-426614174999';
      const result = tokenValidator.validateInterviewToken(wrongId, token, 'accept');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not match');
    });

    it('should reject token with wrong action', () => {
      const token = tokenValidator.generateInterviewToken(testInterviewId, 'accept');
      const result = tokenValidator.validateInterviewToken(testInterviewId, token, 'reject');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('expected reject');
    });

    it('should reject expired token', () => {
      // Create token with very short expiry
      const payload = {
        interview_id: testInterviewId,
        action: 'accept',
        type: 'interview_action'
      };
      const expiredToken = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
        expiresIn: '0s' // Expires immediately
      });
      
      // Wait a moment to ensure expiration
      setTimeout(() => {
        const result = tokenValidator.validateInterviewToken(
          testInterviewId,
          expiredToken,
          'accept'
        );
        
        expect(result.success).toBe(false);
        expect(result.expired).toBe(true);
        expect(result.error).toContain('expired');
      }, 100);
    });

    it('should reject token with invalid signature', () => {
      const payload = {
        interview_id: testInterviewId,
        action: 'accept',
        type: 'interview_action'
      };
      const invalidToken = jwt.sign(payload, 'wrong-secret-key');
      
      const result = tokenValidator.validateInterviewToken(
        testInterviewId,
        invalidToken,
        'accept'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid token signature');
    });

    it('should reject token with wrong type', () => {
      const payload = {
        interview_id: testInterviewId,
        action: 'accept',
        type: 'wrong_type'
      };
      const wrongTypeToken = jwt.sign(payload, process.env.JWT_SECRET_KEY);
      
      const result = tokenValidator.validateInterviewToken(
        testInterviewId,
        wrongTypeToken,
        'accept'
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid token type');
    });

    it('should reject missing token', () => {
      const result = tokenValidator.validateInterviewToken(testInterviewId, null, 'accept');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Token is required');
    });

    it('should reject missing interview ID', () => {
      const token = tokenValidator.generateInterviewToken(testInterviewId, 'accept');
      const result = tokenValidator.validateInterviewToken(null, token, 'accept');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Interview ID is required');
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const token = tokenValidator.generateInterviewToken(testInterviewId, 'accept');
      const isExpired = tokenValidator.isTokenExpired(token);
      
      expect(isExpired).toBe(false);
    });

    it('should return true for expired token', (done) => {
      const payload = {
        interview_id: testInterviewId,
        action: 'accept',
        type: 'interview_action'
      };
      const expiredToken = jwt.sign(payload, process.env.JWT_SECRET_KEY, {
        expiresIn: '1ms'
      });
      
      setTimeout(() => {
        const isExpired = tokenValidator.isTokenExpired(expiredToken);
        expect(isExpired).toBe(true);
        done();
      }, 10);
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const token = tokenValidator.generateInterviewToken(testInterviewId, 'accept');
      const decoded = tokenValidator.decodeToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.interview_id).toBe(testInterviewId);
      expect(decoded.action).toBe('accept');
    });

    it('should return null for invalid token', () => {
      const decoded = tokenValidator.decodeToken('invalid-token');
      expect(decoded).toBeNull();
    });
  });

  describe('generateOneTimeToken', () => {
    it('should generate one-time token', () => {
      const token = tokenValidator.generateOneTimeToken('user-123', 'password-reset');
      
      expect(token).toBeDefined();
      const decoded = jwt.decode(token);
      expect(decoded.user_id).toBe('user-123');
      expect(decoded.operation).toBe('password-reset');
      expect(decoded.type).toBe('one_time');
      expect(decoded.nonce).toBeDefined();
    });

    it('should generate unique one-time tokens', () => {
      const token1 = tokenValidator.generateOneTimeToken('user-123', 'operation');
      const token2 = tokenValidator.generateOneTimeToken('user-123', 'operation');
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('validateOneTimeToken', () => {
    it('should validate correct one-time token', () => {
      const token = tokenValidator.generateOneTimeToken('user-123', 'password-reset');
      const result = tokenValidator.validateOneTimeToken(token, 'password-reset');
      
      expect(result.success).toBe(true);
      expect(result.payload.user_id).toBe('user-123');
    });

    it('should reject token with wrong operation', () => {
      const token = tokenValidator.generateOneTimeToken('user-123', 'password-reset');
      const result = tokenValidator.validateOneTimeToken(token, 'email-verify');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('operation mismatch');
    });

    it('should reject token with wrong type', () => {
      const token = tokenValidator.generateInterviewToken(testInterviewId, 'accept');
      const result = tokenValidator.validateOneTimeToken(token, 'password-reset');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid token type');
    });
  });

  describe('Token Expiration - 7 days requirement', () => {
    it('should set token expiration to 7 days', () => {
      const token = tokenValidator.generateInterviewToken(testInterviewId, 'accept');
      const decoded = jwt.decode(token);
      
      const issuedAt = decoded.iat;
      const expiresAt = decoded.exp;
      const durationSeconds = expiresAt - issuedAt;
      const durationDays = durationSeconds / (60 * 60 * 24);
      
      // Should be 7 days (with small tolerance for rounding)
      expect(durationDays).toBeCloseTo(7, 1);
    });
  });
});
