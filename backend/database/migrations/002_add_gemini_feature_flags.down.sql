-- ============================================================================
-- Migration Rollback: Remove Gemini LLM Feature Flags
-- ============================================================================
-- Description: Removes the three Gemini LLM feature flags
-- ============================================================================

-- Remove Gemini feature flags
DELETE FROM feature_flags WHERE flag_name IN (
  'gemini_enabled',
  'gemini_parsing',
  'gemini_responses'
);

-- Verify flags were removed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM feature_flags WHERE flag_name IN ('gemini_enabled', 'gemini_parsing', 'gemini_responses')) THEN
    RAISE EXCEPTION 'Failed to remove Gemini feature flags';
  END IF;
  RAISE NOTICE 'Successfully removed Gemini feature flags';
END $$;
