/**
 * Input Validation and Sanitization Middleware
 * 
 * Requirements: 13.8, 14.7
 * - Add validation middleware for all API endpoints
 * - Sanitize user inputs to prevent SQL injection and XSS
 * - Return descriptive error messages for invalid inputs
 */

const validator = require('validator');
const { body, param, query, validationResult } = require('express-validator');

/**
 * Sanitize string input to prevent XSS attacks
 * 
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(input) {
  if (typeof input !== 'string') {
    return input;
  }
  
  // Escape HTML entities
  let sanitized = validator.escape(input);
  
  // Remove any script tags
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove any event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  return sanitized.trim();
}

/**
 * Sanitize object recursively
 * 
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'string') {
        sanitized[key] = sanitizeString(obj[key]);
      } else if (typeof obj[key] === 'object') {
        sanitized[key] = sanitizeObject(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
  }
  
  return sanitized;
}

/**
 * Middleware to sanitize all request inputs
 */
const sanitizeInputs = (req, res, next) => {
  try {
    // Sanitize body
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    console.error('Input sanitization error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid input format'
    });
  }
};

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.param,
      message: err.msg,
      value: err.value
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }
  
  next();
};

/**
 * Validation rules for job creation/update
 */
const validateJob = [
  body('title')
    .trim()
    .notEmpty().withMessage('Job title is required')
    .isLength({ min: 3, max: 200 }).withMessage('Job title must be between 3 and 200 characters'),
  
  body('description')
    .trim()
    .notEmpty().withMessage('Job description is required')
    .isLength({ min: 10, max: 10000 }).withMessage('Job description must be between 10 and 10000 characters'),
  
  body('number_of_openings')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Number of openings must be between 1 and 100'),
  
  body('shortlisting_buffer')
    .optional()
    .isInt({ min: 0, max: 100 }).withMessage('Shortlisting buffer must be between 0 and 100'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Location must be less than 200 characters'),
  
  body('salary')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Salary must be less than 100 characters'),
  
  handleValidationErrors
];

/**
 * Validation rules for application submission
 */
const validateApplication = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone number format'),
  
  body('coverLetter')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Cover letter must be less than 5000 characters'),
  
  body('address')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Address must be less than 500 characters'),
  
  handleValidationErrors
];

/**
 * Validation rules for interview ID parameter
 */
const validateInterviewId = [
  param('interviewId')
    .notEmpty().withMessage('Interview ID is required')
    .isUUID().withMessage('Invalid interview ID format'),
  
  handleValidationErrors
];

/**
 * Validation rules for interview token
 */
const validateInterviewToken = [
  param('token')
    .notEmpty().withMessage('Token is required')
    .isJWT().withMessage('Invalid token format'),
  
  handleValidationErrors
];

/**
 * Validation rules for slot selection
 */
const validateSlotSelection = [
  body('scheduled_time')
    .notEmpty().withMessage('Scheduled time is required')
    .isISO8601().withMessage('Invalid date format. Use ISO 8601 format'),
  
  body('scheduled_time')
    .custom((value) => {
      const selectedDate = new Date(value);
      const now = new Date();
      
      if (selectedDate <= now) {
        throw new Error('Scheduled time must be in the future');
      }
      
      // Check if it's a business day (Monday-Friday)
      const dayOfWeek = selectedDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        throw new Error('Scheduled time must be on a business day (Monday-Friday)');
      }
      
      // Check if it's during business hours (9 AM - 6 PM)
      const hours = selectedDate.getHours();
      if (hours < 9 || hours >= 18) {
        throw new Error('Scheduled time must be during business hours (9 AM - 6 PM)');
      }
      
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Validation rules for negotiation message
 */
const validateNegotiationMessage = [
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 1, max: 2000 }).withMessage('Message must be between 1 and 2000 characters'),
  
  handleValidationErrors
];

/**
 * Validation rules for pagination
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

/**
 * Validation rules for date range
 */
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601().withMessage('Invalid start date format'),
  
  query('endDate')
    .optional()
    .isISO8601().withMessage('Invalid end date format'),
  
  query('startDate')
    .optional()
    .custom((value, { req }) => {
      if (req.query.endDate) {
        const start = new Date(value);
        const end = new Date(req.query.endDate);
        
        if (start > end) {
          throw new Error('Start date must be before end date');
        }
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Validation rules for UUID parameter
 */
const validateUUID = (paramName) => [
  param(paramName)
    .notEmpty().withMessage(`${paramName} is required`)
    .isUUID().withMessage(`Invalid ${paramName} format`),
  
  handleValidationErrors
];

/**
 * Validation rules for email
 */
const validateEmail = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  
  handleValidationErrors
];

/**
 * Validation rules for feature flag
 */
const validateFeatureFlag = [
  body('flag_name')
    .trim()
    .notEmpty().withMessage('Flag name is required')
    .matches(/^[a-z_]+$/).withMessage('Flag name must be lowercase with underscores only'),
  
  body('enabled')
    .isBoolean().withMessage('Enabled must be a boolean value'),
  
  body('job_id')
    .optional()
    .isUUID().withMessage('Invalid job ID format'),
  
  handleValidationErrors
];

/**
 * SQL Injection prevention - validate SQL-like patterns
 */
const preventSQLInjection = (req, res, next) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(;|\-\-|\/\*|\*\/|xp_|sp_)/gi,
    /(\bOR\b.*=.*|1=1|'=')/gi
  ];
  
  const checkValue = (value) => {
    if (typeof value === 'string') {
      for (const pattern of sqlPatterns) {
        if (pattern.test(value)) {
          return true;
        }
      }
    }
    return false;
  };
  
  const checkObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string' && checkValue(obj[key])) {
          return true;
        } else if (typeof obj[key] === 'object') {
          if (checkObject(obj[key])) {
            return true;
          }
        }
      }
    }
    return false;
  };
  
  // Check all inputs
  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid input detected. Please remove any SQL-like syntax.'
    });
  }
  
  next();
};

module.exports = {
  sanitizeString,
  sanitizeObject,
  sanitizeInputs,
  handleValidationErrors,
  validateJob,
  validateApplication,
  validateInterviewId,
  validateInterviewToken,
  validateSlotSelection,
  validateNegotiationMessage,
  validatePagination,
  validateDateRange,
  validateUUID,
  validateEmail,
  validateFeatureFlag,
  preventSQLInjection
};
