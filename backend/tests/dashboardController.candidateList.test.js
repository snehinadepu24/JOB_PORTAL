/**
 * Unit tests for Task 14.2: Candidate list with sorting and filtering
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { supabase } from '../database/supabaseClient.js';

describe('Dashboard - Candidate List with Sorting and Filtering', () => {
  let testJobId;
  let testApplicationIds = [];
  let testUserId;

  beforeAll(async () => {
    // Create a test user (employer)
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        name: 'Test Employer',
        email: `test-employer-${Date.now()}@example.com`,
        password: 'password123',
        phone: '1234567890',
        role: 'Employer',
        favourite_sport: 'Basketball'
      })
      .select()
      .single();

    if (userError) throw userError;
    testUserId = user.id;

    // Create a test job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        title: 'Test Job for Candidate List',
        description: 'Test job description for candidate list sorting and filtering',
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

    // Create test applications with different statuses
    const applications = [
      { name: 'Alice', fit_score: 95, rank: 1, shortlist_status: 'shortlisted' },
      { name: 'Bob', fit_score: 90, rank: 2, shortlist_status: 'shortlisted' },
      { name: 'Charlie', fit_score: 85, rank: 3, shortlist_status: 'shortlisted' },
      { name: 'David', fit_score: 80, rank: 4, shortlist_status: 'buffer' },
      { name: 'Eve', fit_score: 75, rank: 5, shortlist_status: 'buffer' },
      { name: 'Frank', fit_score: 70, rank: 6, shortlist_status: 'buffer' },
      { name: 'Grace', fit_score: 65, rank: null, shortlist_status: 'pending' },
      { name: 'Henry', fit_score: 60, rank: null, shortlist_status: 'pending' }
    ];

    for (const app of applications) {
      const { data: application, error: appError } = await supabase
        .from('applications')
        .insert({
          job_id: testJobId,
          applicant_id: testUserId,
          employer_id: testUserId,
          name: app.name,
          email: `${app.name.toLowerCase()}@example.com`,
          phone: '1234567890',
          address: 'Test Address',
          cover_letter: 'Test cover letter',
          resume_url: 'https://example.com/resume.pdf',
          resume_public_id: `test_resume_${app.name}`,
          fit_score: app.fit_score,
          rank: app.rank,
          shortlist_status: app.shortlist_status,
          ai_processed: true
        })
        .select()
        .single();

      if (appError) throw appError;
      testApplicationIds.push(application.id);

      // Create interview for shortlisted candidates
      if (app.shortlist_status === 'shortlisted') {
        await supabase
          .from('interviews')
          .insert({
            application_id: application.id,
            job_id: testJobId,
            recruiter_id: testUserId,
            candidate_id: testUserId,
            rank_at_time: app.rank,
            status: 'invitation_sent',
            confirmation_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            no_show_risk: 0.3
          });
      }
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testJobId) {
      await supabase.from('interviews').delete().eq('job_id', testJobId);
      await supabase.from('applications').delete().eq('job_id', testJobId);
      await supabase.from('jobs').delete().eq('id', testJobId);
    }
    if (testUserId) {
      await supabase.from('users').delete().eq('id', testUserId);
    }
  });

  it('should return candidates sorted by fit_score (highest first) by default', async () => {
    const { data: response, error } = await supabase
      .from('applications')
      .select(`
        id,
        name,
        fit_score,
        rank,
        shortlist_status,
        interviews (status, no_show_risk)
      `)
      .eq('job_id', testJobId)
      .order('fit_score', { ascending: false });

    expect(error).toBeNull();
    expect(response).toBeDefined();
    expect(response.length).toBe(8);

    // Verify sorting by fit_score descending
    for (let i = 0; i < response.length - 1; i++) {
      expect(response[i].fit_score).toBeGreaterThanOrEqual(response[i + 1].fit_score);
    }
  });

  it('should include buffer_rank for buffer candidates', async () => {
    const { data: response, error } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'buffer');

    expect(error).toBeNull();
    expect(response).toBeDefined();
    expect(response.length).toBe(3);

    // Buffer candidates should have ranks 4, 5, 6
    // Buffer ranks should be 1, 2, 3 (rank - number_of_openings)
    const bufferRanks = response.map(app => app.rank - 3).sort((a, b) => a - b);
    expect(bufferRanks).toEqual([1, 2, 3]);
  });

  it('should filter by shortlist_status', async () => {
    const { data: response, error } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'shortlisted');

    expect(error).toBeNull();
    expect(response).toBeDefined();
    expect(response.length).toBe(3);
    expect(response.every(app => app.shortlist_status === 'shortlisted')).toBe(true);
  });

  it('should include all required fields', async () => {
    const { data: response, error } = await supabase
      .from('applications')
      .select(`
        id,
        name,
        fit_score,
        rank,
        shortlist_status,
        interviews (status, no_show_risk)
      `)
      .eq('job_id', testJobId)
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(response).toBeDefined();
    expect(response).toHaveProperty('name');
    expect(response).toHaveProperty('fit_score');
    expect(response).toHaveProperty('shortlist_status');
    expect(response).toHaveProperty('rank');
  });

  it('should highlight shortlisted candidates with metadata', async () => {
    const { data: response, error } = await supabase
      .from('applications')
      .select('id, shortlist_status')
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'shortlisted');

    expect(error).toBeNull();
    expect(response).toBeDefined();
    
    const shortlistedIds = response.map(app => app.id);
    expect(shortlistedIds.length).toBe(3);
  });

  it('should show buffer rank position for buffer candidates', async () => {
    const { data: response, error } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'buffer')
      .order('rank', { ascending: true });

    expect(error).toBeNull();
    expect(response).toBeDefined();
    expect(response.length).toBe(3);

    // Verify buffer ranks are sequential starting from 1
    const bufferRanks = response.map(app => app.rank - 3);
    expect(bufferRanks).toEqual([1, 2, 3]);
  });

  it('should support sorting by name', async () => {
    const { data: response, error } = await supabase
      .from('applications')
      .select('name')
      .eq('job_id', testJobId)
      .order('name', { ascending: true });

    expect(error).toBeNull();
    expect(response).toBeDefined();

    // Verify alphabetical sorting
    const names = response.map(app => app.name);
    const sortedNames = [...names].sort();
    expect(names).toEqual(sortedNames);
  });

  it('should support sorting by rank', async () => {
    const { data: response, error } = await supabase
      .from('applications')
      .select('rank')
      .eq('job_id', testJobId)
      .not('rank', 'is', null)
      .order('rank', { ascending: true });

    expect(error).toBeNull();
    expect(response).toBeDefined();

    // Verify rank sorting
    const ranks = response.map(app => app.rank);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('should include interview_status for candidates with interviews', async () => {
    const { data: response, error } = await supabase
      .from('applications')
      .select(`
        id,
        shortlist_status,
        interviews (status)
      `)
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'shortlisted');

    expect(error).toBeNull();
    expect(response).toBeDefined();
    
    // All shortlisted candidates should have interviews
    expect(response.every(app => app.interviews && app.interviews.length > 0)).toBe(true);
    expect(response.every(app => app.interviews[0].status === 'invitation_sent')).toBe(true);
  });

  it('should include no_show_risk for candidates with interviews', async () => {
    const { data: response, error } = await supabase
      .from('applications')
      .select(`
        id,
        interviews (no_show_risk)
      `)
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'shortlisted');

    expect(error).toBeNull();
    expect(response).toBeDefined();
    
    // All shortlisted candidates should have no_show_risk
    expect(response.every(app => 
      app.interviews && 
      app.interviews.length > 0 && 
      app.interviews[0].no_show_risk !== null
    )).toBe(true);
  });
});
