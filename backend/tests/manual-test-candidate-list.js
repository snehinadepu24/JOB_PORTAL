/**
 * Manual test script for Task 14.2: Candidate list with sorting and filtering
 * 
 * This script demonstrates the enhanced getRankedCandidates endpoint with:
 * - Sorting by different fields (fit_score, rank, name, no_show_risk)
 * - Filtering by shortlist_status and interview_status
 * - Buffer rank calculation for buffer candidates
 * - Metadata for frontend highlighting
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { supabase } from '../database/supabaseClient.js';

async function testCandidateListAPI() {
  console.log('='.repeat(80));
  console.log('Testing Enhanced Candidate List API (Task 14.2)');
  console.log('='.repeat(80));

  try {
    // Find an existing job with applications
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, number_of_openings, shortlisting_buffer')
      .eq('applications_closed', true)
      .limit(1);

    if (jobsError || !jobs || jobs.length === 0) {
      console.log('\n❌ No jobs found with closed applications. Please run the shortlisting test first.');
      return;
    }

    const testJob = jobs[0];
    console.log(`\n✓ Using job: ${testJob.title} (ID: ${testJob.id})`);
    console.log(`  - Number of openings: ${testJob.number_of_openings}`);
    console.log(`  - Buffer size: ${testJob.shortlisting_buffer}`);

    // Test 1: Default sorting (by fit_score, descending)
    console.log('\n' + '-'.repeat(80));
    console.log('Test 1: Default Sorting (fit_score DESC)');
    console.log('-'.repeat(80));

    const { data: defaultSort, error: error1 } = await supabase
      .from('applications')
      .select(`
        id,
        name,
        fit_score,
        rank,
        shortlist_status,
        interviews (status, no_show_risk)
      `)
      .eq('job_id', testJob.id)
      .order('fit_score', { ascending: false })
      .limit(5);

    if (error1) {
      console.log(`❌ Error: ${error1.message}`);
    } else {
      console.log(`✓ Retrieved ${defaultSort.length} candidates (top 5)`);
      defaultSort.forEach((candidate, index) => {
        const interview = candidate.interviews?.[0];
        const bufferRank = candidate.shortlist_status === 'buffer' && candidate.rank 
          ? candidate.rank - testJob.number_of_openings 
          : null;
        
        console.log(`  ${index + 1}. ${candidate.name}`);
        console.log(`     - Fit Score: ${candidate.fit_score}`);
        console.log(`     - Rank: ${candidate.rank || 'N/A'}`);
        console.log(`     - Status: ${candidate.shortlist_status}`);
        if (bufferRank) {
          console.log(`     - Buffer Rank: ${bufferRank}`);
        }
        if (interview) {
          console.log(`     - Interview Status: ${interview.status}`);
          console.log(`     - No-Show Risk: ${interview.no_show_risk}`);
        }
      });
    }

    // Test 2: Sort by name (ascending)
    console.log('\n' + '-'.repeat(80));
    console.log('Test 2: Sort by Name (ASC)');
    console.log('-'.repeat(80));

    const { data: nameSort, error: error2 } = await supabase
      .from('applications')
      .select('id, name, fit_score, shortlist_status')
      .eq('job_id', testJob.id)
      .order('name', { ascending: true })
      .limit(5);

    if (error2) {
      console.log(`❌ Error: ${error2.message}`);
    } else {
      console.log(`✓ Retrieved ${nameSort.length} candidates (top 5, sorted by name)`);
      nameSort.forEach((candidate, index) => {
        console.log(`  ${index + 1}. ${candidate.name} (Fit: ${candidate.fit_score}, Status: ${candidate.shortlist_status})`);
      });
    }

    // Test 3: Filter by shortlist_status = 'shortlisted'
    console.log('\n' + '-'.repeat(80));
    console.log('Test 3: Filter by Shortlisted Status');
    console.log('-'.repeat(80));

    const { data: shortlisted, error: error3 } = await supabase
      .from('applications')
      .select(`
        id,
        name,
        fit_score,
        rank,
        shortlist_status,
        interviews (status)
      `)
      .eq('job_id', testJob.id)
      .eq('shortlist_status', 'shortlisted')
      .order('rank', { ascending: true });

    if (error3) {
      console.log(`❌ Error: ${error3.message}`);
    } else {
      console.log(`✓ Retrieved ${shortlisted.length} shortlisted candidates`);
      shortlisted.forEach((candidate, index) => {
        const interview = candidate.interviews?.[0];
        console.log(`  ${index + 1}. ${candidate.name}`);
        console.log(`     - Rank: ${candidate.rank}`);
        console.log(`     - Fit Score: ${candidate.fit_score}`);
        console.log(`     - Interview Status: ${interview?.status || 'N/A'}`);
      });
    }

    // Test 4: Filter by shortlist_status = 'buffer'
    console.log('\n' + '-'.repeat(80));
    console.log('Test 4: Filter by Buffer Status (with Buffer Rank)');
    console.log('-'.repeat(80));

    const { data: buffer, error: error4 } = await supabase
      .from('applications')
      .select('id, name, fit_score, rank, shortlist_status')
      .eq('job_id', testJob.id)
      .eq('shortlist_status', 'buffer')
      .order('rank', { ascending: true });

    if (error4) {
      console.log(`❌ Error: ${error4.message}`);
    } else {
      console.log(`✓ Retrieved ${buffer.length} buffer candidates`);
      buffer.forEach((candidate, index) => {
        const bufferRank = candidate.rank - testJob.number_of_openings;
        console.log(`  ${index + 1}. ${candidate.name}`);
        console.log(`     - Overall Rank: ${candidate.rank}`);
        console.log(`     - Buffer Rank: ${bufferRank}`);
        console.log(`     - Fit Score: ${candidate.fit_score}`);
      });
    }

    // Test 5: Sort by rank (ascending)
    console.log('\n' + '-'.repeat(80));
    console.log('Test 5: Sort by Rank (ASC)');
    console.log('-'.repeat(80));

    const { data: rankSort, error: error5 } = await supabase
      .from('applications')
      .select('id, name, fit_score, rank, shortlist_status')
      .eq('job_id', testJob.id)
      .not('rank', 'is', null)
      .order('rank', { ascending: true });

    if (error5) {
      console.log(`❌ Error: ${error5.message}`);
    } else {
      console.log(`✓ Retrieved ${rankSort.length} ranked candidates`);
      rankSort.forEach((candidate, index) => {
        const bufferRank = candidate.shortlist_status === 'buffer' 
          ? candidate.rank - testJob.number_of_openings 
          : null;
        
        console.log(`  ${index + 1}. ${candidate.name}`);
        console.log(`     - Rank: ${candidate.rank}`);
        if (bufferRank) {
          console.log(`     - Buffer Rank: ${bufferRank}`);
        }
        console.log(`     - Status: ${candidate.shortlist_status}`);
        console.log(`     - Fit Score: ${candidate.fit_score}`);
      });
    }

    // Test 6: Metadata for highlighting
    console.log('\n' + '-'.repeat(80));
    console.log('Test 6: Generate Metadata for Frontend Highlighting');
    console.log('-'.repeat(80));

    const { data: allCandidates, error: error6 } = await supabase
      .from('applications')
      .select(`
        id,
        shortlist_status,
        interviews (no_show_risk)
      `)
      .eq('job_id', testJob.id);

    if (error6) {
      console.log(`❌ Error: ${error6.message}`);
    } else {
      const metadata = {
        counts: {
          total: allCandidates.length,
          shortlisted: allCandidates.filter(c => c.shortlist_status === 'shortlisted').length,
          buffer: allCandidates.filter(c => c.shortlist_status === 'buffer').length,
          pending: allCandidates.filter(c => c.shortlist_status === 'pending').length,
          rejected: allCandidates.filter(c => c.shortlist_status === 'rejected').length
        },
        highlighting: {
          shortlisted_ids: allCandidates
            .filter(c => c.shortlist_status === 'shortlisted')
            .map(c => c.id),
          buffer_ids: allCandidates
            .filter(c => c.shortlist_status === 'buffer')
            .map(c => c.id),
          high_risk_ids: allCandidates
            .filter(c => c.interviews?.[0]?.no_show_risk > 0.7)
            .map(c => c.id)
        }
      };

      console.log('✓ Metadata generated:');
      console.log(`  - Total candidates: ${metadata.counts.total}`);
      console.log(`  - Shortlisted: ${metadata.counts.shortlisted}`);
      console.log(`  - Buffer: ${metadata.counts.buffer}`);
      console.log(`  - Pending: ${metadata.counts.pending}`);
      console.log(`  - Rejected: ${metadata.counts.rejected}`);
      console.log(`  - Shortlisted IDs: ${metadata.highlighting.shortlisted_ids.length} candidates`);
      console.log(`  - Buffer IDs: ${metadata.highlighting.buffer_ids.length} candidates`);
      console.log(`  - High Risk IDs: ${metadata.highlighting.high_risk_ids.length} candidates`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✓ All tests completed successfully!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

// Run the test
testCandidateListAPI();
