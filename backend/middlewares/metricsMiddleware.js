/**
 * Metrics Middleware
 * 
 * Automatically tracks response times and errors for all API requests.
 * 
 * Requirements: 15.10, 13.10
 */

import { metricsCollector } from '../utils/metricsCollector.js';

/**
 * Middleware to track API response times
 * 
 * Automatically records:
 * - Response time for each request
 * - Errors (4xx and 5xx responses)
 * 
 * Usage: Add to Express app before routes
 */
export const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Capture the original res.json and res.send methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  // Override res.json to track metrics
  res.json = function(body) {
    trackMetrics();
    return originalJson(body);
  };

  // Override res.send to track metrics
  res.send = function(body) {
    trackMetrics();
    return originalSend(body);
  };

  function trackMetrics() {
    const duration = Date.now() - startTime;
    const endpoint = `${req.method} ${req.route?.path || req.path}`;

    // Record response time
    metricsCollector.recordResponseTime(endpoint, duration);

    // Record errors (4xx and 5xx status codes)
    if (res.statusCode >= 400) {
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      metricsCollector.recordError(
        endpoint,
        `HTTP ${res.statusCode}`,
        errorType
      );
    }
  }

  next();
};

/**
 * Error tracking middleware
 * 
 * Records errors that are caught by error handlers.
 * Should be used in conjunction with the main error middleware.
 */
export const errorMetricsMiddleware = (err, req, res, next) => {
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  
  // Record the error
  metricsCollector.recordError(
    endpoint,
    err.message || 'Unknown error',
    'exception'
  );

  // Pass to next error handler
  next(err);
};
