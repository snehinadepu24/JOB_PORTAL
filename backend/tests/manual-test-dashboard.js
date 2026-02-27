/**
 * Manual test for dashboard endpoints
 * Run with: node tests/manual-test-dashboard.js
 */

import { supabase } from '../database/supabaseClient.js';
import {
  getRankedCandidates,
  getActivityLog,
  getAnalytics
} from '../controllers/dashboardController.js';

async function testDashboard() {
  console.log('Starting dashboard endpoint tests...\n');

  // Create test data
  console.log('Creating test data...');
  
  // Create test user
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({
      name: 'Manual Test User',
      email: `manual-test-${Date.now()}@example.com`,
      password: 'hashedpassword',
      phone: '1234567890',
      favourite_sport: 'Basketball',
      role: 'Employer'
    })
    .select()
    .single();

  if (userError) {
    console.error('Error creating user:', userError);
    return;
  }
  console.log('Created user:', user.id);

  // Create test job
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .insert({
      title: 'Manual Test Job',
      description: 'This is a manual test job description with sufficient length for testing',
      category: 'Software Development',
      country: 'USA',
      city: 'San Francisco',
      location: 'Remote',
      fixed_salary: 100000,
      posted_by: user.id,
      number_of_openings: 3,
      shortlisting_buffer: 3,
      applications_closed: true
    })
    .select()
    .single();

  if (jobError) {
    console.error('Error creating job:', jobError);
    await supabase.from('users').delete().eq('id', user.id);
    return;
  }
  console.log('Created job:', job.id);

  // Create test application
  const { data: application, error: appError } = await supabase
    .from('applications')
    .insert({
      job_id: job.id,
      applicant_id: user.id,
      employer_id: user.id,
      name: 'Manual Test Candidate',
      email: `manual-candidate-${Date.now()}@example.com`,
      phone: '9876543210',
      address: '123 Test Street',
      cover_letter: 'This is a manual test cover letter',
      resume_url: 'https://example.com/resume.pdf',
      resume_public_id: 'manual_test_resume',
      fit_score: 85.5,
      rank: 1,
      shortlist_status: 'shortlisted',
      ai_processed: true,
      summary: 'Excellent candidate'
    })
    .select()
    .single();

  if (appError) {
    console.error('Error creating application:', appError);
    await supabase.from('jobs').delete().eq('id', job.id);
    await supabase.from('users').delete().eq('id', user.id);
    return;
  }
  console.log('Created application:', application.id);

  // Create test interview
  const { data: interview, error: interviewError } = await supabase
    .from('interviews')
    .insert({
      application_id: application.id,
      job_id: job.id,
      recruiter_id: user.id,
      candidate_id: user.id,
      rank_at_time: 1,
      status: 'confirmed',
      no_show_risk: 0.25,
      scheduled_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      confirmation_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    })
    .select()
    .single();

  if (interviewError) {
    console.error('Error creating interview:', interviewError);
    await supabase.from('applications').delete().eq('id', application.id);
    await supabase.from('jobs').delete().eq('id', job.id);
    await supabase.from('users').delete().eq('id', user.id);
    return;
  }
  console.log('Created interview:', interview.id);

  // Create automation log
  const { error: logError } = await supabase
    .from('automation_logs')
    .insert({
      job_id: job.id,
      action_type: 'invitation_sent',
      trigger_source: 'auto',
      details: {
        candidate_id: user.id,
        interview_id: interview.id
      }
    });

  if (logError) {
    console.error('Error creating log:', logError);
  } else {
    console.log('Created automation log');
  }

  console.log('\n=== Testing getRankedCandidates ===');
  const req1 = { params: { jobId: job.id } };
  const res1 = {
    status: (code) => {
      console.log('Status:', code);
      return res1;
    },
    json: (data) => {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  };
  const next1 = (error) => {
    if (error) {
      console.error('Error:', error.message);
    }
  };

  await getRankedCandidates(req1, res1, next1);

  console.log('\n=== Testing getActivityLog ===');
  const req2 = { params: { jobId: job.id }, query: { limit: 50, offset: 0 } };
  const res2 = {
    status: (code) => {
      console.log('Status:', code);
      return res2;
    },
    json: (data) => {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  };
  const next2 = (error) => {
    if (error) {
      console.error('Error:', error.message);
    }
  };

  await getActivityLog(req2, res2, next2);

  console.log('\n=== Testing getAnalytics ===');
  const req3 = { params: { jobId: job.id } };
  const res3 = {
    status: (code) => {
      console.log('Status:', code);
      return res3;
    },
    json: (data) => {
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  };
  const next3 = (error) => {
    if (error) {
      console.error('Error:', error.message);
    }
  };

  await getAnalytics(req3, res3, next3);

  // Clean up
  console.log('\n=== Cleaning up test data ===');
  await supabase.from('interviews').delete().eq('id', interview.id);
  await supabase.from('automation_logs').delete().eq('job_id', job.id);
  await supabase.from('applications').delete().eq('id', application.id);
  await supabase.from('jobs').delete().eq('id', job.id);
  await supabase.from('users').delete().eq('id', user.id);
  console.log('Cleanup complete');
}

testDashboard().catch(console.error);
