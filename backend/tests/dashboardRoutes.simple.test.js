/**
 * Simple tests for Dashboard API endpoints
 * Task 14.1: Create dashboard API endpoints
 * Requirements: 9.1, 9.2, 9.5, 9.7
 */

import { jest } from '@jest/globals';
import { supabase } from '../database/supabaseClient.js';
import {
  getRankedCandidates,
  getActivityLog,
  getAnalytics
} from '../controllers/dashboardController.js';

describe('Dashboard API Endpoints - Simple Tests', () => {
  let testJobId;
  let testApplicationId;
  let testUserId;
  let testInterviewId;

  beforeAll(async () => {
    // Create test user
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        name: 'Test Recruiter',
        email: `test-recruiter-${Date.now()}@example.com`,
        password: 'hashedpassword',
        phone: '1234567890',
        favourite_sport: 'Basketball',
        role: 'Employer'
      })
      .select()
      .single();

    if (userError) throw userError;
    testUserId = user.id;

    // Create test job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        title: 'Test Job for Dashboard',
        description: 'Test job description for dashboard endpoints testing with sufficient length',
        category: 'Software Development',
        country: 'USA',
        city: 'San Francisco',
        location: 'Remote',
        fixed_salary: 100000,
        posted_by: testUserId,
        number_of_openings: 3,
        shortlisting_buffer: 3,
        applications_closed: true
      })
      .select()
      .single();

    if (jobError) throw jobError;
    testJobId = job.id;

    // Create test application
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        job_id: testJobId,
        applicant_id: testUserId,
        employer_id: testUserId,
        name: 'Test Candidate',
        email: `test-candidate-${Date.now()}@example.com`,
        phone: '9876543210',
        address: '123 Test Street, Test City',
        cover_letter: 'This is a test cover letter for the dashboard endpoint testing',
        resume_url: 'https://example.com/resume.pdf',
        resume_public_id: 'test_resume_123',
        fit_score: 85.5,
        rank: 1,
        shortlist_status: 'shortlisted',
        ai_processed: true,
        summary: 'Excellent candidate with strong skills'
      })
      .select()
      .single();

    if (appError) throw appError;
    testApplicationId = application.id;

    // Create test interview
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .insert({
        application_id: testApplicationId,
        job_id: testJobId,
        recruiter_id: testUserId,
        candidate_id: testUserId,
        rank_at_time: 1,
        status: 'confirmed',
        no_show_risk: 0.25,
        scheduled_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        confirmation_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (interviewError) throw interviewError;
    testInterviewId = interview.id;

    // Create test automation log
    await supabase
      .from('automation_logs')
      .insert({
        job_id: testJobId,
        action_type: 'invitation_sent',
        trigger_source: 'auto',
        details: {
          candidate_id: testUserId,
          interview_id: testInterviewId
        }
      });
  });

  afterAll(async () => {
    // Clean up test data
    if (testInterviewId) {
      await supabase.from('interviews').delete().eq('id', testInterviewId);
    }
    if (testApplicationId) {
      await supabase.from('applications').delete().eq('id', testApplicationId);
    }
    if (testJobId) {
      await supabase.from('automation_logs').delete().eq('job_id', testJobId);
      await supabase.from('jobs').delete().eq('id', testJobId);
    }
    if (testUserId) {
      await supabase.from('users').delete().eq('id', testUserId);
    }
  });

  describe('GET /api/v1/dashboard/candidates/:jobId', () => {
    test('should return ranked candidates for a job', async () => {
      const req = {
        params: { jobId: testJobId }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await getRankedCandidates(req, res, next);

      // Check if next was called with an error
      if (next.mock.calls.length > 0) {
        console.error('Error in getRankedCandidates:', next.mock.calls[0][0]);
      }

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();

      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.candidates).toBeDefined();
      expect(Array.isArray(response.candidates)).toBe(true);
      expect(response.candidates.length).toBeGreaterThan(0);

      // Verify candidate structure
      const candidate = response.candidates[0];
      expect(candidate).toHaveProperty('name');
      expect(candidate).toHaveProperty('fit_score');
      expect(candidate).toHaveProperty('shortlist_status');
      expect(candidate).toHaveProperty('interview_status');
      expect(candidate).toHaveProperty('no_show_risk');
    });

    test('should return error for missing job ID', async () => {
      const req = {
        params: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await getRankedCandidates(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toContain('Job ID is required');
    });

    test('should sort candidates by fit_score descending', async () => {
      // Create additional applications with different scores
      const { data: app2 } = await supabase
        .from('applications')
        .insert({
          job_id: testJobId,
          applicant_id: testUserId,
          employer_id: testUserId,
          name: 'Test Candidate 2',
          email: `test-candidate-2-${Date.now()}@example.com`,
          phone: '9876543211',
          address: '456 Test Avenue, Test City',
          cover_letter: 'This is another test cover letter',
          resume_url: 'https://example.com/resume2.pdf',
          resume_public_id: 'test_resume_456',
          fit_score: 75.0,
          rank: 2,
          shortlist_status: 'buffer',
          ai_processed: true
        })
        .select()
        .single();

      const req = {
        params: { jobId: testJobId }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await getRankedCandidates(req, res, next);

      const response = res.json.mock.calls[0][0];
      const candidates = response.candidates;

      // Verify sorting (highest fit_score first)
      for (let i = 0; i < candidates.length - 1; i++) {
        expect(candidates[i].fit_score).toBeGreaterThanOrEqual(candidates[i + 1].fit_score);
      }

      // Clean up
      if (app2) {
        await supabase.from('applications').delete().eq('id', app2.id);
      }
    });
  });

  describe('GET /api/v1/dashboard/activity-log/:jobId', () => {
    test('should return automation activity log for a job', async () => {
      const req = {
        params: { jobId: testJobId },
        query: { limit: 50, offset: 0 }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await getActivityLog(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();

      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.logs).toBeDefined();
      expect(Array.isArray(response.logs)).toBe(true);
      expect(response.logs.length).toBeGreaterThan(0);

      // Verify log structure
      const log = response.logs[0];
      expect(log).toHaveProperty('action_type');
      expect(log).toHaveProperty('trigger_source');
      expect(log).toHaveProperty('timestamp');
      expect(log).toHaveProperty('outcome');
    });

    test('should return error for missing job ID', async () => {
      const req = {
        params: {},
        query: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await getActivityLog(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toContain('Job ID is required');
    });

    test('should support pagination', async () => {
      const req = {
        params: { jobId: testJobId },
        query: { limit: 10, offset: 0 }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await getActivityLog(req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.pagination).toBeDefined();
      expect(response.pagination.limit).toBe(10);
      expect(response.pagination.offset).toBe(0);
      expect(response.pagination.total).toBeDefined();
    });
  });

  describe('GET /api/v1/dashboard/analytics/:jobId', () => {
    test('should return analytics metrics for a job', async () => {
      const req = {
        params: { jobId: testJobId }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await getAnalytics(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();

      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.analytics).toBeDefined();

      // Verify analytics structure
      const analytics = response.analytics;
      expect(analytics).toHaveProperty('time_saved_hours');
      expect(analytics).toHaveProperty('automation_success_rate');
      expect(analytics).toHaveProperty('average_time_to_interview_days');
      expect(analytics).toHaveProperty('buffer_health');

      // Verify buffer health structure
      expect(analytics.buffer_health).toHaveProperty('status');
      expect(analytics.buffer_health).toHaveProperty('current_size');
      expect(analytics.buffer_health).toHaveProperty('target_size');
      expect(analytics.buffer_health).toHaveProperty('percentage');

      // Verify candidate breakdown
      expect(analytics).toHaveProperty('candidate_breakdown');
      expect(analytics.candidate_breakdown).toHaveProperty('total');
      expect(analytics.candidate_breakdown).toHaveProperty('shortlisted');
      expect(analytics.candidate_breakdown).toHaveProperty('buffer');
      expect(analytics.candidate_breakdown).toHaveProperty('pending');
      expect(analytics.candidate_breakdown).toHaveProperty('rejected');

      // Verify interview breakdown
      expect(analytics).toHaveProperty('interview_breakdown');
      expect(analytics.interview_breakdown).toHaveProperty('total');
      expect(analytics.interview_breakdown).toHaveProperty('confirmed');
      expect(analytics.interview_breakdown).toHaveProperty('completed');
    });

    test('should return error for missing job ID', async () => {
      const req = {
        params: {}
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await getAnalytics(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toContain('Job ID is required');
    });

    test('should calculate buffer health correctly', async () => {
      const req = {
        params: { jobId: testJobId }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await getAnalytics(req, res, next);

      const response = res.json.mock.calls[0][0];
      const bufferHealth = response.analytics.buffer_health;

      expect(bufferHealth.status).toMatch(/^(full|partial|low|empty)$/);
      expect(bufferHealth.current_size).toBeGreaterThanOrEqual(0);
      expect(bufferHealth.target_size).toBeGreaterThan(0);
      expect(bufferHealth.percentage).toBeGreaterThanOrEqual(0);
      expect(bufferHealth.percentage).toBeLessThanOrEqual(100);
    });

    test('should calculate time saved correctly', async () => {
      const req = {
        params: { jobId: testJobId }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await getAnalytics(req, res, next);

      const response = res.json.mock.calls[0][0];
      const timeSaved = response.analytics.time_saved_hours;

      expect(typeof timeSaved).toBe('number');
      expect(timeSaved).toBeGreaterThanOrEqual(0);
    });

    test('should calculate automation success rate correctly', async () => {
      const req = {
        params: { jobId: testJobId }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      await getAnalytics(req, res, next);

      const response = res.json.mock.calls[0][0];
      const successRate = response.analytics.automation_success_rate;

      expect(typeof successRate).toBe('number');
      expect(successRate).toBeGreaterThanOrEqual(0);
      expect(successRate).toBeLessThanOrEqual(100);
    });
  });
});
