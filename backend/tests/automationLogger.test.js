/**
 * Unit tests for AutomationLogger
 * 
 * Tests comprehensive logging functionality including:
 * - Log creation with trigger_source and actor_id
 * - Log querying utilities (pagination, filtering, stats)
 * - Time range queries
 * - Interview and candidate log retrieval
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabase } from '../database/supabaseClient.js';
import { automationLogger } from '../utils/automationLogger.js';
import { v4 as uuidv4 } from 'uuid';

describe('AutomationLogger', () => {
  let testJobId;
  let testUserId;
  let testInterviewId;
  let testCandidateId;

  beforeAll(async () => {
    // Create test user
    testUserId = uuidv4();
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        name: 'Test User',
        email: `test-${testUserId}@example.com`,
        password: 'test123',
        role: 'employer'
      });

    if (userError) {
      console.error('Error creating test user:', userError);
    }

    // Create test job
    testJobId = uuidv4();
    const { error: jobError } = await supabase
      .from('jobs')
      .insert({
        id: testJobId,
        title: 'Test Job for Logging',
        description: 'Test job description',
        posted_by: testUserId,
        number_of_openings: 3,
        shortlisting_buffer: 3,
        applications_closed: false,
        expired: false
      });

    if (jobError) {
      console.error('Error creating test job:', jobError);
    }

    testInterviewId = uuidv4();
    testCandidateId = uuidv4();

    // Clean up any existing test logs
    await supabase
      .from('automation_logs')
      .delete()
      .eq('job_id', testJobId);
  });

  afterAll(async () => {
    // Clean up test logs
    await supabase
      .from('automation_logs')
      .delete()
      .eq('job_id', testJobId);

    // Clean up test job
    await supabase
      .from('jobs')
      .delete()
      .eq('id', testJobId);

    // Clean up test user
    await supabase
      .from('users')
      .delete()
      .eq('id', testUserId);
  });

  describe('log()', () => {
    it('should create a log entry with all required fields', async () => {
      await automationLogger.log({
        jobId: testJobId,
        actionType: 'test_action',
        triggerSource: 'auto',
        actorId: null,
        details: {
          test_field: 'test_value',
          count: 42
        }
      });

      // Verify log was created
      const { data: logs } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_id', testJobId)
        .eq('action_type', 'test_action')
        .single();

      expect(logs).toBeDefined();
      expect(logs.job_id).toBe(testJobId);
      expect(logs.action_type).toBe('test_action');
      expect(logs.trigger_source).toBe('auto');
      expect(logs.actor_id).toBeNull();
      expect(logs.details.test_field).toBe('test_value');
      expect(logs.details.count).toBe(42);
      expect(logs.details.timestamp).toBeDefined();
    });

    it('should support manual trigger_source with actor_id', async () => {
      await automationLogger.log({
        jobId: testJobId,
        actionType: 'manual_action',
        triggerSource: 'manual',
        actorId: testUserId,
        details: {
          reason: 'recruiter_override'
        }
      });

      const { data: logs } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_id', testJobId)
        .eq('action_type', 'manual_action')
        .single();

      expect(logs).toBeDefined();
      expect(logs.trigger_source).toBe('manual');
      expect(logs.actor_id).toBe(testUserId);
      expect(logs.details.reason).toBe('recruiter_override');
    });

    it('should support scheduled trigger_source', async () => {
      await automationLogger.log({
        jobId: testJobId,
        actionType: 'scheduled_action',
        triggerSource: 'scheduled',
        actorId: null,
        details: {
          task: 'deadline_check'
        }
      });

      const { data: logs } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_id', testJobId)
        .eq('action_type', 'scheduled_action')
        .single();

      expect(logs).toBeDefined();
      expect(logs.trigger_source).toBe('scheduled');
      expect(logs.details.task).toBe('deadline_check');
    });

    it('should handle null jobId for system-wide actions', async () => {
      await automationLogger.log({
        jobId: null,
        actionType: 'system_action',
        triggerSource: 'auto',
        actorId: null,
        details: {
          system_event: 'startup'
        }
      });

      const { data: logs } = await supabase
        .from('automation_logs')
        .select('*')
        .is('job_id', null)
        .eq('action_type', 'system_action')
        .single();

      expect(logs).toBeDefined();
      expect(logs.job_id).toBeNull();
      expect(logs.details.system_event).toBe('startup');
    });
  });

  describe('getAutomationLogs()', () => {
    beforeAll(async () => {
      // Create multiple test logs
      for (let i = 0; i < 15; i++) {
        await automationLogger.log({
          jobId: testJobId,
          actionType: `action_${i}`,
          triggerSource: 'auto',
          actorId: null,
          details: { index: i }
        });
      }
    });

    it('should retrieve logs with pagination', async () => {
      const result = await automationLogger.getAutomationLogs(testJobId, 10, 0);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeLessThanOrEqual(10);
      expect(result.pagination.total).toBeGreaterThanOrEqual(15);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.offset).toBe(0);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should support pagination offset', async () => {
      const result = await automationLogger.getAutomationLogs(testJobId, 10, 10);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.pagination.offset).toBe(10);
    });

    it('should return logs in descending order by created_at', async () => {
      const result = await automationLogger.getAutomationLogs(testJobId, 5, 0);

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);

      // Verify descending order
      for (let i = 1; i < result.data.length; i++) {
        const prev = new Date(result.data[i - 1].created_at);
        const curr = new Date(result.data[i].created_at);
        expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
      }
    });
  });

  describe('getAutomationLogsByType()', () => {
    beforeAll(async () => {
      // Create logs of specific types
      await automationLogger.log({
        jobId: testJobId,
        actionType: 'buffer_promotion',
        triggerSource: 'auto',
        actorId: null,
        details: { promoted: true }
      });

      await automationLogger.log({
        jobId: testJobId,
        actionType: 'buffer_promotion',
        triggerSource: 'auto',
        actorId: null,
        details: { promoted: true }
      });

      await automationLogger.log({
        jobId: testJobId,
        actionType: 'invitation_sent',
        triggerSource: 'auto',
        actorId: null,
        details: { sent: true }
      });
    });

    it('should filter logs by action type', async () => {
      const result = await automationLogger.getAutomationLogsByType(
        testJobId,
        'buffer_promotion',
        50
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.count).toBeGreaterThanOrEqual(2);

      // Verify all logs are of the correct type
      result.data.forEach(log => {
        expect(log.action_type).toBe('buffer_promotion');
      });
    });

    it('should return empty array for non-existent action type', async () => {
      const result = await automationLogger.getAutomationLogsByType(
        testJobId,
        'non_existent_action',
        50
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
    });
  });

  describe('getAutomationLogStats()', () => {
    beforeAll(async () => {
      // Create a separate job for stats test
      const statsJobId = uuidv4();
      const { error: jobError } = await supabase
        .from('jobs')
        .insert({
          id: statsJobId,
          title: 'Stats Test Job',
          description: 'Test job for stats',
          posted_by: testUserId,
          number_of_openings: 2,
          shortlisting_buffer: 2,
          applications_closed: false,
          expired: false
        });

      if (jobError) {
        console.error('Error creating stats test job:', jobError);
      }

      // Create logs with different action types and trigger sources
      await automationLogger.log({
        jobId: statsJobId,
        actionType: 'invitation_sent',
        triggerSource: 'auto',
        actorId: null,
        details: {}
      });

      await automationLogger.log({
        jobId: statsJobId,
        actionType: 'invitation_sent',
        triggerSource: 'auto',
        actorId: null,
        details: {}
      });

      await automationLogger.log({
        jobId: statsJobId,
        actionType: 'buffer_promotion',
        triggerSource: 'scheduled',
        actorId: null,
        details: {}
      });

      await automationLogger.log({
        jobId: statsJobId,
        actionType: 'manual_override',
        triggerSource: 'manual',
        actorId: testUserId,
        details: {}
      });

      // Get stats
      const result = await automationLogger.getAutomationLogStats(statsJobId);

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(4);
      expect(result.data.by_action_type.invitation_sent).toBe(2);
      expect(result.data.by_action_type.buffer_promotion).toBe(1);
      expect(result.data.by_action_type.manual_override).toBe(1);
      expect(result.data.by_trigger_source.auto).toBe(2);
      expect(result.data.by_trigger_source.scheduled).toBe(1);
      expect(result.data.by_trigger_source.manual).toBe(1);

      // Clean up
      await supabase
        .from('automation_logs')
        .delete()
        .eq('job_id', statsJobId);

      await supabase
        .from('jobs')
        .delete()
        .eq('id', statsJobId);
    });

    it('should calculate statistics correctly', () => {
      // Test is in beforeAll to ensure cleanup
      expect(true).toBe(true);
    });
  });

  describe('getLogsForInterview()', () => {
    beforeAll(async () => {
      // Create logs with interview_id in details
      await automationLogger.log({
        jobId: testJobId,
        actionType: 'invitation_sent',
        triggerSource: 'auto',
        actorId: null,
        details: {
          interview_id: testInterviewId,
          candidate_id: testCandidateId
        }
      });

      await automationLogger.log({
        jobId: testJobId,
        actionType: 'invitation_accepted',
        triggerSource: 'auto',
        actorId: testCandidateId,
        details: {
          interview_id: testInterviewId,
          candidate_id: testCandidateId
        }
      });
    });

    it('should retrieve logs for a specific interview', async () => {
      const result = await automationLogger.getLogsForInterview(testInterviewId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.count).toBeGreaterThanOrEqual(2);

      // Verify all logs contain the interview_id
      result.data.forEach(log => {
        expect(log.details.interview_id).toBe(testInterviewId);
      });
    });
  });

  describe('getLogsForCandidate()', () => {
    it('should retrieve logs for a specific candidate', async () => {
      const result = await automationLogger.getLogsForCandidate(testCandidateId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.count).toBeGreaterThanOrEqual(2);

      // Verify all logs contain the candidate_id
      result.data.forEach(log => {
        expect(log.details.candidate_id).toBe(testCandidateId);
      });
    });
  });

  describe('getLogsByTimeRange()', () => {
    it('should retrieve logs within a time range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const result = await automationLogger.getLogsByTimeRange(
        testJobId,
        oneHourAgo,
        oneHourFromNow
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Verify all logs are within the time range
      result.data.forEach(log => {
        const logTime = new Date(log.created_at);
        expect(logTime.getTime()).toBeGreaterThanOrEqual(oneHourAgo.getTime());
        expect(logTime.getTime()).toBeLessThanOrEqual(oneHourFromNow.getTime());
      });
    });

    it('should support null jobId for all jobs', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      const result = await automationLogger.getLogsByTimeRange(
        null,
        oneHourAgo,
        oneHourFromNow
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe('getRecentAutomationLogs()', () => {
    it('should retrieve recent logs across all jobs', async () => {
      const result = await automationLogger.getRecentAutomationLogs(10);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeLessThanOrEqual(10);

      // Verify descending order
      for (let i = 1; i < result.data.length; i++) {
        const prev = new Date(result.data[i - 1].created_at);
        const curr = new Date(result.data[i].created_at);
        expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
      }
    });
  });
});
