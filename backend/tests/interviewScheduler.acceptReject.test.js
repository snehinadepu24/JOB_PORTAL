/**
 * Unit tests for InterviewScheduler accept/reject handlers
 * 
 * Tests task 5.3: Implement accept/reject handlers
 * Requirements: 3.5, 3.6
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { supabase } from '../database/supabaseClient.js';
import { interviewScheduler } from '../managers/InterviewScheduler.js';
import { interviewModel } from '../models/interviewSchema.js';
import { shortlistingManager } from '../managers/ShortlistingManager.js';

describe('InterviewScheduler - Accept/Reject Handlers', () => {
  let testJob;
  let testUser;
  let testCandidate;
  let testApplication;
  let testInterview;
  let acceptToken;
  let rejectToken;

  beforeEach(async () => {
    // Create test user (recruiter)
    const { data: user } = await supabase
      .from('users')
      .insert([{
        name: 'Test Recruiter',
        email: `recruiter-${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'employer'
      }])
      .select()
      .single();
    testUser = user;

    // Create test candidate
    const { data: candidate } = await supabase
      .from('users')
      .insert([{
        name: 'Test Candidate',
        email: `candidate-${Date.now()}@test.com`,
        password: 'hashedpassword',
        role: 'applicant'
      }])
      .select()
      .single();
    testCandidate = candidate;

    // Create test job
    const { data: job } = await supabase
      .from('jobs')
      .insert([{
        title: 'Test Job',
        description: 'Test job description',
        posted_by: testUser.id,
        number_of_openings: 3,
        shortlisting_buffer: 3,
        applications_closed: true
      }])
      .select()
      .single();
    testJob = job;

    // Create test application
    const { data: application } = await supabase
      .from('applications')
      .insert([{
        job_id: testJob.id,
        applicant_id: testCandidate.id,
        name: testCandidate.name,
        email: testCandidate.email,
        resume_url: 'https://example.com/resume.pdf',
        fit_score: 85,
        rank: 1,
        shortlist_status: 'shortlisted',
        ai_processed: true
      }])
      .select()
      .single();
    testApplication = application;

    // Create test interview
    const confirmationDeadline = new Date();
    confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);

    const interviewResult = await interviewModel.create({
      application_id: testApplication.id,
      job_id: testJob.id,
      recruiter_id: testUser.id,
      candidate_id: testCandidate.id,
      rank_at_time: 1,
      status: 'invitation_sent',
      confirmation_deadline: confirmationDeadline,
      no_show_risk: 0.5
    });
    testInterview = interviewResult.data;

    // Generate tokens
    acceptToken = interviewScheduler.generateToken(testInterview.id, 'accept');
    rejectToken = interviewScheduler.generateToken(testInterview.id, 'reject');
  });

  afterEach(async () => {
    // Clean up in reverse order of dependencies
    if (testInterview) {
      await supabase.from('interviews').delete().eq('id', testInterview.id);
    }
    if (testApplication) {
      await supabase.from('applications').delete().eq('id', testApplication.id);
    }
    if (testJob) {
      await supabase.from('jobs').delete().eq('id', testJob.id);
    }
    if (testCandidate) {
      await supabase.from('users').delete().eq('id', testCandidate.id);
    }
    if (testUser) {
      await supabase.from('users').delete().eq('id', testUser.id);
    }
  });

  describe('handleAccept', () => {
    it('should accept invitation with valid token', async () => {
      const result = await interviewScheduler.handleAccept(testInterview.id, acceptToken);

      expect(result.success).toBe(true);
      expect(result.message).toContain('accepted');
      expect(result.data.interview.status).toBe('slot_pending');
      expect(result.data.interview.slot_selection_deadline).toBeDefined();
      expect(result.data.redirect).toContain('/interview/select-slot/');
    });

    it('should set slot_selection_deadline to 24 hours from now', async () => {
      const beforeAccept = new Date();
      const result = await interviewScheduler.handleAccept(testInterview.id, acceptToken);
      const afterAccept = new Date();

      const deadline = new Date(result.data.interview.slot_selection_deadline);
      const expectedMin = new Date(beforeAccept);
      expectedMin.setHours(expectedMin.getHours() + 24);
      const expectedMax = new Date(afterAccept);
      expectedMax.setHours(expectedMax.getHours() + 24);

      expect(deadline.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime() - 1000);
      expect(deadline.getTime()).toBeLessThanOrEqual(expectedMax.getTime() + 1000);
    });

    it('should reject invalid token', async () => {
      const result = await interviewScheduler.handleAccept(testInterview.id, 'invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired token');
    });

    it('should reject wrong action token (reject token for accept)', async () => {
      const result = await interviewScheduler.handleAccept(testInterview.id, rejectToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired token');
    });

    it('should reject if interview already accepted', async () => {
      // Accept once
      await interviewScheduler.handleAccept(testInterview.id, acceptToken);

      // Try to accept again with new token
      const newToken = interviewScheduler.generateToken(testInterview.id, 'accept');
      const result = await interviewScheduler.handleAccept(testInterview.id, newToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid interview state');
      expect(result.message).toContain('already slot_pending');
    });

    it('should log automation action', async () => {
      await interviewScheduler.handleAccept(testInterview.id, acceptToken);

      // Check automation log
      const { data: logs } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_id', testJob.id)
        .eq('action_type', 'invitation_accepted')
        .order('created_at', { ascending: false })
        .limit(1);

      expect(logs).toBeDefined();
      expect(logs.length).toBe(1);
      expect(logs[0].details.interview_id).toBe(testInterview.id);
      expect(logs[0].details.new_status).toBe('slot_pending');
    });
  });

  describe('handleReject', () => {
    it('should reject invitation with valid token', async () => {
      const result = await interviewScheduler.handleReject(testInterview.id, rejectToken);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Thank you');
      expect(result.data.interview.status).toBe('cancelled');
    });

    it('should update application shortlist_status to rejected', async () => {
      await interviewScheduler.handleReject(testInterview.id, rejectToken);

      const { data: application } = await supabase
        .from('applications')
        .select('shortlist_status')
        .eq('id', testApplication.id)
        .single();

      expect(application.shortlist_status).toBe('rejected');
    });

    it('should trigger buffer promotion', async () => {
      // Create a buffer candidate
      const { data: bufferCandidate } = await supabase
        .from('users')
        .insert([{
          name: 'Buffer Candidate',
          email: `buffer-${Date.now()}@test.com`,
          password: 'hashedpassword',
          role: 'applicant'
        }])
        .select()
        .single();

      const { data: bufferApp } = await supabase
        .from('applications')
        .insert([{
          job_id: testJob.id,
          applicant_id: bufferCandidate.id,
          name: bufferCandidate.name,
          email: bufferCandidate.email,
          resume_url: 'https://example.com/resume2.pdf',
          fit_score: 80,
          rank: 4,
          shortlist_status: 'buffer',
          ai_processed: true
        }])
        .select()
        .single();

      const result = await interviewScheduler.handleReject(testInterview.id, rejectToken);

      expect(result.success).toBe(true);
      expect(result.data.promotion).toBeDefined();

      // Check if buffer candidate was promoted
      const { data: promotedApp } = await supabase
        .from('applications')
        .select('shortlist_status, rank')
        .eq('id', bufferApp.id)
        .single();

      expect(promotedApp.shortlist_status).toBe('shortlisted');
      expect(promotedApp.rank).toBe(1); // Should take the vacated rank

      // Clean up
      await supabase.from('applications').delete().eq('id', bufferApp.id);
      await supabase.from('users').delete().eq('id', bufferCandidate.id);
    });

    it('should reject invalid token', async () => {
      const result = await interviewScheduler.handleReject(testInterview.id, 'invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired token');
    });

    it('should reject wrong action token (accept token for reject)', async () => {
      const result = await interviewScheduler.handleReject(testInterview.id, acceptToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired token');
    });

    it('should reject if interview already rejected', async () => {
      // Reject once
      await interviewScheduler.handleReject(testInterview.id, rejectToken);

      // Try to reject again with new token
      const newToken = interviewScheduler.generateToken(testInterview.id, 'reject');
      const result = await interviewScheduler.handleReject(testInterview.id, newToken);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid interview state');
      expect(result.message).toContain('already cancelled');
    });

    it('should log automation action', async () => {
      await interviewScheduler.handleReject(testInterview.id, rejectToken);

      // Check automation log
      const { data: logs } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_id', testJob.id)
        .eq('action_type', 'invitation_rejected')
        .order('created_at', { ascending: false })
        .limit(1);

      expect(logs).toBeDefined();
      expect(logs.length).toBe(1);
      expect(logs[0].details.interview_id).toBe(testInterview.id);
      expect(logs[0].details.new_status).toBe('cancelled');
      expect(logs[0].details.vacated_rank).toBe(1);
    });

    it('should handle rejection when no buffer candidates available', async () => {
      const result = await interviewScheduler.handleReject(testInterview.id, rejectToken);

      expect(result.success).toBe(true);
      expect(result.data.promotion.success).toBe(false);
      expect(result.data.promotion.reason).toContain('buffer');
    });
  });
});
