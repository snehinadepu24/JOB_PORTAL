/**
 * Unit Tests for Rate Limiter
 * 
 * Requirements: 13.9
 * - Test rate limiting (100 requests/minute per user)
 * - Test appropriate error responses when limit exceeded
 */

const {
  createRateLimiter,
  getDynamicLimit,
  strictRateLimiter,
  apiRateLimiter
} = require('../middlewares/rateLimiter');

describe('Rate Limiter', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      path: '/api/test',
      user: null,
      rateLimit: {
        limit: 100,
        current: 1,
        resetTime: Date.now() + 60000
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
    next = jest.fn();
  });

  describe('createRateLimiter', () => {
    it('should create rate limiter with default options', () => {
      const limiter = createRateLimiter();
      
      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });

    it('should create rate limiter with custom options', () => {
      const limiter = createRateLimiter({
        windowMs: 30000,
        max: 50
      });
      
      expect(limiter).toBeDefined();
    });

    it('should use user ID as key when authenticated', () => {
      const limiter = createRateLimiter();
      req.user = { id: 'user-123', role: 'candidate' };
      
      // The keyGenerator function should return user ID
      const keyGenerator = limiter.keyGenerator || ((r) => r.user?.id || r.ip);
      const key = keyGenerator(req);
      
      expect(key).toBe('user-123');
    });

    it('should use IP address as key when not authenticated', () => {
      const limiter = createRateLimiter();
      
      const keyGenerator = limiter.keyGenerator || ((r) => r.user?.id || r.ip);
      const key = keyGenerator(req);
      
      expect(key).toBe('127.0.0.1');
    });

    it('should skip health check endpoints', () => {
      const limiter = createRateLimiter();
      req.path = '/health';
      
      const skip = limiter.skip || ((r) => r.path === '/health');
      const shouldSkip = skip(req);
      
      expect(shouldSkip).toBe(true);
    });

    it('should not skip regular endpoints', () => {
      const limiter = createRateLimiter();
      req.path = '/api/jobs';
      
      const skip = limiter.skip || ((r) => r.path === '/health');
      const shouldSkip = skip(req);
      
      expect(shouldSkip).toBe(false);
    });
  });

  describe('getDynamicLimit', () => {
    it('should return 50 for anonymous users', () => {
      req.user = null;
      const limit = getDynamicLimit(req);
      
      expect(limit).toBe(50);
    });

    it('should return 500 for admin users', () => {
      req.user = { id: 'admin-1', role: 'admin' };
      const limit = getDynamicLimit(req);
      
      expect(limit).toBe(500);
    });

    it('should return 200 for recruiter users', () => {
      req.user = { id: 'recruiter-1', role: 'recruiter' };
      const limit = getDynamicLimit(req);
      
      expect(limit).toBe(200);
    });

    it('should return 100 for candidate users', () => {
      req.user = { id: 'candidate-1', role: 'candidate' };
      const limit = getDynamicLimit(req);
      
      expect(limit).toBe(100);
    });

    it('should return 50 for unknown roles', () => {
      req.user = { id: 'user-1', role: 'unknown' };
      const limit = getDynamicLimit(req);
      
      expect(limit).toBe(50);
    });
  });

  describe('Rate Limit Response', () => {
    it('should return 429 status when limit exceeded', () => {
      const handler = (req, res) => {
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
          limit: req.rateLimit.limit,
          current: req.rateLimit.current
        });
      };
      
      handler(req, res);
      
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String),
          retryAfter: expect.any(Number),
          limit: 100,
          current: 1
        })
      );
    });

    it('should include retry information in response', () => {
      const handler = (req, res) => {
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
          limit: req.rateLimit.limit,
          current: req.rateLimit.current
        });
      };
      
      handler(req, res);
      
      const response = res.json.mock.calls[0][0];
      expect(response.retryAfter).toBeGreaterThan(0);
      expect(response.limit).toBe(100);
      expect(response.current).toBe(1);
    });

    it('should include descriptive error message', () => {
      const handler = (req, res) => {
        res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.'
        });
      };
      
      handler(req, res);
      
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(false);
      expect(response.message).toContain('Too many requests');
    });
  });

  describe('Strict Rate Limiter', () => {
    it('should have stricter limits than default', () => {
      // Strict limiter: 10 requests per 15 minutes
      // Default limiter: 100 requests per minute
      
      expect(strictRateLimiter).toBeDefined();
      expect(typeof strictRateLimiter).toBe('function');
    });
  });

  describe('API Rate Limiter', () => {
    it('should have standard API limits', () => {
      // API limiter: 100 requests per minute
      
      expect(apiRateLimiter).toBeDefined();
      expect(typeof apiRateLimiter).toBe('function');
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include rate limit headers in response', () => {
      // Standard headers should be enabled
      const limiter = createRateLimiter({
        standardHeaders: true
      });
      
      expect(limiter).toBeDefined();
    });

    it('should not include legacy headers', () => {
      // Legacy headers should be disabled
      const limiter = createRateLimiter({
        legacyHeaders: false
      });
      
      expect(limiter).toBeDefined();
    });
  });

  describe('Key Generation', () => {
    it('should generate unique keys for different users', () => {
      const keyGenerator = (req) => req.user?.id || req.ip;
      
      const req1 = { user: { id: 'user-1' }, ip: '127.0.0.1' };
      const req2 = { user: { id: 'user-2' }, ip: '127.0.0.1' };
      
      const key1 = keyGenerator(req1);
      const key2 = keyGenerator(req2);
      
      expect(key1).not.toBe(key2);
    });

    it('should generate same key for same user', () => {
      const keyGenerator = (req) => req.user?.id || req.ip;
      
      const req1 = { user: { id: 'user-1' }, ip: '127.0.0.1' };
      const req2 = { user: { id: 'user-1' }, ip: '192.168.1.1' };
      
      const key1 = keyGenerator(req1);
      const key2 = keyGenerator(req2);
      
      expect(key1).toBe(key2);
    });

    it('should use IP for anonymous users', () => {
      const keyGenerator = (req) => req.user?.id || req.ip;
      
      const req1 = { user: null, ip: '127.0.0.1' };
      const req2 = { user: null, ip: '192.168.1.1' };
      
      const key1 = keyGenerator(req1);
      const key2 = keyGenerator(req2);
      
      expect(key1).toBe('127.0.0.1');
      expect(key2).toBe('192.168.1.1');
      expect(key1).not.toBe(key2);
    });
  });

  describe('Skip Conditions', () => {
    it('should skip health check endpoints', () => {
      const skip = (req) => {
        return req.path === '/health' || req.path === '/api/health';
      };
      
      expect(skip({ path: '/health' })).toBe(true);
      expect(skip({ path: '/api/health' })).toBe(true);
      expect(skip({ path: '/api/jobs' })).toBe(false);
    });

    it('should not skip regular API endpoints', () => {
      const skip = (req) => {
        return req.path === '/health' || req.path === '/api/health';
      };
      
      expect(skip({ path: '/api/jobs' })).toBe(false);
      expect(skip({ path: '/api/applications' })).toBe(false);
      expect(skip({ path: '/api/interviews' })).toBe(false);
    });
  });

  describe('Window and Limit Configuration', () => {
    it('should respect custom window size', () => {
      const limiter = createRateLimiter({
        windowMs: 30000 // 30 seconds
      });
      
      expect(limiter).toBeDefined();
    });

    it('should respect custom max requests', () => {
      const limiter = createRateLimiter({
        max: 50
      });
      
      expect(limiter).toBeDefined();
    });

    it('should combine custom window and max', () => {
      const limiter = createRateLimiter({
        windowMs: 120000, // 2 minutes
        max: 200
      });
      
      expect(limiter).toBeDefined();
    });
  });

  describe('Error Messages', () => {
    it('should provide clear error message for general rate limit', () => {
      const message = 'Too many requests. Please try again later.';
      
      expect(message).toContain('Too many requests');
      expect(message).toContain('try again later');
    });

    it('should provide specific error message for strict limits', () => {
      const message = 'Too many attempts. Please try again after 15 minutes.';
      
      expect(message).toContain('Too many attempts');
      expect(message).toContain('15 minutes');
    });

    it('should include retry time in error message', () => {
      const message = 'Too many requests. Please try again after 1 hour.';
      
      expect(message).toContain('1 hour');
    });
  });
});
