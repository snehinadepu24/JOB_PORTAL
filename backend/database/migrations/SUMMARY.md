# Migration Summary: AI Hiring Orchestrator Database Schema

## Overview
This migration adds comprehensive database support for the AI Hiring Orchestrator feature, enabling automated resume processing, intelligent shortlisting, interview scheduling, and calendar integration.

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `001_add_ai_orchestrator_schema.up.sql` | Main migration (apply) | ~400 |
| `001_add_ai_orchestrator_schema.down.sql` | Rollback migration | ~100 |
| `verify_migration.sql` | Post-migration verification | ~200 |
| `README.md` | Detailed documentation | ~300 |
| `MIGRATION_GUIDE.md` | Quick start guide | ~400 |
| `test_migration_syntax.sh` | Syntax validation script | ~150 |
| `runMigration.js` | Node.js migration runner | ~200 |

## Schema Changes Summary

### Tables Created: 5

1. **interviews** (13 columns)
   - Primary key: `id` (UUID)
   - Foreign keys: `application_id`, `job_id`, `recruiter_id`, `candidate_id`
   - Key columns: `status`, `scheduled_time`, `confirmation_deadline`, `no_show_risk`
   - Indexes: 7

2. **automation_logs** (6 columns)
   - Primary key: `id` (UUID)
   - Foreign keys: `job_id`, `actor_id`
   - Key columns: `action_type`, `trigger_source`, `details` (JSONB)
   - Indexes: 4

3. **feature_flags** (5 columns)
   - Primary key: `id` (UUID)
   - Unique: `flag_name`
   - Key columns: `enabled`, `description`
   - Default data: 6 feature flags
   - Indexes: 1

4. **negotiation_sessions** (6 columns)
   - Primary key: `id` (UUID)
   - Foreign key: `interview_id`
   - Key columns: `round`, `state`, `history` (JSONB)
   - Indexes: 1

5. **calendar_tokens** (7 columns)
   - Primary key: `id` (UUID)
   - Foreign key: `user_id`
   - Unique: `user_id`
   - Key columns: `access_token`, `refresh_token` (encrypted)
   - Indexes: 1

### Tables Extended: 2

**jobs** - Added 4 columns:
- `number_of_openings` (INTEGER, NOT NULL, DEFAULT 1, CHECK >= 1)
- `shortlisting_buffer` (INTEGER, NOT NULL, DEFAULT 1, CHECK >= 1)
- `automation_enabled` (BOOLEAN, DEFAULT TRUE)
- `applications_closed` (BOOLEAN, DEFAULT FALSE)

**applications** - Added 6 columns:
- `fit_score` (FLOAT, DEFAULT 0, CHECK 0-100)
- `rank` (INTEGER, nullable)
- `summary` (TEXT, nullable)
- `shortlist_status` (VARCHAR(20), DEFAULT 'pending', CHECK enum)
- `ai_processed` (BOOLEAN, DEFAULT FALSE)
- `job_id` (UUID, FK to jobs)

### Indexes Created: 17

**Performance-critical indexes:**
- `idx_applications_fit_score` (DESC) - Fast ranking queries
- `idx_interviews_confirmation_deadline` - Deadline automation
- `idx_interviews_slot_deadline` - Slot deadline automation
- `idx_automation_logs_created` (DESC) - Recent activity logs

### Triggers Created: 4

Auto-update `updated_at` timestamp on:
- `interviews`
- `negotiation_sessions`
- `calendar_tokens`
- `feature_flags`

### Constraints Added

**Check Constraints:**
- Jobs: `number_of_openings >= 1`, `shortlisting_buffer >= 1`
- Applications: `fit_score >= 0 AND fit_score <= 100`
- Applications: `shortlist_status IN (pending, shortlisted, buffer, rejected, expired)`
- Interviews: `status IN (invitation_sent, slot_pending, confirmed, completed, cancelled, no_show, expired)`
- Interviews: `no_show_risk >= 0 AND no_show_risk <= 1`
- Automation logs: `trigger_source IN (auto, manual, scheduled)`
- Negotiation sessions: `state IN (awaiting_availability, awaiting_selection, escalated, resolved)`

**Foreign Key Constraints:**
- 14 foreign key relationships established
- All with appropriate ON DELETE actions (CASCADE or SET NULL)

**Unique Constraints:**
- `feature_flags.flag_name`
- `calendar_tokens.user_id`

## Requirements Coverage

This migration satisfies the following requirements from the spec:

### Requirement 10: Database Schema Extensions
- ✅ 10.1 - Add `number_of_openings` to jobs table
- ✅ 10.2 - Add `shortlisting_buffer` to jobs table
- ✅ 10.3 - Add `fit_score` to applications table
- ✅ 10.4 - Add `rank` to applications table
- ✅ 10.5 - Add `summary` to applications table
- ✅ 10.6 - Add `shortlist_status` to applications table
- ✅ 10.7 - Add `ai_processed` to applications table
- ✅ 10.8 - Create interviews table with all required columns
- ✅ 10.9 - Add interview tracking columns (deadlines, risk, etc.)
- ✅ 10.10 - Add calendar integration columns
- ✅ 10.11 - Create automation_logs table
- ✅ 10.12 - Create all performance indexes

### Requirement 12: Backward Compatibility
- ✅ 12.5 - Migration scripts add columns without dropping data
- ✅ 12.6 - Default values set for new columns on existing records
- ✅ 12.7 - Rollback capability provided

## Data Safety

### Backward Compatible
- ✅ All existing data preserved
- ✅ New columns have safe defaults
- ✅ No existing columns modified
- ✅ No data deletion in up migration

### Default Values
- Jobs: `number_of_openings = 1`, `shortlisting_buffer = 1`, `automation_enabled = TRUE`
- Applications: `fit_score = 0`, `shortlist_status = 'pending'`, `ai_processed = FALSE`
- Interviews: `status = 'invitation_sent'`, `no_show_risk = 0.5`

### Rollback Safety
- ⚠️ Down migration deletes all new tables and columns
- ⚠️ All automation data will be lost on rollback
- ✅ Rollback script uses CASCADE for clean removal
- ✅ Warning messages included in rollback script

## Performance Impact

### Positive Impacts
- 17 new indexes improve query performance
- Optimized for common query patterns (ranking, filtering, deadlines)
- JSONB columns for flexible data storage

### Considerations
- Initial migration may take 1-5 minutes on large databases
- Index creation is the slowest part
- Consider using `CONCURRENTLY` for large tables (requires separate execution)

### Recommended Post-Migration
```sql
-- Update statistics for query planner
ANALYZE jobs;
ANALYZE applications;
ANALYZE interviews;
ANALYZE automation_logs;
```

## Testing Checklist

Before production deployment:

- [ ] Test migration on staging database
- [ ] Verify all tables created
- [ ] Verify all columns added
- [ ] Verify all indexes created
- [ ] Run verification script
- [ ] Test rollback on staging
- [ ] Verify application code works with new schema
- [ ] Test automation workflows
- [ ] Monitor query performance
- [ ] Check database logs for errors

## Deployment Steps

1. **Pre-deployment**
   - [ ] Create database backup
   - [ ] Test on staging environment
   - [ ] Review migration files
   - [ ] Schedule maintenance window (if needed)

2. **Deployment**
   - [ ] Apply migration: `psql $DATABASE_URL -f 001_add_ai_orchestrator_schema.up.sql`
   - [ ] Verify migration: `psql $DATABASE_URL -f verify_migration.sql`
   - [ ] Check for errors in database logs
   - [ ] Test basic queries on new tables

3. **Post-deployment**
   - [ ] Run ANALYZE on all tables
   - [ ] Monitor query performance
   - [ ] Verify application functionality
   - [ ] Enable automation features gradually
   - [ ] Monitor automation logs

4. **Rollback (if needed)**
   - [ ] Stop all background processes
   - [ ] Export data to preserve (if any)
   - [ ] Run rollback: `psql $DATABASE_URL -f 001_add_ai_orchestrator_schema.down.sql`
   - [ ] Verify rollback completed
   - [ ] Restore from backup if needed

## Support and Documentation

- **Design Document**: `.kiro/specs/ai-hiring-orchestrator/design.md`
- **Requirements**: `.kiro/specs/ai-hiring-orchestrator/requirements.md`
- **Migration Guide**: `backend/database/migrations/MIGRATION_GUIDE.md`
- **README**: `backend/database/migrations/README.md`

## Migration Metadata

- **Migration ID**: 001
- **Feature**: AI Hiring Orchestrator
- **Type**: Schema Addition (Additive)
- **Breaking Changes**: None
- **Reversible**: Yes (with data loss)
- **Estimated Time**: 1-5 minutes
- **Database**: PostgreSQL 12+ / Supabase
- **Requirements**: 10.1-10.12, 12.5-12.7

## Success Criteria

Migration is successful when:
- ✅ All 5 new tables exist
- ✅ All 10 new columns added to existing tables
- ✅ All 17 indexes created
- ✅ All 4 triggers created
- ✅ 6 feature flags inserted
- ✅ All foreign keys established
- ✅ RLS policies enabled
- ✅ No errors in database logs
- ✅ Verification script passes all checks
- ✅ Application code can query new schema

## Notes

- Migration uses `IF NOT EXISTS` clauses for idempotency
- All timestamps use `TIMESTAMP WITH TIME ZONE` for timezone awareness
- JSONB used for flexible data storage (details, history)
- Comments added to tables and columns for documentation
- RLS policies use service role bypass (adjust for production security)
- Triggers automatically update `updated_at` timestamps
- Default feature flags enable all automation features
