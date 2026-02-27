-- Migration: Add AI Hiring Orchestrator Schema
-- Description: Adds new tables and columns for automated hiring features
-- Requirements: 10.1-10.12, 12.5-12.7
-- Date: 2024

-- ============================================================================
-- PART 1: Extend Jobs Table
-- ============================================================================

-- Add new columns to jobs table for automation features
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS number_of_openings INTEGER NOT NULL DEFAULT 1 CHECK (number_of_openings >= 1),
ADD COLUMN IF NOT EXISTS shortlisting_buffer INTEGER NOT NULL DEFAULT 1 CHECK (shortlisting_buffer >= 1),
ADD COLUMN IF NOT EXISTS automation_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS applications_closed BOOLEAN DEFAULT FALSE;

-- Set buffer to equal openings for existing jobs
UPDATE jobs 
SET shortlisting_buffer = number_of_openings 
WHERE shortlisting_buffer = 1 AND number_of_openings > 1;

-- Add comment for documentation
COMMENT ON COLUMN jobs.number_of_openings IS 'Maximum number of candidates that can be shortlisted';
COMMENT ON COLUMN jobs.shortlisting_buffer IS 'Number of buffer candidates to maintain';
COMMENT ON COLUMN jobs.automation_enabled IS 'Enable/disable automation for this job';
COMMENT ON COLUMN jobs.applications_closed IS 'Whether applications are closed and ranking can begin';

-- ============================================================================
-- PART 2: Extend Applications Table
-- ============================================================================

-- Add new columns to applications table for AI processing
ALTER TABLE applications
ADD COLUMN IF NOT EXISTS fit_score FLOAT DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
ADD COLUMN IF NOT EXISTS rank INTEGER,
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS shortlist_status VARCHAR(20) DEFAULT 'pending' 
  CHECK (shortlist_status IN ('pending', 'shortlisted', 'buffer', 'rejected', 'expired')),
ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id) ON DELETE CASCADE;

-- Update job_id for existing applications (derive from employer relationship)
-- This assumes applications are linked to jobs through employer_id
-- You may need to adjust this based on your actual data model

-- Add comment for documentation
COMMENT ON COLUMN applications.fit_score IS 'AI-computed score (0-100) measuring candidate-job alignment';
COMMENT ON COLUMN applications.rank IS 'Candidate rank position (1=highest)';
COMMENT ON COLUMN applications.summary IS 'AI-generated summary of candidate profile';
COMMENT ON COLUMN applications.shortlist_status IS 'Current shortlisting status';
COMMENT ON COLUMN applications.ai_processed IS 'Whether AI processing has completed';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_applications_fit_score ON applications(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_applications_shortlist_status ON applications(shortlist_status);
CREATE INDEX IF NOT EXISTS idx_applications_rank ON applications(rank);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);

-- ============================================================================
-- PART 3: Create Interviews Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  rank_at_time INTEGER NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  
  status VARCHAR(20) NOT NULL DEFAULT 'invitation_sent'
    CHECK (status IN ('invitation_sent', 'slot_pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'expired')),
  
  confirmation_deadline TIMESTAMP WITH TIME ZONE,
  slot_selection_deadline TIMESTAMP WITH TIME ZONE,
  
  calendar_event_id VARCHAR(255),
  calendar_sync_method VARCHAR(20) DEFAULT 'google' 
    CHECK (calendar_sync_method IN ('google', 'ics_fallback', 'manual')),
  no_show_risk FLOAT DEFAULT 0.5 CHECK (no_show_risk >= 0 AND no_show_risk <= 1),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE interviews IS 'Tracks interview invitations, scheduling, and outcomes';
COMMENT ON COLUMN interviews.rank_at_time IS 'Candidate rank when interview was created';
COMMENT ON COLUMN interviews.status IS 'Current interview status';
COMMENT ON COLUMN interviews.confirmation_deadline IS 'Deadline for candidate to accept/reject invitation';
COMMENT ON COLUMN interviews.slot_selection_deadline IS 'Deadline for candidate to select interview slot';
COMMENT ON COLUMN interviews.no_show_risk IS 'Predicted probability (0-1) of candidate not showing up';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_interviews_status ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_confirmation_deadline ON interviews(confirmation_deadline);
CREATE INDEX IF NOT EXISTS idx_interviews_slot_deadline ON interviews(slot_selection_deadline);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_time ON interviews(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_interviews_job ON interviews(job_id);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate ON interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_application ON interviews(application_id);

-- ============================================================================
-- PART 4: Create Automation Logs Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  trigger_source VARCHAR(20) NOT NULL DEFAULT 'auto' 
    CHECK (trigger_source IN ('auto', 'manual', 'scheduled')),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE automation_logs IS 'Audit trail for all automation actions';
COMMENT ON COLUMN automation_logs.action_type IS 'Type of action (e.g., buffer_promotion, invitation_sent)';
COMMENT ON COLUMN automation_logs.trigger_source IS 'What triggered the action (auto/manual/scheduled)';
COMMENT ON COLUMN automation_logs.details IS 'JSON details about the action';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_automation_logs_job ON automation_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_action ON automation_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_trigger ON automation_logs(trigger_source);

-- ============================================================================
-- PART 5: Create Feature Flags Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name VARCHAR(50) NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT FALSE,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE feature_flags IS 'Global feature flags for enabling/disabling automation features';

-- Insert default flags
INSERT INTO feature_flags (flag_name, enabled, description) VALUES
  ('global_automation', TRUE, 'Master switch for all automation features'),
  ('auto_shortlisting', TRUE, 'Automatic candidate shortlisting'),
  ('auto_promotion', TRUE, 'Automatic buffer promotion on dropouts'),
  ('negotiation_bot', TRUE, 'AI negotiation chatbot for slot conflicts'),
  ('no_show_prediction', TRUE, 'No-show risk scoring'),
  ('calendar_integration', TRUE, 'Google Calendar sync')
ON CONFLICT (flag_name) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(flag_name);

-- ============================================================================
-- PART 6: Create Negotiation Sessions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS negotiation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  round INTEGER DEFAULT 1,
  state VARCHAR(30) DEFAULT 'awaiting_availability'
    CHECK (state IN ('awaiting_availability', 'awaiting_selection', 'escalated', 'resolved')),
  history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE negotiation_sessions IS 'Tracks chatbot negotiation sessions for interview slot conflicts';
COMMENT ON COLUMN negotiation_sessions.round IS 'Current negotiation round (max 3 before escalation)';
COMMENT ON COLUMN negotiation_sessions.history IS 'JSON array of conversation messages';

-- Create index
CREATE INDEX IF NOT EXISTS idx_negotiation_interview ON negotiation_sessions(interview_id);

-- ============================================================================
-- PART 7: Create Calendar Tokens Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Add comments
COMMENT ON TABLE calendar_tokens IS 'Stores encrypted OAuth tokens for Google Calendar integration';
COMMENT ON COLUMN calendar_tokens.access_token IS 'Encrypted Google Calendar access token';
COMMENT ON COLUMN calendar_tokens.refresh_token IS 'Encrypted Google Calendar refresh token';

-- Create index
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_user ON calendar_tokens(user_id);

-- ============================================================================
-- PART 8: Enable Row Level Security for New Tables
-- ============================================================================

ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE negotiation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (service role bypass)
CREATE POLICY "Enable all access for service role" ON interviews FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON automation_logs FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON feature_flags FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON negotiation_sessions FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON calendar_tokens FOR ALL USING (true);

-- ============================================================================
-- PART 9: Create Updated At Trigger Function
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at column
CREATE TRIGGER update_interviews_updated_at
    BEFORE UPDATE ON interviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_negotiation_sessions_updated_at
    BEFORE UPDATE ON negotiation_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_tokens_updated_at
    BEFORE UPDATE ON calendar_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 001_add_ai_orchestrator_schema completed successfully';
END $$;
