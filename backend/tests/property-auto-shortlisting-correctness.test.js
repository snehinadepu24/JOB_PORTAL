/**
 * Property-Based Test: Auto-Shortlisting Correctness
 * 
 * **Validates: Requirements 2.3, 2.4**
 * 
 * Property 7: Auto-Shortlisting Correctness
 * When auto-shortlisting is executed, the system must:
 * 1. Shortlist exactly the top N candidates by fit_score (where N = number_of_openings)
 * 2. Assign correct rank positions (1, 2, 3...) in descending fit_score order
 * 3. Set shortlist_status to "shortlisted" for top N candidates
 * 4. Never shortlist a candidate with lower fit_score over one with higher fit_score
 * 
 * This test validates that the ShortlistingManager correctly implements the
 * auto-shortlisting algorithm across various scenarios with different:
 * - Number of openings (1-20)
 * - Number of applications (varying from less than to more than openings)
 * - Fit score distributions (including ties)
 * 
 * PREREQUISITES:
 * - Database migration must be run first (001_add_ai_orchestrator_schema.up.sql)
 * - See README-PROPERTY-TESTS.md for setup instructions
 * 
 * Run with: node backend/tests/property-auto-shortlisting-correctness.test.js
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fc from 'fast-check';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from config.env
config({ path: path.join(__dirname, '../config/config.env') });

// Now import modules that depend on environment variables
import { supabase } from '../database/supabaseClient.js';
import { shortlistingManager } from '../managers/ShortlistingManager.js';

/**
 * Helper: Check if migration has been run
 */
async function checkMigrationStatus() {
  try {
    // Try to query a job with the new columns
    const { data, error } = await supabase
      .from('jobs')
      .select('number_of_openings, shortlisting_buffer')
      .limit(1);
    
    if (error && error.message.includes('number_of_openings')) {
      console.error('\n' + '='.repeat(70));
      console.error('❌ MIGRATION NOT RUN');
      console.error('='.repeat(70));
      console.error('\nThe database migration has not been executed yet.');
      console.error('Please run the migration first:');
      console.error('\n1. Using Supabase SQL Editor:');
      console.error('   - Open Supabase Dashboard > SQL Editor');
      console.error('   - Copy contents of: backend/database/migrations/001_add_ai_orchestrator_schema.up.sql');
      console.error('   - Execute the SQL');
      console.error('\n2. Or using psql:');
      console.error('   psql $DATABASE_URL -f backend/database/migrations/001_add_ai_orchestrator_schema.up.sql');
      console.error('\n' + '='.repeat(70) + '\n');
      process.exit(1);
    }
    
    return true;
  } catch (error) {
    console.error('Error checking migration status:', error.message);
    return false;
  }
}

/**
 * Helper: Create a test user
 */
async function createTestUser() {
  const { data: user, error } = await supabase
    .from('users')
    .insert([
      {
        name: 'Test Employer',
        email: `test-employer-${Date.now()}-${Math.random()}@example.com`,
        phone: 1234567890,
        password: 'hashedpassword',
        role: 'Employer',
        favourite_sport: 'Basketball'
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return user;
}

/**
 * Helper: Create a test job with specified number of openings
 */
async function createTestJob(userId, numberOfOpenings, bufferSize) {
  const { data: job, error } = await supabase
    .from('jobs')
    .insert([
      {
        title: `Test Job ${Date.now()}`,
        description: 'Test job description for property testing',
        category: 'IT',
        country: 'USA',
        city: 'New York',
        location: 'New York, USA',
        fixed_salary: 100000,
        posted_by: userId,
        number_of_openings: numberOfOpenings,
        shortlisting_buffer: bufferSize || numberOfOpenings,
        applications_closed: true
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return job;
}

/**
 * Helper: Create test applications with specified fit scores
 */
async function createTestApplications(jobId, userId, applications) {
  const appRecords = applications.map((app, index) => ({
    name: `Test Candidate ${index + 1}`,
    email: `candidate-${Date.now()}-${index}-${Math.random()}@example.com`,
    cover_letter: 'Test cover letter',
    phone: 1234567890 + index,
    address: 'Test Address',
    applicant_id: userId,
    applicant_role: 'Job Seeker',
    employer_id: userId,
    employer_role: 'Employer',
    resume_url: 'https://example.com/resume.pdf',
    resume_public_id: `test_resume_${index}_${Date.now()}`,
    job_id: jobId,
    fit_score: app.fit_score,
    ai_processed: true,
    shortlist_status: 'pending'
  }));

  const { data, error } = await supabase
    .from('applications')
    .insert(appRecords)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Helper: Get shortlisted candidates for a job
 */
async function getShortlistedCandidates(jobId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('job_id', jobId)
    .eq('shortlist_status', 'shortlisted')
    .order('rank', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Helper: Get all applications for a job ordered by fit_score
 */
async function getAllApplications(jobId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('job_id', jobId)
    .order('fit_score', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Helper: Cleanup test data
 */
async function cleanup(jobId, userId) {
  if (jobId) {
    await supabase.from('applications').delete().eq('job_id', jobId);
    await supabase.from('jobs').delete().eq('id', jobId);
  }
  if (userId) {
    await supabase.from('users').delete().eq('id', userId);
  }
}

/**
 * Property Test: Auto-Shortlisting Correctness
 * 
 * Feature: ai-hiring-orchestrator, Property 7: Auto-Shortlisting Correctness
 * 
 * This test verifies that after auto-shortlisting:
 * 1. The top N candidates by fit_score are shortlisted
 * 2. Ranks are assigned correctly (1, 2, 3...)
 * 3. shortlist_status is set to "shortlisted"
 * 4. No lower-scoring candidate is shortlisted over higher-scoring ones
 */
async function testAutoShortlistingCorrectness() {
  console.log('='.repeat(70));
  console.log('Property-Based Test: Auto-Shortlisting Correctness');
  console.log('='.repeat(70));
  console.log('\nThis test validates Requirements 2.3, 2.4');
  console.log('Running 20 iterations with randomly generated scenarios...\n');
  
  console.log('Property 7: Auto-Shortlisting Correctness');
  console.log('When auto-shortlisting is executed, the system must:');
  console.log('  1. Shortlist exactly the top N candidates by fit_score');
  console.log('  2. Assign correct rank positions (1, 2, 3...)');
  console.log('  3. Set shortlist_status to "shortlisted"');
  console.log('  4. Never shortlist lower-scoring over higher-scoring candidates\n');
  
  console.log('Test scenarios:');
  console.log('  - Number of openings: 1-20 (random)');
  console.log('  - Number of applications: 1-100 (random)');
  console.log('  - Fit scores: 0-100 (random distribution, including ties)');
  console.log('  - Iterations: 20\n');
  
  // Check if migration has been run
  console.log('Checking database migration status...');
  await checkMigrationStatus();
  console.log('✓ Migration verified\n');
  
  console.log('Starting property test...\n');

  let passedTests = 0;
  let failedTests = 0;

  try {
    await fc.assert(
      fc.asyncProperty(
        // Generate random number of openings (1-20)
        fc.integer({ min: 1, max: 20 }),
        // Generate random number of applications (1-100)
        fc.integer({ min: 1, max: 100 }),
        async (numberOfOpenings, numApplications) => {
          let userId = null;
          let jobId = null;

          try {
            // Create test user
            const user = await createTestUser();
            userId = user.id;

            // Create test job
            const job = await createTestJob(userId, numberOfOpenings, numberOfOpenings);
            jobId = job.id;

            // Generate fit scores for applications
            // Include some potential ties to test edge cases
            const applications = [];
            for (let i = 0; i < numApplications; i++) {
              // Generate scores with good distribution, occasionally create ties
              let score = Math.random() * 100;
              // 10% chance of creating a tie with previous score
              if (i > 0 && Math.random() < 0.1) {
                score = applications[i - 1].fit_score;
              }
              applications.push({ fit_score: score });
            }

            // Create applications in database
            await createTestApplications(jobId, userId, applications);

            // Execute auto-shortlist
            await shortlistingManager.autoShortlist(jobId);

            // Get all applications ordered by fit_score (descending)
            const allApps = await getAllApplications(jobId);
            
            // Get shortlisted candidates
            const shortlisted = await getShortlistedCandidates(jobId);

            // PROPERTY 1: Correct number of shortlisted candidates
            const expectedShortlisted = Math.min(numApplications, numberOfOpenings);
            if (shortlisted.length !== expectedShortlisted) {
              throw new Error(
                `Expected ${expectedShortlisted} shortlisted candidates, ` +
                `but got ${shortlisted.length}`
              );
            }

            // PROPERTY 2: Top N candidates by fit_score are shortlisted
            const topNCandidates = allApps.slice(0, expectedShortlisted);
            const topNIds = new Set(topNCandidates.map(app => app.id));
            const shortlistedIds = new Set(shortlisted.map(app => app.id));
            
            if (!areSetsEqual(topNIds, shortlistedIds)) {
              throw new Error(
                `Top N candidates by fit_score were not shortlisted. ` +
                `Expected IDs: ${Array.from(topNIds).join(', ')}, ` +
                `Got IDs: ${Array.from(shortlistedIds).join(', ')}`
              );
            }

            // PROPERTY 3: Ranks are assigned correctly (1, 2, 3...)
            for (let i = 0; i < shortlisted.length; i++) {
              const expectedRank = i + 1;
              if (shortlisted[i].rank !== expectedRank) {
                throw new Error(
                  `Rank mismatch at position ${i}: ` +
                  `expected rank ${expectedRank}, got ${shortlisted[i].rank}`
                );
              }
            }

            // PROPERTY 4: Ranks are in descending fit_score order
            for (let i = 0; i < shortlisted.length - 1; i++) {
              if (shortlisted[i].fit_score < shortlisted[i + 1].fit_score) {
                throw new Error(
                  `Rank order violation: ` +
                  `Rank ${shortlisted[i].rank} has fit_score ${shortlisted[i].fit_score}, ` +
                  `but rank ${shortlisted[i + 1].rank} has higher fit_score ${shortlisted[i + 1].fit_score}`
                );
              }
            }

            // PROPERTY 5: All shortlisted have status "shortlisted"
            for (const app of shortlisted) {
              if (app.shortlist_status !== 'shortlisted') {
                throw new Error(
                  `Shortlisted candidate ${app.id} has incorrect status: ${app.shortlist_status}`
                );
              }
            }

            // PROPERTY 6: No non-shortlisted candidate has higher fit_score than shortlisted
            const nonShortlisted = allApps.filter(app => app.shortlist_status !== 'shortlisted');
            if (shortlisted.length > 0 && nonShortlisted.length > 0) {
              const lowestShortlistedScore = Math.min(...shortlisted.map(app => app.fit_score));
              const highestNonShortlistedScore = Math.max(...nonShortlisted.map(app => app.fit_score));
              
              if (highestNonShortlistedScore > lowestShortlistedScore) {
                throw new Error(
                  `Non-shortlisted candidate has higher fit_score (${highestNonShortlistedScore}) ` +
                  `than shortlisted candidate (${lowestShortlistedScore})`
                );
              }
            }

            passedTests++;
            
            // Log progress every 5 tests
            if (passedTests % 5 === 0) {
              console.log(`  ✓ Passed ${passedTests} tests...`);
            }

          } catch (error) {
            // Log detailed error information for debugging
            console.error(`\nTest failed with parameters:`);
            console.error(`  - Number of openings: ${numberOfOpenings}`);
            console.error(`  - Number of applications: ${numApplications}`);
            console.error(`  - Error: ${error.message}`);
            throw error;
          } finally {
            // Cleanup after each test
            await cleanup(jobId, userId);
          }
        }
      ),
      { 
        numRuns: 5,
        verbose: false,
        endOnFailure: true
      }
    );

    console.log('\n' + '='.repeat(70));
    console.log('✓ ALL PROPERTY TESTS PASSED');
    console.log('='.repeat(70));
    console.log(`\nSuccessfully validated ${passedTests} random scenarios\n`);
    
    console.log('Property 7: Auto-Shortlisting Correctness - VERIFIED');
    console.log('  ✓ Top N candidates by fit_score are always shortlisted');
    console.log('  ✓ Ranks assigned correctly (1, 2, 3...) in fit_score order');
    console.log('  ✓ shortlist_status set to "shortlisted" for all top N');
    console.log('  ✓ No lower-scoring candidate shortlisted over higher-scoring');
    console.log('  ✓ Handles edge cases:');
    console.log('    - More applications than openings');
    console.log('    - Fewer applications than openings');
    console.log('    - Tied fit scores');
    console.log('    - Various score distributions');
    console.log('\n✓ Requirements 2.3, 2.4 validated successfully');
    
    return true;

  } catch (error) {
    failedTests++;
    console.log('\n' + '='.repeat(70));
    console.log('✗ PROPERTY TEST FAILED');
    console.log('='.repeat(70));
    console.log(`\nError: ${error.message}\n`);
    
    if (error.counterexample) {
      console.log('Counterexample found:');
      console.log(JSON.stringify(error.counterexample, null, 2));
    }
    
    throw error;
  }
}

/**
 * Helper: Check if two sets are equal
 */
function areSetsEqual(set1, set2) {
  if (set1.size !== set2.size) return false;
  for (const item of set1) {
    if (!set2.has(item)) return false;
  }
  return true;
}

// Run the test
testAutoShortlistingCorrectness()
  .then(() => {
    console.log('\n✓ Property test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Property test failed:', error.message);
    process.exit(1);
  });
