import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { config } from 'dotenv';

// Load environment variables
config({ path: './config/config.env' });

import { supabase } from '../database/supabaseClient.js';
import { shortlistingManager } from '../managers/ShortlistingManager.js';

/**
 * Unit tests for ShortlistingManager
 * 
 * Tests core functionality:
 * - autoShortlist
 * - promoteFromBuffer
 * - backfillBuffer
 * - canPromote
 * - getShortlistStatus
 */

describe('ShortlistingManager', () => {
  let testJobId;
  let testApplicationIds = [];
  let testUserId;

  before(async () => {
    // Create a test user (employer)
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([
        {
          name: 'Test Employer',
          email: `test-employer-${Date.now()}@example.com`,
          phone: 1234567890,
          password: 'hashedpassword',
          role: 'Employer'
        }
      ])
      .select()
      .single();

    if (userError) {
      console.error('Error creating test user:', userError);
      throw userError;
    }

    testUserId = user.id;

    // Create a test job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert([
        {
          title: 'Test Job for Shortlisting',
          description: 'Test job description',
          category: 'IT',
          country: 'USA',
          city: 'New York',
          location: 'New York, USA',
          fixed_salary: 100000,
          posted_by: testUserId,
          number_of_openings: 3,
          shortlisting_buffer: 3,
          applications_closed: true
        }
      ])
      .select()
      .single();

    if (jobError) {
      console.error('Error creating test job:', jobError);
      throw jobError;
    }

    testJobId = job.id;

    // Create test applications with different fit scores
    const applications = [];
    for (let i = 0; i < 10; i++) {
      applications.push({
        name: `Test Candidate ${i + 1}`,
        email: `candidate${i + 1}-${Date.now()}@example.com`,
        cover_letter: 'Test cover letter',
        phone: 1234567890 + i,
        address: 'Test Address',
        applicant_id: testUserId,
        applicant_role: 'Job Seeker',
        employer_id: testUserId,
        employer_role: 'Employer',
        resume_url: 'https://example.com/resume.pdf',
        resume_public_id: `test_resume_${i}`,
        job_id: testJobId,
        fit_score: 90 - (i * 5), // Scores: 90, 85, 80, 75, 70, 65, 60, 55, 50, 45
        ai_processed: true,
        shortlist_status: 'pending'
      });
    }

    const { data: createdApps, error: appsError } = await supabase
      .from('applications')
      .insert(applications)
      .select();

    if (appsError) {
      console.error('Error creating test applications:', appsError);
      throw appsError;
    }

    testApplicationIds = createdApps.map(app => app.id);
  });

  after(async () => {
    // Clean up test data
    if (testApplicationIds.length > 0) {
      await supabase
        .from('applications')
        .delete()
        .in('id', testApplicationIds);
    }

    if (testJobId) {
      await supabase
        .from('jobs')
        .delete()
        .eq('id', testJobId);
    }

    if (testUserId) {
      await supabase
        .from('users')
        .delete()
        .eq('id', testUserId);
    }
  });

  it('should auto-shortlist top N candidates', async () => {
    const result = await shortlistingManager.autoShortlist(testJobId);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.shortlisted, 3, 'Should shortlist 3 candidates');
    assert.strictEqual(result.buffer, 3, 'Should have 3 candidates in buffer');

    // Verify shortlisted candidates have correct status and ranks
    const { data: shortlisted } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'shortlisted')
      .order('rank', { ascending: true });

    assert.strictEqual(shortlisted.length, 3);
    assert.strictEqual(shortlisted[0].rank, 1);
    assert.strictEqual(shortlisted[1].rank, 2);
    assert.strictEqual(shortlisted[2].rank, 3);

    // Verify they have the highest fit scores
    assert.strictEqual(shortlisted[0].fit_score, 90);
    assert.strictEqual(shortlisted[1].fit_score, 85);
    assert.strictEqual(shortlisted[2].fit_score, 80);

    // Verify buffer candidates
    const { data: buffer } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'buffer')
      .order('rank', { ascending: true });

    assert.strictEqual(buffer.length, 3);
    assert.strictEqual(buffer[0].rank, 4);
    assert.strictEqual(buffer[1].rank, 5);
    assert.strictEqual(buffer[2].rank, 6);
  });

  it('should get shortlist status correctly', async () => {
    const status = await shortlistingManager.getShortlistStatus(testJobId);

    assert.strictEqual(status.success, true);
    assert.strictEqual(status.shortlisted, 3);
    assert.strictEqual(status.buffer, 3);
    assert.strictEqual(status.pending, 4);
    assert.strictEqual(status.total, 10);
  });

  it('should promote from buffer when shortlisted candidate drops out', async () => {
    // Mark rank 2 candidate as rejected
    const { data: rank2Candidate } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', testJobId)
      .eq('rank', 2)
      .single();

    await supabase
      .from('applications')
      .update({ shortlist_status: 'rejected' })
      .eq('id', rank2Candidate.id);

    // Promote from buffer
    const result = await shortlistingManager.promoteFromBuffer(testJobId, 2);

    assert.strictEqual(result.success, true);
    assert.ok(result.candidate, 'Should return promoted candidate');

    // Verify promoted candidate now has rank 2 and is shortlisted
    const { data: promoted } = await supabase
      .from('applications')
      .select('*')
      .eq('id', result.candidate.id)
      .single();

    assert.strictEqual(promoted.shortlist_status, 'shortlisted');
    assert.strictEqual(promoted.rank, 2);

    // Verify buffer was backfilled
    const { data: buffer } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'buffer');

    assert.strictEqual(buffer.length, 3, 'Buffer should be backfilled to target size');
  });

  it('should backfill buffer to maintain target size', async () => {
    // Remove one buffer candidate
    const { data: bufferCandidate } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'buffer')
      .limit(1)
      .single();

    await supabase
      .from('applications')
      .update({ shortlist_status: 'rejected' })
      .eq('id', bufferCandidate.id);

    // Backfill buffer
    const result = await shortlistingManager.backfillBuffer(testJobId);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.backfilled, 1, 'Should backfill 1 candidate');

    // Verify buffer is at target size
    const { data: buffer } = await supabase
      .from('applications')
      .select('*')
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'buffer');

    assert.strictEqual(buffer.length, 3, 'Buffer should be at target size');
  });

  it('should check if promotion is allowed', async () => {
    // Without any confirmed interviews, promotion should be allowed
    const result = await shortlistingManager.canPromote(testJobId);

    assert.strictEqual(result.allowed, true);
    assert.ok(result.reason);
  });

  it('should handle empty buffer gracefully', async () => {
    // Mark all buffer candidates as rejected
    await supabase
      .from('applications')
      .update({ shortlist_status: 'rejected' })
      .eq('job_id', testJobId)
      .eq('shortlist_status', 'buffer');

    // Try to promote from empty buffer
    const result = await shortlistingManager.promoteFromBuffer(testJobId, 1);

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'No buffer candidates available');
  });
});
