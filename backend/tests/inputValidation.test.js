/**
 * Unit Tests for Input Validation and Sanitization
 * 
 * Requirements: 13.8, 14.7
 * - Test input validation for all endpoints
 * - Test sanitization to prevent SQL injection and XSS
 * - Test descriptive error messages
 */

const {
  sanitizeString,
  sanitizeObject,
  preventSQLInjection
} = require('../middlewares/inputValidation');

describe('Input Validation and Sanitization', () => {
  describe('sanitizeString', () => {
    it('should escape HTML entities', () => {
      const input = '<script>alert("XSS")</script>';
      const sanitized = sanitizeString(input);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
    });

    it('should remove script tags', () => {
      const input = 'Hello <script>alert("XSS")</script> World';
      const sanitized = sanitizeString(input);
      
      expect(sanitized).not.toContain('script');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove event handlers', () => {
      const input = '<div onclick="alert(\'XSS\')">Click me</div>';
      const sanitized = sanitizeString(input);
      
      expect(sanitized).not.toContain('onclick');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const sanitized = sanitizeString(input);
      
      expect(sanitized).toBe('Hello World');
    });

    it('should handle non-string inputs', () => {
      expect(sanitizeString(123)).toBe(123);
      expect(sanitizeString(null)).toBe(null);
      expect(sanitizeString(undefined)).toBe(undefined);
    });

    it('should preserve safe content', () => {
      const input = 'This is a safe string with numbers 123 and symbols !@#';
      const sanitized = sanitizeString(input);
      
      expect(sanitized).toContain('safe string');
      expect(sanitized).toContain('123');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string properties', () => {
      const input = {
        name: '<script>alert("XSS")</script>',
        email: 'test@example.com',
        description: 'Hello <b>World</b>'
      };
      
      const sanitized = sanitizeObject(input);
      
      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.email).toBe('test@example.com');
      expect(sanitized.description).not.toContain('<b>');
    });

    it('should sanitize nested objects', () => {
      const input = {
        user: {
          name: '<script>alert("XSS")</script>',
          profile: {
            bio: 'Hello <script>World</script>'
          }
        }
      };
      
      const sanitized = sanitizeObject(input);
      
      expect(sanitized.user.name).not.toContain('<script>');
      expect(sanitized.user.profile.bio).not.toContain('<script>');
    });

    it('should sanitize arrays', () => {
      const input = {
        tags: ['<script>tag1</script>', 'tag2', '<b>tag3</b>']
      };
      
      const sanitized = sanitizeObject(input);
      
      expect(sanitized.tags[0]).not.toContain('<script>');
      expect(sanitized.tags[1]).toBe('tag2');
      expect(sanitized.tags[2]).not.toContain('<b>');
    });

    it('should preserve non-string values', () => {
      const input = {
        name: 'John',
        age: 30,
        active: true,
        score: 95.5,
        data: null
      };
      
      const sanitized = sanitizeObject(input);
      
      expect(sanitized.age).toBe(30);
      expect(sanitized.active).toBe(true);
      expect(sanitized.score).toBe(95.5);
      expect(sanitized.data).toBe(null);
    });

    it('should handle null and undefined', () => {
      expect(sanitizeObject(null)).toBe(null);
      expect(sanitizeObject(undefined)).toBe(undefined);
    });

    it('should handle arrays of objects', () => {
      const input = [
        { name: '<script>John</script>' },
        { name: 'Jane' }
      ];
      
      const sanitized = sanitizeObject(input);
      
      expect(sanitized[0].name).not.toContain('<script>');
      expect(sanitized[1].name).toBe('Jane');
    });
  });

  describe('preventSQLInjection', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        body: {},
        query: {},
        params: {}
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      next = jest.fn();
    });

    it('should detect SQL SELECT injection', () => {
      req.body.search = "'; SELECT * FROM users; --";
      
      preventSQLInjection(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining('Invalid input detected')
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should detect SQL DROP injection', () => {
      req.body.name = "'; DROP TABLE users; --";
      
      preventSQLInjection(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should detect SQL OR injection', () => {
      req.body.username = "admin' OR '1'='1";
      
      preventSQLInjection(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should detect SQL comment injection', () => {
      req.body.comment = "test'; --";
      
      preventSQLInjection(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow safe inputs', () => {
      req.body.name = 'John Doe';
      req.body.email = 'john@example.com';
      req.query.search = 'software engineer';
      
      preventSQLInjection(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should check nested objects', () => {
      req.body.user = {
        name: 'John',
        profile: {
          bio: "'; DROP TABLE users; --"
        }
      };
      
      preventSQLInjection(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should check query parameters', () => {
      req.query.filter = "1=1 OR 1=1";
      
      preventSQLInjection(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should check URL parameters', () => {
      req.params.id = "'; DELETE FROM users; --";
      
      preventSQLInjection(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('XSS Prevention', () => {
    it('should prevent script tag injection', () => {
      const malicious = '<script>document.cookie</script>';
      const sanitized = sanitizeString(malicious);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('document.cookie');
    });

    it('should prevent img tag with onerror', () => {
      const malicious = '<img src=x onerror="alert(\'XSS\')">';
      const sanitized = sanitizeString(malicious);
      
      expect(sanitized).not.toContain('onerror');
    });

    it('should prevent iframe injection', () => {
      const malicious = '<iframe src="javascript:alert(\'XSS\')"></iframe>';
      const sanitized = sanitizeString(malicious);
      
      expect(sanitized).not.toContain('iframe');
      expect(sanitized).not.toContain('javascript:');
    });

    it('should prevent event handler injection', () => {
      const malicious = '<div onload="alert(\'XSS\')">Content</div>';
      const sanitized = sanitizeString(malicious);
      
      expect(sanitized).not.toContain('onload');
    });

    it('should handle multiple XSS attempts', () => {
      const malicious = '<script>alert(1)</script><img src=x onerror=alert(2)>';
      const sanitized = sanitizeString(malicious);
      
      expect(sanitized).not.toContain('script');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('alert');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const sanitized = sanitizeString('');
      expect(sanitized).toBe('');
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000) + '<script>alert("XSS")</script>';
      const sanitized = sanitizeString(longString);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized.length).toBeGreaterThan(0);
    });

    it('should handle unicode characters', () => {
      const unicode = 'Hello 世界 🌍';
      const sanitized = sanitizeString(unicode);
      
      expect(sanitized).toContain('Hello');
      expect(sanitized).toContain('世界');
    });

    it('should handle special characters', () => {
      const special = 'Price: $100 & 50% off!';
      const sanitized = sanitizeString(special);
      
      expect(sanitized).toContain('Price');
      expect(sanitized).toContain('100');
    });

    it('should handle mixed content', () => {
      const mixed = 'Normal text <script>bad</script> more text';
      const sanitized = sanitizeString(mixed);
      
      expect(sanitized).toContain('Normal text');
      expect(sanitized).toContain('more text');
      expect(sanitized).not.toContain('script');
    });
  });
});
