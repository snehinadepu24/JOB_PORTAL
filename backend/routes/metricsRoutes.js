/**
 * Metrics Routes
 * 
 * API endpoints for system metrics and health monitoring.
 * 
 * Requirements: 15.10, 13.10, Observability section
 * 
 * Endpoints:
 * - GET /api/v1/metrics/health - Overall system health
 * - GET /api/v1/metrics/performance - Response time metrics
 * - GET /api/v1/metrics/errors - Error rate metrics
 * - GET /api/v1/metrics/automation - Automation success metrics
 */

import express from 'express';
import { 
  getSystemHealth,
  getPerformanceMetrics,
  getErrorMetrics,
  getAutomationMetrics,
  getMetricsDashboard,
} from '../controllers/metricsController.js';
import { isAuthenticated } from '../middlewares/auth.js';

const router = express.Router();

// All metrics endpoints require authentication
// In production, these would be restricted to admin users only

/**
 * GET /api/v1/metrics/health
 * 
 * Get overall system health status with active alerts
 */
router.get('/health', isAuthenticated, getSystemHealth);

/**
 * GET /api/v1/metrics/performance
 * 
 * Get response time metrics (avg, p50, p95, p99, by endpoint)
 * Query params:
 * - window: Time window in minutes (default: 60)
 */
router.get('/performance', isAuthenticated, getPerformanceMetrics);

/**
 * GET /api/v1/metrics/errors
 * 
 * Get error rate metrics (total, by endpoint, by type)
 * Query params:
 * - window: Time window in minutes (default: 60)
 */
router.get('/errors', isAuthenticated, getErrorMetrics);

/**
 * GET /api/v1/metrics/automation
 * 
 * Get automation success metrics (actions, scheduler, email, calendar)
 * Query params:
 * - window: Time window in minutes (default: 60)
 */
router.get('/automation', isAuthenticated, getAutomationMetrics);

/**
 * GET /api/v1/metrics/dashboard
 * 
 * Get comprehensive metrics dashboard with all system metrics
 * Query params:
 * - window: Time window in minutes (default: 60)
 */
router.get('/dashboard', isAuthenticated, getMetricsDashboard);

export default router;
