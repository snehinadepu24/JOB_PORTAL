/**
 * Manual Test: Enhanced Analytics Calculations
 * Task 14.4: Implement analytics calculations
 * 
 * Tests the enhanced analytics endpoint with:
 * - Detailed time saved breakdown
 * - Granular buffer health status
 * - Time-to-interview distribution
 * - Conversion funnel metrics
 * - Additional metrics (response rate, negotiation rounds, no-show rate)
 * - Trend data comparison
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:4000/api/v1';

// Test configuration
const TEST_CONFIG = {
  jobId: null, // Will be set from environment or created
  authToken: null
};

/**
 * Helper: Login and get auth token
 */
async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/user/login`, {
      email: 'recruiter@test.com',
      password: 'password123',
      role: 'Employer'
    });
    
    TEST_CONFIG.authToken = response.data.token;
    console.log('✓ Login successful');
    return response.data.token;
  } catch (error) {
    console.error('✗ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Helper: Get axios config with auth
 */
function getAuthConfig() {
  return {
    headers: {
      'Authorization': `Bearer ${TEST_CONFIG.authToken}`
    }
  };
}

/**
 * Test 1: Get enhanced analytics for a job
 */
async function testGetEnhancedAnalytics() {
  console.log('\n=== Test 1: Get Enhanced Analytics ===');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/dashboard/analytics/${TEST_CONFIG.jobId}`,
      getAuthConfig()
    );
    
    const { analytics } = response.data;
    
    console.log('✓ Analytics retrieved successfully');
    console.log('\n--- Core Metrics ---');
    console.log(`Time Saved: ${analytics.time_saved_hours} hours`);
    console.log(`Automation Success Rate: ${analytics.automation_success_rate}%`);
    console.log(`Average Time to Interview: ${analytics.average_time_to_interview_days} days`);
    
    console.log('\n--- Time Saved Breakdown ---');
    console.log(`  Resume Processing: ${analytics.time_saved_breakdown.resume_processing} hours`);
    console.log(`  Auto-Shortlisting: ${analytics.time_saved_breakdown.auto_shortlisting} hours`);
    console.log(`  Auto-Invitations: ${analytics.time_saved_breakdown.auto_invitations} hours`);
    console.log(`  Buffer Promotions: ${analytics.time_saved_breakdown.buffer_promotions} hours`);
    console.log(`  Slot Negotiations: ${analytics.time_saved_breakdown.slot_negotiations} hours`);
    console.log(`  Calendar Coordination: ${analytics.time_saved_breakdown.calendar_coordination} hours`);
    console.log(`  Deadline Monitoring: ${analytics.time_saved_breakdown.deadline_monitoring} hours`);
    
    console.log('\n--- Buffer Health ---');
    console.log(`  Status: ${analytics.buffer_health.status} (${analytics.buffer_health.color})`);
    console.log(`  Current Size: ${analytics.buffer_health.current_size}/${analytics.buffer_health.target_size}`);
    console.log(`  Percentage: ${analytics.buffer_health.percentage}%`);
    console.log(`  Utilization Rate: ${analytics.buffer_health.utilization_rate}%`);
    console.log(`  Available Candidates: ${analytics.buffer_health.available_candidates}`);
    
    console.log('\n--- Time-to-Interview Distribution ---');
    console.log(`  Median: ${analytics.time_to_interview_distribution.median} days`);
    console.log(`  25th Percentile: ${analytics.time_to_interview_distribution.p25} days`);
    console.log(`  75th Percentile: ${analytics.time_to_interview_distribution.p75} days`);
    console.log(`  Min: ${analytics.time_to_interview_distribution.min} days`);
    console.log(`  Max: ${analytics.time_to_interview_distribution.max} days`);
    
    console.log('\n--- Conversion Funnel ---');
    console.log(`  Invitation Response Rate: ${analytics.conversion_funnel.invitation_response_rate}%`);
    console.log(`  Slot Selection Rate: ${analytics.conversion_funnel.slot_selection_rate}%`);
    console.log(`  Confirmation Rate: ${analytics.conversion_funnel.confirmation_rate}%`);
    
    console.log('\n--- Additional Metrics ---');
    console.log(`  Response Rate: ${analytics.response_rate}%`);
    console.log(`  Average Negotiation Rounds: ${analytics.average_negotiation_rounds}`);
    console.log(`  Negotiation Escalation Rate: ${analytics.negotiation_escalation_rate}%`);
    console.log(`  No-Show Rate: ${analytics.no_show_rate}%`);
    console.log(`  Average No-Show Risk: ${analytics.average_no_show_risk}`);
    
    console.log('\n--- Trend Data ---');
    console.log(`  Success Rate Change: ${analytics.trends.success_rate_change > 0 ? '+' : ''}${analytics.trends.success_rate_change}%`);
    console.log(`  Activity Change: ${analytics.trends.activity_change > 0 ? '+' : ''}${analytics.trends.activity_change}%`);
    console.log(`  Recent Period (Last 7 Days):`);
    console.log(`    Interviews: ${analytics.trends.recent_period.interviews}`);
    console.log(`    Success Rate: ${analytics.trends.recent_period.success_rate}%`);
    console.log(`    Activities: ${analytics.trends.recent_period.activities}`);
    console.log(`  Previous Period (7-14 Days Ago):`);
    console.log(`    Interviews: ${analytics.trends.previous_period.interviews}`);
    console.log(`    Success Rate: ${analytics.trends.previous_period.success_rate}%`);
    console.log(`    Activities: ${analytics.trends.previous_period.activities}`);
    
    console.log('\n--- Candidate Breakdown ---');
    console.log(`  Total: ${analytics.candidate_breakdown.total}`);
    console.log(`  Shortlisted: ${analytics.candidate_breakdown.shortlisted}`);
    console.log(`  Buffer: ${analytics.candidate_breakdown.buffer}`);
    console.log(`  Pending: ${analytics.candidate_breakdown.pending}`);
    console.log(`  Rejected: ${analytics.candidate_breakdown.rejected}`);
    
    console.log('\n--- Interview Breakdown ---');
    console.log(`  Total: ${analytics.interview_breakdown.total}`);
    console.log(`  Invitation Sent: ${analytics.interview_breakdown.invitation_sent}`);
    console.log(`  Slot Pending: ${analytics.interview_breakdown.slot_pending}`);
    console.log(`  Confirmed: ${analytics.interview_breakdown.confirmed}`);
    console.log(`  Completed: ${analytics.interview_breakdown.completed}`);
    console.log(`  Cancelled: ${analytics.interview_breakdown.cancelled}`);
    console.log(`  Expired: ${analytics.interview_breakdown.expired}`);
    console.log(`  No-Show: ${analytics.interview_breakdown.no_show}`);
    
    console.log('\n--- Automation Actions ---');
    console.log(`  Total: ${analytics.automation_actions.total}`);
    console.log(`  Resume Processing: ${analytics.automation_actions.resume_processing}`);
    console.log(`  Auto-Shortlist: ${analytics.automation_actions.auto_shortlist}`);
    console.log(`  Invitations Sent: ${analytics.automation_actions.invitations_sent}`);
    console.log(`  Buffer Promotions: ${analytics.automation_actions.buffer_promotions}`);
    console.log(`  Negotiations: ${analytics.automation_actions.negotiations}`);
    console.log(`  Expirations Handled: ${analytics.automation_actions.expirations_handled}`);
    
    return analytics;
  } catch (error) {
    console.error('✗ Failed to get analytics:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Test 2: Verify buffer health status levels
 */
async function testBufferHealthLevels() {
  console.log('\n=== Test 2: Verify Buffer Health Status Levels ===');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/dashboard/analytics/${TEST_CONFIG.jobId}`,
      getAuthConfig()
    );
    
    const { buffer_health } = response.data.analytics;
    
    console.log(`Buffer Health: ${buffer_health.status} (${buffer_health.percentage}%)`);
    
    // Verify status matches percentage
    const percentage = buffer_health.percentage;
    let expectedStatus;
    let expectedColor;
    
    if (percentage >= 100) {
      expectedStatus = 'full';
      expectedColor = 'green';
    } else if (percentage >= 75) {
      expectedStatus = 'healthy';
      expectedColor = 'green';
    } else if (percentage >= 50) {
      expectedStatus = 'partial';
      expectedColor = 'yellow';
    } else if (percentage >= 25) {
      expectedStatus = 'low';
      expectedColor = 'orange';
    } else if (percentage > 0) {
      expectedStatus = 'critical';
      expectedColor = 'red';
    } else {
      expectedStatus = 'empty';
      expectedColor = 'red';
    }
    
    if (buffer_health.status === expectedStatus && buffer_health.color === expectedColor) {
      console.log(`✓ Buffer health status correctly calculated: ${expectedStatus} (${expectedColor})`);
    } else {
      console.log(`✗ Buffer health mismatch. Expected: ${expectedStatus} (${expectedColor}), Got: ${buffer_health.status} (${buffer_health.color})`);
    }
    
    return buffer_health;
  } catch (error) {
    console.error('✗ Failed to verify buffer health:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Test 3: Verify time saved calculations
 */
async function testTimeSavedCalculations() {
  console.log('\n=== Test 3: Verify Time Saved Calculations ===');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/dashboard/analytics/${TEST_CONFIG.jobId}`,
      getAuthConfig()
    );
    
    const { analytics } = response.data;
    const breakdown = analytics.time_saved_breakdown;
    
    // Calculate total from breakdown
    const calculatedTotal = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
    const reportedTotal = analytics.time_saved_hours;
    
    console.log(`Calculated Total: ${calculatedTotal.toFixed(2)} hours`);
    console.log(`Reported Total: ${reportedTotal} hours`);
    
    // Allow small floating point differences
    if (Math.abs(calculatedTotal - reportedTotal) < 0.01) {
      console.log('✓ Time saved total matches breakdown sum');
    } else {
      console.log('✗ Time saved total does not match breakdown sum');
    }
    
    // Verify each component is non-negative
    let allValid = true;
    for (const [key, value] of Object.entries(breakdown)) {
      if (value < 0) {
        console.log(`✗ Negative value for ${key}: ${value}`);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log('✓ All time saved components are non-negative');
    }
    
    return analytics;
  } catch (error) {
    console.error('✗ Failed to verify time saved:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Test 4: Verify conversion funnel metrics
 */
async function testConversionFunnel() {
  console.log('\n=== Test 4: Verify Conversion Funnel Metrics ===');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/dashboard/analytics/${TEST_CONFIG.jobId}`,
      getAuthConfig()
    );
    
    const { analytics } = response.data;
    const funnel = analytics.conversion_funnel;
    
    console.log('Conversion Funnel:');
    console.log(`  Invitation Response Rate: ${funnel.invitation_response_rate}%`);
    console.log(`  Slot Selection Rate: ${funnel.slot_selection_rate}%`);
    console.log(`  Confirmation Rate: ${funnel.confirmation_rate}%`);
    
    // Verify rates are between 0 and 100
    const rates = [
      funnel.invitation_response_rate,
      funnel.slot_selection_rate,
      funnel.confirmation_rate
    ];
    
    let allValid = true;
    for (const rate of rates) {
      if (rate < 0 || rate > 100) {
        console.log(`✗ Invalid rate: ${rate}% (should be 0-100)`);
        allValid = false;
      }
    }
    
    if (allValid) {
      console.log('✓ All conversion rates are valid (0-100%)');
    }
    
    // Verify funnel logic: confirmation rate should be <= slot selection rate <= response rate
    // (This is a logical expectation but may not always hold due to timing)
    console.log('\nFunnel Logic Check:');
    console.log(`  Response >= Selection: ${funnel.invitation_response_rate >= funnel.slot_selection_rate ? '✓' : '✗'}`);
    console.log(`  Selection >= Confirmation: ${funnel.slot_selection_rate >= funnel.confirmation_rate ? '✓' : '✗'}`);
    
    return funnel;
  } catch (error) {
    console.error('✗ Failed to verify conversion funnel:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('='.repeat(60));
  console.log('Enhanced Analytics Calculations - Manual Test');
  console.log('Task 14.4: Implement analytics calculations');
  console.log('='.repeat(60));
  
  try {
    // Login
    await login();
    
    // Get job ID from environment or use default
    TEST_CONFIG.jobId = process.env.TEST_JOB_ID || '00000000-0000-0000-0000-000000000001';
    console.log(`\nUsing Job ID: ${TEST_CONFIG.jobId}`);
    console.log('(Set TEST_JOB_ID environment variable to test a different job)');
    
    // Run tests
    await testGetEnhancedAnalytics();
    await testBufferHealthLevels();
    await testTimeSavedCalculations();
    await testConversionFunnel();
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ All tests completed successfully');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('✗ Tests failed');
    console.log('='.repeat(60));
    process.exit(1);
  }
}

// Run tests
runTests();
