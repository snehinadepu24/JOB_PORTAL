/**
 * Rate Limiting Middleware
 * 
 * Requirements: 13.9
 * - Add rate limiting middleware (100 requests/minute per user)
 * - Return appropriate error responses when limit exceeded
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

/**
 * Create rate limiter with in-memory store (default)
 * 
 * @param {Object} options - Rate limiter options
 * @returns {Function} Rate limiter middleware
 */
function createRateLimiter(options = {}) {
  const defaultOptions = {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute per user
    message: {
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: '1 minute'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Use IP address as key by default
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user?.id || req.ip;
    },
    // Skip rate limiting for certain conditions
    skip: (req) => {
      // Skip for health check endpoints
      if (req.path === '/health' || req.path === '/api/health') {
        return true;
      }
      return false;
    },
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        limit: req.rateLimit.limit,
        current: req.rateLimit.current
      });
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
}

/**
 * Create rate limiter with Redis store (for production)
 * 
 * @param {Object} redisClient - Redis client instance
 * @param {Object} options - Rate limiter options
 * @returns {Function} Rate limiter middleware
 */
function createRedisRateLimiter(redisClient, options = {}) {
  const defaultOptions = {
    windowMs: 60 * 1000,
    max: 100,
    store: new RedisStore({
      client: redisClient,
      prefix: 'rate_limit:'
    }),
    message: {
      success: false,
      message: 'Too many requests from this user, please try again later.',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    },
    skip: (req) => {
      if (req.path === '/health' || req.path === '/api/health') {
        return true;
      }
      return false;
    },
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        limit: req.rateLimit.limit,
        current: req.rateLimit.current
      });
    }
  };

  return rateLimit({ ...defaultOptions, ...options });
}

/**
 * Strict rate limiter for sensitive endpoints (e.g., login, password reset)
 * 10 requests per 15 minutes
 */
const strictRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per 15 minutes
  message: {
    success: false,
    message: 'Too many attempts. Please try again after 15 minutes.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true // Don't count successful requests
});

/**
 * Moderate rate limiter for API endpoints
 * 100 requests per minute (default)
 */
const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100
});

/**
 * Lenient rate limiter for public endpoints
 * 200 requests per minute
 */
const publicRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
    retryAfter: '1 minute'
  }
});

/**
 * Very strict rate limiter for email sending
 * 5 requests per hour
 */
const emailRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    success: false,
    message: 'Too many email requests. Please try again after 1 hour.',
    retryAfter: '1 hour'
  }
});

/**
 * Rate limiter for file uploads
 * 20 uploads per hour
 */
const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: {
    success: false,
    message: 'Too many file uploads. Please try again after 1 hour.',
    retryAfter: '1 hour'
  }
});

/**
 * Custom rate limiter for specific user roles
 * 
 * @param {string} role - User role (e.g., 'admin', 'recruiter', 'candidate')
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Function} Rate limiter middleware
 */
function createRoleBasedRateLimiter(role, maxRequests, windowMs) {
  return createRateLimiter({
    windowMs,
    max: maxRequests,
    skip: (req) => {
      // Skip if user doesn't have the specified role
      if (req.user?.role !== role) {
        return true;
      }
      return false;
    },
    keyGenerator: (req) => {
      return `${role}:${req.user?.id || req.ip}`;
    }
  });
}

/**
 * Dynamic rate limiter based on user tier
 * 
 * @param {Object} req - Express request object
 * @returns {number} Maximum requests allowed
 */
function getDynamicLimit(req) {
  if (!req.user) {
    return 50; // Anonymous users: 50 requests/minute
  }

  switch (req.user.role) {
    case 'admin':
      return 500; // Admins: 500 requests/minute
    case 'recruiter':
      return 200; // Recruiters: 200 requests/minute
    case 'candidate':
      return 100; // Candidates: 100 requests/minute
    default:
      return 50; // Default: 50 requests/minute
  }
}

/**
 * Dynamic rate limiter middleware
 */
const dynamicRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: (req) => getDynamicLimit(req),
  keyGenerator: (req) => {
    const role = req.user?.role || 'anonymous';
    const id = req.user?.id || req.ip;
    return `${role}:${id}`;
  }
});

/**
 * Rate limiter for interview actions (accept/reject)
 * 10 requests per hour to prevent abuse
 */
const interviewActionRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many interview actions. Please try again later.',
    retryAfter: '1 hour'
  },
  keyGenerator: (req) => {
    // Use interview ID + IP to prevent abuse
    const interviewId = req.params.interviewId || 'unknown';
    return `interview:${interviewId}:${req.ip}`;
  }
});

/**
 * Rate limiter for application submissions
 * 5 applications per day per user
 */
const applicationRateLimiter = createRateLimiter({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5,
  message: {
    success: false,
    message: 'You have reached the maximum number of applications for today. Please try again tomorrow.',
    retryAfter: '24 hours'
  },
  keyGenerator: (req) => {
    return req.user?.id || req.ip;
  }
});

module.exports = {
  createRateLimiter,
  createRedisRateLimiter,
  createRoleBasedRateLimiter,
  strictRateLimiter,
  apiRateLimiter,
  publicRateLimiter,
  emailRateLimiter,
  uploadRateLimiter,
  dynamicRateLimiter,
  interviewActionRateLimiter,
  applicationRateLimiter,
  getDynamicLimit
};
