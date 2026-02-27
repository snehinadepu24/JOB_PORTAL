/**
 * Standalone test for ShortlistingManager
 * 
 * Run with: node backend/tests/test-shortlisting-manager.js
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from config.env
config({ path: path.join(__dirname, '../config/config.env') });

// Now import modules that depend on environment variables
import { supabase } from '../database/supabaseClient.js';
import { shortlistingManager } from '../managers/ShortlistingManager.js';

async function runTests() {
  console.log('Starting ShortlistingManager tests...\n');
  
  let testJobId;
  let testApplicationIds = [];
  let testUserId;
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Setup: Create test data
    console.log('Setting up test data...');
    
    // Create a test user (employer)
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([
        {
          name: 'Test Employer',
          email: `test-employer-${Date.now()}@example.com`,
          phone: 1234567890,
          password: 'hashedpassword',
          role: 'Employer',
          favourite_sport: 'Basketball'
        }
      ])
      .select()
      .single();

    if (userError) throw userError;
    testUserId = user.id;
    console.log('✓ Created test user');

    // Create a test job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert([
        {
          title: 'Test Job for Shortlisting',
          description: 'Test job description with skills: Python, JavaScript, React',
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

    if (jobError) throw jobError;
    testJobId = job.id;
    console.log('✓ Created test job');

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

    if (appsError) throw appsError;
    testApplicationIds = createdApps.map(app => app.id);
    console.log(`✓ Created ${testApplicationIds.length} test applications\n`);

    // Test 1: Auto-shortlist
    console.log('Test 1: Auto-shortlist top N candidates');
    try {
      const result = await shortlistingManager.autoShortlist(testJobId);
      
      if (result.success && result.shortlisted === 3 && result.buffer === 3) {
        console.log('✓ Auto-shortlist successful');
        console.log(`  - Shortlisted: ${result.shortlisted}`);
        console.log(`  - Buffer: ${result.buffer}`);
        
        // Verify shortlisted candidates
        const { data: shortlisted } = await supabase
          .from('applications')
          .select('*')
          .eq('job_id', testJobId)
          .eq('shortlist_status', 'shortlisted')
          .order('rank', { ascending: true });

        if (shortlisted.length === 3 && 
            shortlisted[0].fit_score === 90 && 
            shortlisted[1].fit_score === 85 && 
            shortlisted[2].fit_score === 80) {
          console.log('✓ Correct candidates shortlisted with highest fit scores');
          testsPassed++;
        } else {
          console.log('✗ Incorrect candidates shortlisted');
          testsFailed++;
        }
      } else {
        console.log('✗ Auto-shortlist failed');
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Test failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 2: Get shortlist status
    console.log('Test 2: Get shortlist status');
    try {
      const status = await shortlistingManager.getShortlistStatus(testJobId);
      
      if (status.success && 
          status.shortlisted === 3 && 
          status.buffer === 3 && 
          status.pending === 4) {
        console.log('✓ Shortlist status correct');
        console.log(`  - Shortlisted: ${status.shortlisted}`);
        console.log(`  - Buffer: ${status.buffer}`);
        console.log(`  - Pending: ${status.pending}`);
        testsPassed++;
      } else {
        console.log('✗ Shortlist status incorrect');
        console.log(`  Expected: shortlisted=3, buffer=3, pending=4`);
        console.log(`  Got: shortlisted=${status.shortlisted}, buffer=${status.buffer}, pending=${status.pending}`);
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Test failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 3: Promote from buffer
    console.log('Test 3: Promote from buffer');
    try {
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

      if (result.success && result.candidate) {
        console.log('✓ Buffer promotion successful');
        console.log(`  - Promoted candidate to rank ${result.candidate.rank}`);
        
        // Verify promoted candidate
        const { data: promoted } = await supabase
          .from('applications')
          .select('*')
          .eq('id', result.candidate.id)
          .single();

        if (promoted.shortlist_status === 'shortlisted' && promoted.rank === 2) {
          console.log('✓ Promoted candidate has correct status and rank');
          testsPassed++;
        } else {
          console.log('✗ Promoted candidate has incorrect status or rank');
          testsFailed++;
        }
      } else {
        console.log('✗ Buffer promotion failed');
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Test failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 4: Backfill buffer
    console.log('Test 4: Backfill buffer');
    try {
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

      if (result.success && result.backfilled === 1) {
        console.log('✓ Buffer backfill successful');
        console.log(`  - Backfilled: ${result.backfilled} candidate(s)`);
        
        // Verify buffer size
        const { data: buffer } = await supabase
          .from('applications')
          .select('*')
          .eq('job_id', testJobId)
          .eq('shortlist_status', 'buffer');

        if (buffer.length === 3) {
          console.log('✓ Buffer at target size');
          testsPassed++;
        } else {
          console.log(`✗ Buffer size incorrect: ${buffer.length} (expected 3)`);
          testsFailed++;
        }
      } else {
        console.log('✗ Buffer backfill failed');
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Test failed:', error.message);
      testsFailed++;
    }
    console.log('');

    // Test 5: Can promote check
    console.log('Test 5: Check if promotion is allowed');
    try {
      const result = await shortlistingManager.canPromote(testJobId);

      if (result.allowed === true) {
        console.log('✓ Promotion allowed (no interviews within 24 hours)');
        console.log(`  - Reason: ${result.reason}`);
        testsPassed++;
      } else {
        console.log('✗ Promotion check failed');
        testsFailed++;
      }
    } catch (error) {
      console.log('✗ Test failed:', error.message);
      testsFailed++;
    }
    console.log('');

  } catch (error) {
    console.error('Setup error:', error);
  } finally {
    // Cleanup
    console.log('Cleaning up test data...');
    
    if (testApplicationIds.length > 0) {
      await supabase
        .from('applications')
        .delete()
        .in('id', testApplicationIds);
      console.log('✓ Deleted test applications');
    }

    if (testJobId) {
      await supabase
        .from('jobs')
        .delete()
        .eq('id', testJobId);
      console.log('✓ Deleted test job');
    }

    if (testUserId) {
      await supabase
        .from('users')
        .delete()
        .eq('id', testUserId);
      console.log('✓ Deleted test user');
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Tests passed: ${testsPassed}`);
    console.log(`Tests failed: ${testsFailed}`);
    console.log('='.repeat(50));

    if (testsFailed === 0) {
      console.log('\n✓ All tests passed!');
      process.exit(0);
    } else {
      console.log('\n✗ Some tests failed');
      process.exit(1);
    }
  }
}

runTests();
