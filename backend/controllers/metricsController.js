/**
 * Metrics Controller
 * 
 * Handles metrics API endpoints for system monitoring and observability.
 * 
 * Requirements: 15.10, 13.10, Observability section
 */

import { metricsCollector } from '../utils/metricsCollector.js';
import { catchAsyncError } from '../middlewares/catchAsyncError.js';

/**
 * Get overall system health
 * 
 * GET /api/v1/metrics/health
 * 
 * Returns:
 * - status: 'healthy' | 'degraded' | 'critical'
 * - alerts: Active alerts with severity levels
 * - metrics: Current metric values
 * 
 * Requirements: 15.10, 13.10
 */
export const getSystemHealth = catchAsyncError(async (req, res, next) => {
  const health = metricsCollector.getSystemHealth();

  res.status(200).json({
    success: true,
    data: health,
  });
});

/**
 * Get performance metrics
 * 
 * GET /api/v1/metrics/performance?window=60
 * 
 * Query params:
 * - window: Time window in minutes (default: 60)
 * 
 * Returns:
 * - totalRequests: Total number of requests in window
 * - avgResponseTime: Average response time
 * - p50ResponseTime: 50th percentile (median)
 * - p95ResponseTime: 95th percentile
 * - p99ResponseTime: 99th percentile
 * - minResponseTime: Minimum response time
 * - maxResponseTime: Maximum response time
 * - byEndpoint: Metrics grouped by endpoint
 * 
 * Requirements: 15.10
 */
export const getPerformanceMetrics = catchAsyncError(async (req, res, next) => {
  const window = parseInt(req.query.window) || 60;

  // Validate window parameter
  if (window < 1 || window > 1440) { // Max 24 hours
    return res.status(400).json({
      success: false,
      error: 'Window must be between 1 and 1440 minutes',
    });
  }

  const metrics = metricsCollector.getPerformanceMetrics(window);

  res.status(200).json({
    success: true,
    data: {
      window: `${window} minutes`,
      ...metrics,
    },
  });
});

/**
 * Get error metrics
 * 
 * GET /api/v1/metrics/errors?window=60
 * 
 * Query params:
 * - window: Time window in minutes (default: 60)
 * 
 * Returns:
 * - totalErrors: Total number of errors
 * - totalRequests: Total number of requests
 * - errorRate: Error rate as percentage
 * - byEndpoint: Errors grouped by endpoint
 * - byType: Errors grouped by type
 * - recentErrors: Last 10 errors
 * 
 * Requirements: 13.10
 */
export const getErrorMetrics = catchAsyncError(async (req, res, next) => {
  const window = parseInt(req.query.window) || 60;

  // Validate window parameter
  if (window < 1 || window > 1440) {
    return res.status(400).json({
      success: false,
      error: 'Window must be between 1 and 1440 minutes',
    });
  }

  const metrics = metricsCollector.getErrorMetrics(window);

  res.status(200).json({
    success: true,
    data: {
      window: `${window} minutes`,
      ...metrics,
    },
  });
});

/**
 * Get automation metrics
 * 
 * GET /api/v1/metrics/automation?window=60
 * 
 * Query params:
 * - window: Time window in minutes (default: 60)
 * 
 * Returns:
 * - automationActions: Success rate and breakdown by action type
 * - backgroundScheduler: Cycle times and success rate
 * - emailDelivery: Email delivery success rate
 * - calendarApi: Calendar API success rate
 */
export const getAutomationMetrics = catchAsyncError(async (req, res, next) => {
  const window = parseInt(req.query.window) || 60;

  // Validate window parameter
  if (window < 1 || window > 1440) {
    return res.status(400).json({
      success: false,
      error: 'Window must be between 1 and 1440 minutes',
    });
  }

  const metrics = metricsCollector.getAutomationMetrics(window);

  res.status(200).json({
    success: true,
    data: {
      window: `${window} minutes`,
      ...metrics,
    },
  });
});
