-- ============================================================================
-- Migration: Add Gemini LLM Feature Flags
-- ============================================================================
-- Description: Adds three feature flags for Gemini LLM integration
-- Requirements: Gemini LLM Negotiation Integration - Requirement 9
-- ============================================================================

-- Insert Gemini feature flags
INSERT INTO feature_flags (flag_name, enabled, description) VALUES
  ('gemini_enabled', FALSE, 'Master flag for all Gemini LLM features'),
  ('gemini_parsing', FALSE, 'Enable Gemini-powered availability parsing'),
  ('gemini_responses', FALSE, 'Enable Gemini-powered response generation')
ON CONFLICT (flag_name) DO NOTHING;

-- Verify flags were inserted
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM feature_flags WHERE flag_name = 'gemini_enabled') THEN
    RAISE EXCEPTION 'Failed to insert gemini_enabled flag';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM feature_flags WHERE flag_name = 'gemini_parsing') THEN
    RAISE EXCEPTION 'Failed to insert gemini_parsing flag';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM feature_flags WHERE flag_name = 'gemini_responses') THEN
    RAISE EXCEPTION 'Failed to insert gemini_responses flag';
  END IF;
  RAISE NOTICE 'Successfully added 3 Gemini feature flags';
END $$;
