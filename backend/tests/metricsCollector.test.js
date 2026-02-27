/**
 * Unit Tests for MetricsCollector
 * 
 * Tests metrics collection, aggregation, and alert threshold checking.
 * 
 * Requirements: 15.10, 13.10
 */

import MetricsCollector from '../utils/metricsCollector.js';

describe('MetricsCollector', () => {
  let collector;

  beforeEach(() => {
    // Create fresh instance for each test
    collector = new MetricsCollector();
  });

  afterEach(() => {
    // Clean up
    collector.reset();
  });

  describe('Response Time Tracking', () => {
    it('should record response times', () => {
      collector.recordResponseTime('/api/test', 100);
      collector.recordResponseTime('/api/test', 200);
      collector.recordResponseTime('/api/test', 300);

      expect(collector.metrics.responseTimes.length).toBe(3);
      expect(collector.metrics.responseTimes[0].duration).toBe(100);
      expect(collector.metrics.responseTimes[1].duration).toBe(200);
      expect(collector.metrics.responseTimes[2].duration).toBe(300);
    });

    it('should calculate 95th percentile response time', () => {
      // Add 100 response times from 100ms to 10000ms
      for (let i = 1; i <= 100; i++) {
        collector.recordResponseTime('/api/test', i * 100);
      }

      const p95 = collector.calculate95thPercentileResponseTime(60);
      
      // 95th percentile of 100 values should be around the 95th value
      expect(p95).toBeGreaterThanOrEqual(9400);
      expect(p95).toBeLessThanOrEqual(9600);
    });

    it('should return 0 for 95th percentile when no metrics', () => {
      const p95 = collector.calculate95thPercentileResponseTime(60);
      expect(p95).toBe(0);
    });

    it('should calculate performance metrics correctly', () => {
      collector.recordResponseTime('/api/test', 100);
      collector.recordResponseTime('/api/test', 200);
      collector.recordResponseTime('/api/test', 300);
      collector.recordResponseTime('/api/other', 150);

      const metrics = collector.getPerformanceMetrics(60);

      expect(metrics.totalRequests).toBe(4);
      expect(metrics.avgResponseTime).toBe(187.5);
      expect(metrics.minResponseTime).toBe(100);
      expect(metrics.maxResponseTime).toBe(300);
      expect(metrics.byEndpoint['/api/test'].count).toBe(3);
      expect(metrics.byEndpoint['/api/other'].count).toBe(1);
    });
  });

  describe('Error Tracking', () => {
    it('should record errors', () => {
      collector.recordError('/api/test', 'Test error', 'api');
      collector.recordError('/api/test', 'Another error', 'database');

      expect(collector.metrics.errors.length).toBe(2);
      expect(collector.metrics.errors[0].error).toBe('Test error');
      expect(collector.metrics.errors[1].type).toBe('database');
    });

    it('should calculate error rate correctly', () => {
      // Record 10 requests
      for (let i = 0; i < 10; i++) {
        collector.recordResponseTime('/api/test', 100);
      }

      // Record 2 errors (20% error rate)
      collector.recordError('/api/test', 'Error 1', 'api');
      collector.recordError('/api/test', 'Error 2', 'api');

      const errorRate = collector.calculateErrorRate(60);
      expect(errorRate).toBe(20);
    });

    it('should return 0 error rate when no requests', () => {
      collector.recordError('/api/test', 'Error', 'api');
      const errorRate = collector.calculateErrorRate(60);
      expect(errorRate).toBe(0);
    });

    it('should group errors by endpoint and type', () => {
      collector.recordResponseTime('/api/test', 100);
      collector.recordResponseTime('/api/other', 100);
      
      collector.recordError('/api/test', 'Error 1', 'api');
      collector.recordError('/api/test', 'Error 2', 'database');
      collector.recordError('/api/other', 'Error 3', 'api');

      const metrics = collector.getErrorMetrics(60);

      expect(metrics.totalErrors).toBe(3);
      expect(metrics.byEndpoint['/api/test'].count).toBe(2);
      expect(metrics.byEndpoint['/api/other'].count).toBe(1);
      expect(metrics.byType['api']).toBe(2);
      expect(metrics.byType['database']).toBe(1);
    });
  });

  describe('Automation Metrics', () => {
    it('should record automation actions', () => {
      collector.recordAutomationAction('invitation_sent', true);
      collector.recordAutomationAction('buffer_promotion', true);
      collector.recordAutomationAction('auto_shortlist', false);

      expect(collector.metrics.automationActions.length).toBe(3);
    });

    it('should calculate automation success rate', () => {
      // 8 successful, 2 failed = 80% success rate
      for (let i = 0; i < 8; i++) {
        collector.recordAutomationAction('test_action', true);
      }
      for (let i = 0; i < 2; i++) {
        collector.recordAutomationAction('test_action', false);
      }

      const successRate = collector.calculateAutomationSuccessRate(60);
      expect(successRate).toBe(80);
    });

    it('should return 100% success rate when no actions', () => {
      const successRate = collector.calculateAutomationSuccessRate(60);
      expect(successRate).toBe(100);
    });

    it('should group automation actions by type', () => {
      collector.recordAutomationAction('invitation_sent', true);
      collector.recordAutomationAction('invitation_sent', true);
      collector.recordAutomationAction('invitation_sent', false);
      collector.recordAutomationAction('buffer_promotion', true);

      const metrics = collector.getAutomationMetrics(60);

      expect(metrics.automationActions.total).toBe(4);
      expect(metrics.automationActions.successful).toBe(3);
      expect(metrics.automationActions.failed).toBe(1);
      expect(metrics.automationActions.byAction['invitation_sent'].total).toBe(3);
      expect(metrics.automationActions.byAction['invitation_sent'].successful).toBe(2);
      expect(metrics.automationActions.byAction['invitation_sent'].failed).toBe(1);
      expect(metrics.automationActions.byAction['buffer_promotion'].total).toBe(1);
    });
  });

  describe('Scheduler Metrics', () => {
    it('should record scheduler cycles', () => {
      collector.recordSchedulerCycle(45000, true);
      collector.recordSchedulerCycle(50000, true);
      collector.recordSchedulerCycle(55000, false);

      expect(collector.metrics.schedulerCycles.length).toBe(3);
    });

    it('should calculate average cycle time', () => {
      collector.recordSchedulerCycle(40000, true);
      collector.recordSchedulerCycle(50000, true);
      collector.recordSchedulerCycle(60000, true);

      const avgTime = collector.getAverageSchedulerCycleTime(60);
      expect(avgTime).toBe(50000);
    });

    it('should return 0 average when no cycles', () => {
      const avgTime = collector.getAverageSchedulerCycleTime(60);
      expect(avgTime).toBe(0);
    });
  });

  describe('Email and Calendar Metrics', () => {
    it('should record email deliveries', () => {
      collector.recordEmailDelivery(true);
      collector.recordEmailDelivery(true);
      collector.recordEmailDelivery(false);

      expect(collector.metrics.emailDeliveries.length).toBe(3);
    });

    it('should calculate email delivery rate', () => {
      // 9 successful, 1 failed = 90% success rate
      for (let i = 0; i < 9; i++) {
        collector.recordEmailDelivery(true);
      }
      collector.recordEmailDelivery(false);

      const rate = collector.calculateEmailDeliveryRate(60);
      expect(rate).toBe(90);
    });

    it('should record calendar API calls', () => {
      collector.recordCalendarApiCall(true);
      collector.recordCalendarApiCall(true);
      collector.recordCalendarApiCall(false);

      expect(collector.metrics.calendarApiCalls.length).toBe(3);
    });

    it('should calculate calendar API success rate', () => {
      // 7 successful, 3 failed = 70% success rate
      for (let i = 0; i < 7; i++) {
        collector.recordCalendarApiCall(true);
      }
      for (let i = 0; i < 3; i++) {
        collector.recordCalendarApiCall(false);
      }

      const rate = collector.calculateCalendarApiSuccessRate(60);
      expect(rate).toBe(70);
    });
  });

  describe('Alert Threshold Checking', () => {
    it('should trigger alert when 95th percentile exceeds threshold', () => {
      // Add 100 response times: 95 at 1000ms, 5 at 3000ms
      // This ensures 95th percentile will be around 3000ms (exceeds 2000ms threshold)
      for (let i = 0; i < 95; i++) {
        collector.recordResponseTime('/api/test', 1000);
      }
      for (let i = 0; i < 5; i++) {
        collector.recordResponseTime('/api/test', 3000);
      }

      const p95 = collector.calculate95thPercentileResponseTime(60);
      console.log('95th percentile:', p95);

      const alerts = collector.checkAlertThresholds();
      console.log('Alerts:', alerts);
      
      const responseTimeAlert = alerts.find(a => a.type === 'response_time');

      expect(responseTimeAlert).toBeDefined();
      expect(responseTimeAlert.severity).toBe('warning');
      expect(responseTimeAlert.value).toBeGreaterThan(2000);
    });

    it('should trigger alert when error rate exceeds threshold', () => {
      // 10 requests, 6 errors = 60% error rate (exceeds 5% threshold)
      for (let i = 0; i < 10; i++) {
        collector.recordResponseTime('/api/test', 100);
      }
      for (let i = 0; i < 6; i++) {
        collector.recordError('/api/test', 'Error', 'api');
      }

      const alerts = collector.checkAlertThresholds();
      const errorRateAlert = alerts.find(a => a.type === 'error_rate');

      expect(errorRateAlert).toBeDefined();
      expect(errorRateAlert.severity).toBe('critical');
      expect(errorRateAlert.value).toBeGreaterThan(5);
    });

    it('should trigger alert when automation success rate drops below threshold', () => {
      // 5 successful, 5 failed = 50% success rate (below 90% threshold)
      for (let i = 0; i < 5; i++) {
        collector.recordAutomationAction('test', true);
        collector.recordAutomationAction('test', false);
      }

      const alerts = collector.checkAlertThresholds();
      const automationAlert = alerts.find(a => a.type === 'automation_success_rate');

      expect(automationAlert).toBeDefined();
      expect(automationAlert.severity).toBe('warning');
      expect(automationAlert.value).toBeLessThan(90);
    });

    it('should trigger alert when scheduler cycle time exceeds threshold', () => {
      // Record cycles exceeding 60 seconds
      collector.recordSchedulerCycle(70000, true);
      collector.recordSchedulerCycle(75000, true);

      const alerts = collector.checkAlertThresholds();
      const schedulerAlert = alerts.find(a => a.type === 'scheduler_cycle_time');

      expect(schedulerAlert).toBeDefined();
      expect(schedulerAlert.severity).toBe('warning');
      expect(schedulerAlert.value).toBeGreaterThan(60000);
    });

    it('should not trigger alerts when metrics are healthy', () => {
      // Add healthy metrics
      for (let i = 0; i < 100; i++) {
        collector.recordResponseTime('/api/test', 500);
      }
      collector.recordAutomationAction('test', true);
      collector.recordSchedulerCycle(30000, true);
      collector.recordEmailDelivery(true);
      collector.recordCalendarApiCall(true);

      const alerts = collector.checkAlertThresholds();
      expect(alerts.length).toBe(0);
    });
  });

  describe('System Health', () => {
    it('should return healthy status when no alerts', () => {
      // Add healthy metrics
      collector.recordResponseTime('/api/test', 500);
      collector.recordAutomationAction('test', true);

      const health = collector.getSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.alerts.total).toBe(0);
      expect(health.metrics).toBeDefined();
    });

    it('should return degraded status when warning alerts exist', () => {
      // Trigger warning alert (automation success rate)
      for (let i = 0; i < 5; i++) {
        collector.recordAutomationAction('test', true);
        collector.recordAutomationAction('test', false);
      }

      const health = collector.getSystemHealth();

      expect(health.status).toBe('degraded');
      expect(health.alerts.warning).toBeGreaterThan(0);
    });

    it('should return critical status when critical alerts exist', () => {
      // Trigger critical alert (error rate)
      for (let i = 0; i < 10; i++) {
        collector.recordResponseTime('/api/test', 100);
      }
      for (let i = 0; i < 6; i++) {
        collector.recordError('/api/test', 'Error', 'api');
      }

      const health = collector.getSystemHealth();

      expect(health.status).toBe('critical');
      expect(health.alerts.critical).toBeGreaterThan(0);
    });
  });

  describe('Time Window Filtering', () => {
    it('should filter metrics by time window', () => {
      const now = Date.now();
      
      // Add old metric (2 hours ago)
      collector.metrics.responseTimes.push({
        timestamp: now - (2 * 60 * 60 * 1000),
        endpoint: '/api/old',
        duration: 100,
      });

      // Add recent metric (30 minutes ago)
      collector.metrics.responseTimes.push({
        timestamp: now - (30 * 60 * 1000),
        endpoint: '/api/recent',
        duration: 200,
      });

      const recentMetrics = collector.getMetricsInWindow(
        collector.metrics.responseTimes,
        60 // 60-minute window
      );

      expect(recentMetrics.length).toBe(1);
      expect(recentMetrics[0].endpoint).toBe('/api/recent');
    });
  });

  describe('Metrics Cleanup', () => {
    it('should clean up old metrics', () => {
      const now = Date.now();
      
      // Add old metrics (25 hours ago)
      collector.metrics.responseTimes.push({
        timestamp: now - (25 * 60 * 60 * 1000),
        endpoint: '/api/old',
        duration: 100,
      });

      // Add recent metrics
      collector.metrics.responseTimes.push({
        timestamp: now,
        endpoint: '/api/recent',
        duration: 200,
      });

      expect(collector.metrics.responseTimes.length).toBe(2);

      collector.cleanupOldMetrics();

      expect(collector.metrics.responseTimes.length).toBe(1);
      expect(collector.metrics.responseTimes[0].endpoint).toBe('/api/recent');
    });
  });

  describe('Reset', () => {
    it('should reset all metrics', () => {
      collector.recordResponseTime('/api/test', 100);
      collector.recordError('/api/test', 'Error', 'api');
      collector.recordAutomationAction('test', true);

      expect(collector.metrics.responseTimes.length).toBeGreaterThan(0);
      expect(collector.metrics.errors.length).toBeGreaterThan(0);
      expect(collector.metrics.automationActions.length).toBeGreaterThan(0);

      collector.reset();

      expect(collector.metrics.responseTimes.length).toBe(0);
      expect(collector.metrics.errors.length).toBe(0);
      expect(collector.metrics.automationActions.length).toBe(0);
    });
  });
});
