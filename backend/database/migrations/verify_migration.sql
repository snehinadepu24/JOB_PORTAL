-- Migration Verification Script
-- Run this after applying the migration to verify all changes were applied correctly

\echo '============================================================'
\echo 'AI Hiring Orchestrator - Migration Verification'
\echo '============================================================'
\echo ''

-- Check 1: Verify Jobs table columns
\echo 'Check 1: Jobs table extensions'
\echo '------------------------------------------------------------'
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('number_of_openings', 'shortlisting_buffer', 'automation_enabled', 'applications_closed')
ORDER BY column_name;

\echo ''
\echo 'Expected: 4 columns (number_of_openings, shortlisting_buffer, automation_enabled, applications_closed)'
\echo ''

-- Check 2: Verify Applications table columns
\echo 'Check 2: Applications table extensions'
\echo '------------------------------------------------------------'
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'applications' 
AND column_name IN ('fit_score', 'rank', 'summary', 'shortlist_status', 'ai_processed', 'job_id')
ORDER BY column_name;

\echo ''
\echo 'Expected: 6 columns (fit_score, rank, summary, shortlist_status, ai_processed, job_id)'
\echo ''

-- Check 3: Verify new tables exist
\echo 'Check 3: New tables created'
\echo '------------------------------------------------------------'
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
AND table_name IN ('interviews', 'automation_logs', 'feature_flags', 'negotiation_sessions', 'calendar_tokens')
ORDER BY table_name;

\echo ''
\echo 'Expected: 5 tables (interviews, automation_logs, feature_flags, negotiation_sessions, calendar_tokens)'
\echo ''

-- Check 4: Verify indexes on applications
\echo 'Check 4: Applications table indexes'
\echo '------------------------------------------------------------'
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'applications'
AND indexname IN ('idx_applications_fit_score', 'idx_applications_shortlist_status', 'idx_applications_rank', 'idx_applications_job_id')
ORDER BY indexname;

\echo ''
\echo 'Expected: 4 indexes'
\echo ''

-- Check 5: Verify indexes on interviews
\echo 'Check 5: Interviews table indexes'
\echo '------------------------------------------------------------'
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'interviews'
ORDER BY indexname;

\echo ''
\echo 'Expected: 7 indexes (status, confirmation_deadline, slot_deadline, scheduled_time, job, candidate, application)'
\echo ''

-- Check 6: Verify feature flags
\echo 'Check 6: Feature flags data'
\echo '------------------------------------------------------------'
SELECT 
  flag_name,
  enabled,
  description
FROM feature_flags
ORDER BY flag_name;

\echo ''
\echo 'Expected: 6 feature flags'
\echo ''

-- Check 7: Verify triggers
\echo 'Check 7: Triggers created'
\echo '------------------------------------------------------------'
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%updated_at%'
AND event_object_table IN ('interviews', 'negotiation_sessions', 'calendar_tokens', 'feature_flags')
ORDER BY event_object_table, trigger_name;

\echo ''
\echo 'Expected: 4 triggers (one for each table with updated_at column)'
\echo ''

-- Check 8: Verify foreign key constraints
\echo 'Check 8: Foreign key constraints'
\echo '------------------------------------------------------------'
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name IN ('interviews', 'automation_logs', 'negotiation_sessions', 'calendar_tokens', 'applications')
ORDER BY tc.table_name, kcu.column_name;

\echo ''
\echo 'Expected: Multiple foreign key constraints'
\echo ''

-- Check 9: Verify RLS policies
\echo 'Check 9: Row Level Security policies'
\echo '------------------------------------------------------------'
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('interviews', 'automation_logs', 'feature_flags', 'negotiation_sessions', 'calendar_tokens')
ORDER BY tablename;

\echo ''
\echo 'Expected: 5 policies (one for each new table)'
\echo ''

-- Check 10: Verify table comments
\echo 'Check 10: Table and column comments'
\echo '------------------------------------------------------------'
SELECT 
  c.table_name,
  c.column_name,
  pgd.description
FROM pg_catalog.pg_statio_all_tables AS st
INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
INNER JOIN information_schema.columns c ON (
  pgd.objsubid = c.ordinal_position AND
  c.table_schema = st.schemaname AND
  c.table_name = st.relname
)
WHERE c.table_name IN ('jobs', 'applications', 'interviews', 'automation_logs', 'negotiation_sessions', 'calendar_tokens')
ORDER BY c.table_name, c.column_name;

\echo ''
\echo 'Expected: Multiple column comments for documentation'
\echo ''

-- Summary
\echo '============================================================'
\echo 'Verification Complete'
\echo '============================================================'
\echo ''
\echo 'Review the output above to ensure all checks passed.'
\echo 'If any checks show unexpected results, review the migration script.'
\echo ''
