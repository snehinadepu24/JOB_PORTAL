-- Rollback Migration: Remove AI Hiring Orchestrator Schema
-- Description: Safely removes all AI orchestrator tables and columns
-- WARNING: This will delete all automation data. Ensure you have backups!
-- Date: 2024

-- ============================================================================
-- PART 1: Drop Triggers
-- ============================================================================

DROP TRIGGER IF EXISTS update_interviews_updated_at ON interviews;
DROP TRIGGER IF EXISTS update_negotiation_sessions_updated_at ON negotiation_sessions;
DROP TRIGGER IF EXISTS update_calendar_tokens_updated_at ON calendar_tokens;
DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- ============================================================================
-- PART 2: Drop New Tables (in reverse dependency order)
-- ============================================================================

-- Drop negotiation_sessions (depends on interviews)
DROP TABLE IF EXISTS negotiation_sessions CASCADE;

-- Drop calendar_tokens (depends on users)
DROP TABLE IF EXISTS calendar_tokens CASCADE;

-- Drop automation_logs (depends on jobs and users)
DROP TABLE IF EXISTS automation_logs CASCADE;

-- Drop feature_flags (no dependencies)
DROP TABLE IF EXISTS feature_flags CASCADE;

-- Drop interviews (depends on applications, jobs, users)
DROP TABLE IF EXISTS interviews CASCADE;

-- ============================================================================
-- PART 3: Remove Indexes from Applications Table
-- ============================================================================

DROP INDEX IF EXISTS idx_applications_fit_score;
DROP INDEX IF EXISTS idx_applications_shortlist_status;
DROP INDEX IF EXISTS idx_applications_rank;
DROP INDEX IF EXISTS idx_applications_job_id;

-- ============================================================================
-- PART 4: Remove Columns from Applications Table
-- ============================================================================

ALTER TABLE applications
DROP COLUMN IF EXISTS fit_score,
DROP COLUMN IF EXISTS rank,
DROP COLUMN IF EXISTS summary,
DROP COLUMN IF EXISTS shortlist_status,
DROP COLUMN IF EXISTS ai_processed,
DROP COLUMN IF EXISTS job_id;

-- ============================================================================
-- PART 5: Remove Columns from Jobs Table
-- ============================================================================

ALTER TABLE jobs
DROP COLUMN IF EXISTS number_of_openings,
DROP COLUMN IF EXISTS shortlisting_buffer,
DROP COLUMN IF EXISTS automation_enabled,
DROP COLUMN IF EXISTS applications_closed;

-- ============================================================================
-- Rollback Complete
-- ============================================================================

-- Log rollback completion
DO $$
BEGIN
    RAISE NOTICE 'Rollback 001_add_ai_orchestrator_schema completed successfully';
    RAISE NOTICE 'All AI orchestrator tables and columns have been removed';
    RAISE WARNING 'All automation data has been deleted. Restore from backup if needed.';
END $$;
