/**
 * Metrics Collector
 * 
 * Centralized metrics collection and monitoring system.
 * Tracks system health metrics, performance, and automation success rates.
 * 
 * Requirements: 15.10, 13.10, Observability section
 * 
 * Key Features:
 * - Response time tracking (95th percentile monitoring)
 * - Error rate monitoring (5% threshold over 10-minute window)
 * - Automation success rate tracking
 * - Background scheduler performance metrics
 * - Email delivery success rates
 * - Calendar API success rates
 * - Alert threshold checking
 * 
 * For MVP: Uses in-memory storage with time-series data
 * Production: Would use InfluxDB, Prometheus, or similar time-series database
 */

import { supabase } from '../database/supabaseClient.js';

class MetricsCollector {
  constructor() {
    // In-memory storage for metrics (MVP approach)
    // In production, this would be replaced with a time-series database
    this.metrics = {
      responseTimes: [], // Array of { timestamp, endpoint, duration }
      errors: [], // Array of { timestamp, endpoint, error, type }
      automationActions: [], // Array of { timestamp, action, success }
      schedulerCycles: [], // Array of { timestamp, duration, success }
      emailDeliveries: [], // Array of { timestamp, success }
      calendarApiCalls: [], // Array of { timestamp, success }
    };

    // Alert thresholds (from requirements)
    this.thresholds = {
      responseTime95thPercentile: 2000, // 2 seconds in milliseconds
      errorRatePercent: 5, // 5% error rate
      errorRateWindowMinutes: 10, // 10-minute window
      automationSuccessRatePercent: 90, // 90% success rate
      schedulerCycleTimeMs: 60000, // 60 seconds
    };

    // Cleanup old metrics every hour (keep last 24 hours)
    setInterval(() => this.cleanupOldMetrics(), 60 * 60 * 1000);
  }

  /**
   * Record API response time
   * 
   * @param {string} endpoint - API endpoint path
   * @param {number} duration - Response time in milliseconds
   */
  recordResponseTime(endpoint, duration) {
    this.metrics.responseTimes.push({
      timestamp: Date.now(),
      endpoint,
      duration,
    });
  }

  /**
   * Record an error
   * 
   * @param {string} endpoint - API endpoint or component where error occurred
   * @param {string} error - Error message
   * @param {string} type - Error type (e.g., 'api', 'database', 'external_service')
   */
  recordError(endpoint, error, type = 'api') {
    this.metrics.errors.push({
      timestamp: Date.now(),
      endpoint,
      error,
      type,
    });
  }

  /**
   * Record automation action result
   * 
   * @param {string} action - Action type (e.g., 'invitation_sent', 'buffer_promotion')
   * @param {boolean} success - Whether the action succeeded
   */
  recordAutomationAction(action, success) {
    this.metrics.automationActions.push({
      timestamp: Date.now(),
      action,
      success,
    });
  }

  /**
   * Record background scheduler cycle
   * 
   * @param {number} duration - Cycle duration in milliseconds
   * @param {boolean} success - Whether the cycle completed successfully
   */
  recordSchedulerCycle(duration, success) {
    this.metrics.schedulerCycles.push({
      timestamp: Date.now(),
      duration,
      success,
    });
  }

  /**
   * Record email delivery attempt
   * 
   * @param {boolean} success - Whether the email was delivered successfully
   */
  recordEmailDelivery(success) {
    this.metrics.emailDeliveries.push({
      timestamp: Date.now(),
      success,
    });
  }

  /**
   * Record calendar API call
   * 
   * @param {boolean} success - Whether the API call succeeded
   */
  recordCalendarApiCall(success) {
    this.metrics.calendarApiCalls.push({
      timestamp: Date.now(),
      success,
    });
  }

  /**
   * Get metrics within a time window
   * 
   * @param {Array} metricsArray - Array of metrics to filter
   * @param {number} windowMinutes - Time window in minutes
   * @returns {Array} Filtered metrics
   */
  getMetricsInWindow(metricsArray, windowMinutes) {
    const cutoffTime = Date.now() - (windowMinutes * 60 * 1000);
    return metricsArray.filter(m => m.timestamp >= cutoffTime);
  }

  /**
   * Calculate 95th percentile response time
   * 
   * Requirements: 15.10
   * 
   * @param {number} windowMinutes - Time window in minutes (default: 60)
   * @returns {number} 95th percentile response time in milliseconds
   */
  calculate95thPercentileResponseTime(windowMinutes = 60) {
    const recentMetrics = this.getMetricsInWindow(this.metrics.responseTimes, windowMinutes);
    
    if (recentMetrics.length === 0) {
      return 0;
    }

    const sortedDurations = recentMetrics
      .map(m => m.duration)
      .sort((a, b) => a - b);

    const index = Math.ceil(sortedDurations.length * 0.95) - 1;
    return sortedDurations[index] || 0;
  }

  /**
   * Calculate error rate over time window
   * 
   * Requirements: 13.10
   * 
   * @param {number} windowMinutes - Time window in minutes (default: 10)
   * @returns {number} Error rate as percentage (0-100)
   */
  calculateErrorRate(windowMinutes = 10) {
    const recentErrors = this.getMetricsInWindow(this.metrics.errors, windowMinutes);
    const recentResponses = this.getMetricsInWindow(this.metrics.responseTimes, windowMinutes);

    const totalRequests = recentResponses.length;
    const errorCount = recentErrors.length;

    if (totalRequests === 0) {
      return 0;
    }

    return (errorCount / totalRequests) * 100;
  }

  /**
   * Calculate automation success rate
   * 
   * @param {number} windowMinutes - Time window in minutes (default: 60)
   * @returns {number} Success rate as percentage (0-100)
   */
  calculateAutomationSuccessRate(windowMinutes = 60) {
    const recentActions = this.getMetricsInWindow(this.metrics.automationActions, windowMinutes);

    if (recentActions.length === 0) {
      return 100; // No actions = 100% success (no failures)
    }

    const successCount = recentActions.filter(a => a.success).length;
    return (successCount / recentActions.length) * 100;
  }

  /**
   * Calculate email delivery success rate
   * 
   * @param {number} windowMinutes - Time window in minutes (default: 60)
   * @returns {number} Success rate as percentage (0-100)
   */
  calculateEmailDeliveryRate(windowMinutes = 60) {
    const recentDeliveries = this.getMetricsInWindow(this.metrics.emailDeliveries, windowMinutes);

    if (recentDeliveries.length === 0) {
      return 100;
    }

    const successCount = recentDeliveries.filter(d => d.success).length;
    return (successCount / recentDeliveries.length) * 100;
  }

  /**
   * Calculate calendar API success rate
   * 
   * @param {number} windowMinutes - Time window in minutes (default: 60)
   * @returns {number} Success rate as percentage (0-100)
   */
  calculateCalendarApiSuccessRate(windowMinutes = 60) {
    const recentCalls = this.getMetricsInWindow(this.metrics.calendarApiCalls, windowMinutes);

    if (recentCalls.length === 0) {
      return 100;
    }

    const successCount = recentCalls.filter(c => c.success).length;
    return (successCount / recentCalls.length) * 100;
  }

  /**
   * Get average scheduler cycle time
   * 
   * @param {number} windowMinutes - Time window in minutes (default: 60)
   * @returns {number} Average cycle time in milliseconds
   */
  getAverageSchedulerCycleTime(windowMinutes = 60) {
    const recentCycles = this.getMetricsInWindow(this.metrics.schedulerCycles, windowMinutes);

    if (recentCycles.length === 0) {
      return 0;
    }

    const totalDuration = recentCycles.reduce((sum, c) => sum + c.duration, 0);
    return totalDuration / recentCycles.length;
  }

  /**
   * Check alert thresholds and return active alerts
   * 
   * Requirements: 15.10, 13.10
   * 
   * @returns {Array} Array of active alerts
   */
  checkAlertThresholds() {
    const alerts = [];

    // Check 95th percentile response time
    const p95ResponseTime = this.calculate95thPercentileResponseTime(60);
    if (p95ResponseTime > this.thresholds.responseTime95thPercentile) {
      alerts.push({
        type: 'response_time',
        severity: 'warning',
        message: `95th percentile response time (${p95ResponseTime}ms) exceeds threshold (${this.thresholds.responseTime95thPercentile}ms)`,
        value: p95ResponseTime,
        threshold: this.thresholds.responseTime95thPercentile,
        timestamp: Date.now(),
      });
    }

    // Check error rate over 10-minute window
    const errorRate = this.calculateErrorRate(this.thresholds.errorRateWindowMinutes);
    if (errorRate > this.thresholds.errorRatePercent) {
      alerts.push({
        type: 'error_rate',
        severity: 'critical',
        message: `Error rate (${errorRate.toFixed(2)}%) exceeds threshold (${this.thresholds.errorRatePercent}%) over ${this.thresholds.errorRateWindowMinutes}-minute window`,
        value: errorRate,
        threshold: this.thresholds.errorRatePercent,
        timestamp: Date.now(),
      });
    }

    // Check automation success rate
    const automationSuccessRate = this.calculateAutomationSuccessRate(60);
    if (automationSuccessRate < this.thresholds.automationSuccessRatePercent) {
      alerts.push({
        type: 'automation_success_rate',
        severity: 'warning',
        message: `Automation success rate (${automationSuccessRate.toFixed(2)}%) below threshold (${this.thresholds.automationSuccessRatePercent}%)`,
        value: automationSuccessRate,
        threshold: this.thresholds.automationSuccessRatePercent,
        timestamp: Date.now(),
      });
    }

    // Check scheduler cycle time
    const avgCycleTime = this.getAverageSchedulerCycleTime(60);
    if (avgCycleTime > this.thresholds.schedulerCycleTimeMs) {
      alerts.push({
        type: 'scheduler_cycle_time',
        severity: 'warning',
        message: `Average scheduler cycle time (${avgCycleTime}ms) exceeds threshold (${this.thresholds.schedulerCycleTimeMs}ms)`,
        value: avgCycleTime,
        threshold: this.thresholds.schedulerCycleTimeMs,
        timestamp: Date.now(),
      });
    }

    return alerts;
  }

  /**
   * Get overall system health status
   * 
   * @returns {Object} System health summary
   */
  getSystemHealth() {
    const alerts = this.checkAlertThresholds();
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const warningAlerts = alerts.filter(a => a.severity === 'warning');

    let status = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (warningAlerts.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      timestamp: Date.now(),
      alerts: {
        critical: criticalAlerts.length,
        warning: warningAlerts.length,
        total: alerts.length,
      },
      metrics: {
        responseTime95thPercentile: this.calculate95thPercentileResponseTime(60),
        errorRate: this.calculateErrorRate(10),
        automationSuccessRate: this.calculateAutomationSuccessRate(60),
        emailDeliveryRate: this.calculateEmailDeliveryRate(60),
        calendarApiSuccessRate: this.calculateCalendarApiSuccessRate(60),
        avgSchedulerCycleTime: this.getAverageSchedulerCycleTime(60),
      },
      alertDetails: alerts,
    };
  }

  /**
   * Get performance metrics
   * 
   * @param {number} windowMinutes - Time window in minutes (default: 60)
   * @returns {Object} Performance metrics summary
   */
  getPerformanceMetrics(windowMinutes = 60) {
    const recentResponses = this.getMetricsInWindow(this.metrics.responseTimes, windowMinutes);

    if (recentResponses.length === 0) {
      return {
        totalRequests: 0,
        avgResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        byEndpoint: {},
      };
    }

    const sortedDurations = recentResponses
      .map(m => m.duration)
      .sort((a, b) => a - b);

    const p50Index = Math.ceil(sortedDurations.length * 0.50) - 1;
    const p95Index = Math.ceil(sortedDurations.length * 0.95) - 1;
    const p99Index = Math.ceil(sortedDurations.length * 0.99) - 1;

    // Calculate metrics by endpoint
    const byEndpoint = {};
    recentResponses.forEach(m => {
      if (!byEndpoint[m.endpoint]) {
        byEndpoint[m.endpoint] = {
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
        };
      }
      byEndpoint[m.endpoint].count++;
      byEndpoint[m.endpoint].totalDuration += m.duration;
    });

    // Calculate averages
    Object.keys(byEndpoint).forEach(endpoint => {
      byEndpoint[endpoint].avgDuration = 
        byEndpoint[endpoint].totalDuration / byEndpoint[endpoint].count;
    });

    return {
      totalRequests: recentResponses.length,
      avgResponseTime: sortedDurations.reduce((a, b) => a + b, 0) / sortedDurations.length,
      p50ResponseTime: sortedDurations[p50Index] || 0,
      p95ResponseTime: sortedDurations[p95Index] || 0,
      p99ResponseTime: sortedDurations[p99Index] || 0,
      minResponseTime: sortedDurations[0] || 0,
      maxResponseTime: sortedDurations[sortedDurations.length - 1] || 0,
      byEndpoint,
    };
  }

  /**
   * Get error metrics
   * 
   * @param {number} windowMinutes - Time window in minutes (default: 60)
   * @returns {Object} Error metrics summary
   */
  getErrorMetrics(windowMinutes = 60) {
    const recentErrors = this.getMetricsInWindow(this.metrics.errors, windowMinutes);
    const recentResponses = this.getMetricsInWindow(this.metrics.responseTimes, windowMinutes);

    const totalRequests = recentResponses.length;
    const errorCount = recentErrors.length;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

    // Group errors by endpoint
    const byEndpoint = {};
    recentErrors.forEach(e => {
      if (!byEndpoint[e.endpoint]) {
        byEndpoint[e.endpoint] = {
          count: 0,
          errors: [],
        };
      }
      byEndpoint[e.endpoint].count++;
      byEndpoint[e.endpoint].errors.push({
        error: e.error,
        type: e.type,
        timestamp: e.timestamp,
      });
    });

    // Group errors by type
    const byType = {};
    recentErrors.forEach(e => {
      if (!byType[e.type]) {
        byType[e.type] = 0;
      }
      byType[e.type]++;
    });

    return {
      totalErrors: errorCount,
      totalRequests,
      errorRate,
      byEndpoint,
      byType,
      recentErrors: recentErrors.slice(-10), // Last 10 errors
    };
  }

  /**
   * Get automation metrics
   * 
   * @param {number} windowMinutes - Time window in minutes (default: 60)
   * @returns {Object} Automation metrics summary
   */
  getAutomationMetrics(windowMinutes = 60) {
    const recentActions = this.getMetricsInWindow(this.metrics.automationActions, windowMinutes);
    const recentCycles = this.getMetricsInWindow(this.metrics.schedulerCycles, windowMinutes);

    const totalActions = recentActions.length;
    const successfulActions = recentActions.filter(a => a.success).length;
    const successRate = totalActions > 0 ? (successfulActions / totalActions) * 100 : 100;

    // Group actions by type
    const byAction = {};
    recentActions.forEach(a => {
      if (!byAction[a.action]) {
        byAction[a.action] = {
          total: 0,
          successful: 0,
          failed: 0,
          successRate: 0,
        };
      }
      byAction[a.action].total++;
      if (a.success) {
        byAction[a.action].successful++;
      } else {
        byAction[a.action].failed++;
      }
    });

    // Calculate success rates
    Object.keys(byAction).forEach(action => {
      byAction[action].successRate = 
        (byAction[action].successful / byAction[action].total) * 100;
    });

    // Scheduler metrics
    const totalCycles = recentCycles.length;
    const successfulCycles = recentCycles.filter(c => c.success).length;
    const avgCycleTime = totalCycles > 0
      ? recentCycles.reduce((sum, c) => sum + c.duration, 0) / totalCycles
      : 0;

    return {
      automationActions: {
        total: totalActions,
        successful: successfulActions,
        failed: totalActions - successfulActions,
        successRate,
        byAction,
      },
      backgroundScheduler: {
        totalCycles,
        successfulCycles,
        failedCycles: totalCycles - successfulCycles,
        avgCycleTime,
        lastCycleTime: recentCycles.length > 0 
          ? recentCycles[recentCycles.length - 1].duration 
          : 0,
      },
      emailDelivery: {
        successRate: this.calculateEmailDeliveryRate(windowMinutes),
        total: this.getMetricsInWindow(this.metrics.emailDeliveries, windowMinutes).length,
      },
      calendarApi: {
        successRate: this.calculateCalendarApiSuccessRate(windowMinutes),
        total: this.getMetricsInWindow(this.metrics.calendarApiCalls, windowMinutes).length,
      },
    };
  }

  /**
   * Clean up old metrics (keep last 24 hours)
   */
  cleanupOldMetrics() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    this.metrics.responseTimes = this.metrics.responseTimes.filter(m => m.timestamp >= cutoffTime);
    this.metrics.errors = this.metrics.errors.filter(m => m.timestamp >= cutoffTime);
    this.metrics.automationActions = this.metrics.automationActions.filter(m => m.timestamp >= cutoffTime);
    this.metrics.schedulerCycles = this.metrics.schedulerCycles.filter(m => m.timestamp >= cutoffTime);
    this.metrics.emailDeliveries = this.metrics.emailDeliveries.filter(m => m.timestamp >= cutoffTime);
    this.metrics.calendarApiCalls = this.metrics.calendarApiCalls.filter(m => m.timestamp >= cutoffTime);

    console.log('[MetricsCollector] Cleaned up old metrics');
  }

  /**
   * Reset all metrics (for testing)
   */
  reset() {
    this.metrics = {
      responseTimes: [],
      errors: [],
      automationActions: [],
      schedulerCycles: [],
      emailDeliveries: [],
      calendarApiCalls: [],
    };
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector();
export default MetricsCollector;
