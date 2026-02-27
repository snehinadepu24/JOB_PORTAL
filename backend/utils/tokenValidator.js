/**
 * Token Validation Utility
 * 
 * Provides secure token generation and validation for interview actions
 * 
 * Requirements: 14.3, 14.4
 * - Secure token generation for interview actions
 * - Token expiration (7 days)
 * - Token validation on accept/reject endpoints
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class TokenValidator {
  constructor() {
    this.SECRET_KEY = process.env.JWT_SECRET_KEY;
    this.TOKEN_EXPIRY = '7d'; // 7 days as per requirement 14.4
    
    if (!this.SECRET_KEY) {
      throw new Error('JWT_SECRET_KEY environment variable is required');
    }
  }

  /**
   * Generate a secure token for interview actions
   * 
   * @param {string} interviewId - UUID of the interview
   * @param {string} action - Action type ('accept' or 'reject')
   * @param {Object} additionalData - Optional additional data to include in token
   * @returns {string} JWT token
   */
  generateInterviewToken(interviewId, action, additionalData = {}) {
    if (!['accept', 'reject'].includes(action)) {
      throw new Error(`Invalid action: ${action}. Must be 'accept' or 'reject'`);
    }

    if (!interviewId) {
      throw new Error('Interview ID is required');
    }

    const payload = {
      interview_id: interviewId,
      action: action,
      type: 'interview_action',
      issued_at: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'), // Prevent token reuse
      ...additionalData
    };

    const token = jwt.sign(payload, this.SECRET_KEY, {
      expiresIn: this.TOKEN_EXPIRY
    });

    return token;
  }

  /**
   * Validate interview action token
   * 
   * @param {string} interviewId - UUID of the interview
   * @param {string} token - JWT token to validate
   * @param {string} expectedAction - Expected action ('accept' or 'reject')
   * @returns {Object} Validation result with success flag and decoded payload or error
   */
  validateInterviewToken(interviewId, token, expectedAction) {
    try {
      if (!token) {
        return {
          success: false,
          error: 'Token is required'
        };
      }

      if (!interviewId) {
        return {
          success: false,
          error: 'Interview ID is required'
        };
      }

      const decoded = jwt.verify(token, this.SECRET_KEY);

      // Verify token type
      if (decoded.type !== 'interview_action') {
        return {
          success: false,
          error: 'Invalid token type'
        };
      }

      // Verify interview ID matches
      if (decoded.interview_id !== interviewId) {
        return {
          success: false,
          error: 'Token does not match interview ID'
        };
      }

      // Verify action matches
      if (decoded.action !== expectedAction) {
        return {
          success: false,
          error: `Token is for ${decoded.action}, expected ${expectedAction}`
        };
      }

      return {
        success: true,
        payload: decoded
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          success: false,
          error: 'Token has expired',
          expired: true
        };
      }

      if (error.name === 'JsonWebTokenError') {
        return {
          success: false,
          error: 'Invalid token signature'
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if a token is expired without full validation
   * 
   * @param {string} token - JWT token
   * @returns {boolean} True if token is expired
   */
  isTokenExpired(token) {
    try {
      jwt.verify(token, this.SECRET_KEY);
      return false;
    } catch (error) {
      return error.name === 'TokenExpiredError';
    }
  }

  /**
   * Decode token without verification (for debugging/logging only)
   * 
   * @param {string} token - JWT token
   * @returns {Object|null} Decoded payload or null
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a one-time use token for sensitive operations
   * 
   * @param {string} userId - User ID
   * @param {string} operation - Operation type
   * @param {string} expiry - Token expiry (default: 1h)
   * @returns {string} JWT token
   */
  generateOneTimeToken(userId, operation, expiry = '1h') {
    const payload = {
      user_id: userId,
      operation: operation,
      type: 'one_time',
      nonce: crypto.randomBytes(32).toString('hex'),
      issued_at: Date.now()
    };

    return jwt.sign(payload, this.SECRET_KEY, {
      expiresIn: expiry
    });
  }

  /**
   * Validate one-time use token
   * 
   * @param {string} token - JWT token
   * @param {string} expectedOperation - Expected operation type
   * @returns {Object} Validation result
   */
  validateOneTimeToken(token, expectedOperation) {
    try {
      const decoded = jwt.verify(token, this.SECRET_KEY);

      if (decoded.type !== 'one_time') {
        return {
          success: false,
          error: 'Invalid token type'
        };
      }

      if (decoded.operation !== expectedOperation) {
        return {
          success: false,
          error: 'Token operation mismatch'
        };
      }

      return {
        success: true,
        payload: decoded
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return {
          success: false,
          error: 'Token has expired',
          expired: true
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new TokenValidator();
