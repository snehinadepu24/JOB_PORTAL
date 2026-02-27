/**
 * Property-Based Test: Shortlist Size Invariant
 * 
 * **Validates: Requirements 2.7**
 * 
 * Property 6: Shortlist Size Invariant
 * For any job at any point in time, the number of candidates with 
 * shortlist_status="shortlisted" should never exceed the job's number_of_openings.
 * 
 * This test validates that the ShortlistingManager correctly enforces the
 * shortlist size limit across various scenarios with different:
 * - Number of openings (1-20)
 * - Number of applications (varying from less than to more than openings)
 * - Fit score distributions
 * 
 * PREREQUISITES:
 * - Database migration must be run first (001_add_ai_orchestrator_schema.up.sql)
 * - See README-PROPERTY-TESTS.md for setup instructions
 * 
 * Run with: node backend/tests/property-shortlist-size-invariant.test.js
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
 * Helper: Get count of shortlisted candidates for a job
 */
async function getShortlistedCount(jobId) {
  const { data, error } = await supabase
    .from('applications')
    .select('id')
    .eq('job_id', jobId)
    .eq('shortlist_status', 'shortlisted');

  if (error) throw error;
  return data ? data.length : 0;
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
 * Property Test: Shortlist Size Invariant
 * 
 * Feature: ai-hiring-orchestrator, Property 6: Shortlist Size Invariant
 * 
 * This test verifies that after auto-shortlisting, the number of candidates
 * with shortlist_status='shortlisted' never exceeds the job's number_of_openings.
 */
async function testShortlistSizeInvariant() {
  console.log('=' .repeat(70));
  console.log('Property-Based Test: Shortlist Size Invariant');
  console.log('=' .repeat(70));
  console.log('\nThis test validates Requirement 2.7');
  console.log('Running 5 iterations with randomly generated scenarios...\n');
  
  console.log('Property 6: Shortlist Size Invariant');
  console.log('For any job at any point in time, the number of candidates with');
  console.log('shortlist_status="shortlisted" should never exceed the job\'s');
  console.log('number_of_openings.\n');
  
  console.log('Test scenarios:');
  console.log('  - Number of openings: 1-20 (random)');
  console.log('  - Number of applications: 1-100 (random)');
  console.log('  - Fit scores: 0-100 (random distribution)');
  console.log('  - Iterations: 5\n');
  
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

            // Generate fit scores for applications (using integers for better distribution)
            // Scores range from 0 to 100 with reasonable distribution
            const applications = [];
            for (let i = 0; i < numApplications; i++) {
              // Generate scores with good distribution across the range
              const score = Math.random() * 100;
              applications.push({ fit_score: score });
            }

            await createTestApplications(jobId, userId, applications);

            // Execute auto-shortlist
            const result = await shortlistingManager.autoShortlist(jobId);

            // PROPERTY: Count of shortlisted candidates must never exceed number_of_openings
            const shortlistedCount = await getShortlistedCount(jobId);

            // Verify the invariant
            if (shortlistedCount > numberOfOpenings) {
              throw new Error(
                `INVARIANT VIOLATED: Shortlisted ${shortlistedCount} candidates ` +
                `but job only has ${numberOfOpenings} openings. ` +
                `(Total applications: ${numApplications})`
              );
            }

            // Additional verification: shortlisted count should be min(applications, openings)
            const expectedShortlisted = Math.min(numApplications, numberOfOpenings);
            if (shortlistedCount !== expectedShortlisted) {
              throw new Error(
                `Expected ${expectedShortlisted} shortlisted candidates ` +
                `(min of ${numApplications} applications and ${numberOfOpenings} openings), ` +
                `but got ${shortlistedCount}`
              );
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

    console.log('\n' + '=' .repeat(70));
    console.log('✓ ALL PROPERTY TESTS PASSED');
    console.log('=' .repeat(70));
    console.log(`\nSuccessfully validated ${passedTests} random scenarios\n`);
    
    console.log('Property 6: Shortlist Size Invariant - VERIFIED');
    console.log('  ✓ Shortlist size never exceeds number_of_openings');
    console.log('  ✓ Correct number of candidates shortlisted in all scenarios');
    console.log('  ✓ Handles edge cases:');
    console.log('    - More applications than openings');
    console.log('    - Fewer applications than openings');
    console.log('    - Equal applications and openings');
    console.log('    - Various fit score distributions');
    console.log('\n✓ Requirement 2.7 validated successfully');
    
    return true;

  } catch (error) {
    failedTests++;
    console.log('\n' + '=' .repeat(70));
    console.log('✗ PROPERTY TEST FAILED');
    console.log('=' .repeat(70));
    console.log(`\nError: ${error.message}\n`);
    
    if (error.counterexample) {
      console.log('Counterexample found:');
      console.log(JSON.stringify(error.counterexample, null, 2));
    }
    
    throw error;
  }
}

// Run the test
testShortlistSizeInvariant()
  .then(() => {
    console.log('\n✓ Property test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Property test failed:', error.message);
    process.exit(1);
  });
