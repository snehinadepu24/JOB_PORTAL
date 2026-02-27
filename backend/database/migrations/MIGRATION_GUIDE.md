# AI Hiring Orchestrator - Migration Guide

## Quick Start

### Prerequisites
- PostgreSQL database (or Supabase)
- Database backup completed
- Admin/superuser database access

### Apply Migration (3 Options)

#### Option 1: Using psql (Recommended)
```bash
# Set your database connection string
export DATABASE_URL="postgresql://user:password@host:port/database"

# Apply migration
psql $DATABASE_URL -f backend/database/migrations/001_add_ai_orchestrator_schema.up.sql

# Verify migration
psql $DATABASE_URL -f backend/database/migrations/verify_migration.sql
```

#### Option 2: Using Supabase CLI
```bash
# Apply migration
supabase db push --file backend/database/migrations/001_add_ai_orchestrator_schema.up.sql

# Or use Supabase migrations
supabase migration new add_ai_orchestrator_schema
# Copy content from 001_add_ai_orchestrator_schema.up.sql
supabase db push
```

#### Option 3: Using Supabase Dashboard
1. Go to Supabase Dashboard → SQL Editor
2. Open `backend/database/migrations/001_add_ai_orchestrator_schema.up.sql`
3. Copy the entire content
4. Paste into SQL Editor
5. Click "Run"

### Rollback Migration

⚠️ **WARNING: This will delete all automation data!**

```bash
# Using psql
psql $DATABASE_URL -f backend/database/migrations/001_add_ai_orchestrator_schema.down.sql

# Using Supabase CLI
supabase db push --file backend/database/migrations/001_add_ai_orchestrator_schema.down.sql
```

## What Gets Created

### New Tables (5)

1. **interviews** - Interview scheduling and tracking
   - Tracks invitation status, deadlines, scheduled times
   - Links applications to interview slots
   - Stores no-show risk predictions

2. **automation_logs** - Audit trail for all automation
   - Records every automated action
   - Tracks who/what triggered actions
   - Stores detailed context in JSONB

3. **feature_flags** - Runtime feature toggles
   - Enable/disable features globally
   - Control automation behavior
   - 6 default flags included

4. **negotiation_sessions** - Chatbot conversations
   - Tracks slot negotiation rounds
   - Stores conversation history
   - Manages escalation to recruiters

5. **calendar_tokens** - OAuth tokens for calendar sync
   - Stores encrypted Google Calendar tokens
   - One token set per user
   - Handles token refresh

### Extended Tables (2)

**jobs** - Added 4 columns:
- `number_of_openings` - Max candidates to shortlist
- `shortlisting_buffer` - Buffer pool size
- `automation_enabled` - Per-job automation toggle
- `applications_closed` - Ranking trigger flag

**applications** - Added 6 columns:
- `fit_score` - AI score (0-100)
- `rank` - Candidate position
- `summary` - AI-generated summary
- `shortlist_status` - Current status
- `ai_processed` - Processing completion flag
- `job_id` - Link to job (for better queries)

### Indexes Created (17)

**Applications:**
- `idx_applications_fit_score` (DESC) - Fast ranking queries
- `idx_applications_shortlist_status` - Filter by status
- `idx_applications_rank` - Order by rank
- `idx_applications_job_id` - Join with jobs

**Interviews:**
- `idx_interviews_status` - Filter by status
- `idx_interviews_confirmation_deadline` - Deadline checks
- `idx_interviews_slot_deadline` - Slot deadline checks
- `idx_interviews_scheduled_time` - Time-based queries
- `idx_interviews_job` - Job-based queries
- `idx_interviews_candidate` - Candidate-based queries
- `idx_interviews_application` - Application lookup

**Automation Logs:**
- `idx_automation_logs_job` - Job-based logs
- `idx_automation_logs_action` - Filter by action type
- `idx_automation_logs_created` (DESC) - Recent logs first
- `idx_automation_logs_trigger` - Filter by trigger source

**Others:**
- `idx_feature_flags_name` - Fast flag lookups
- `idx_negotiation_interview` - Interview negotiations
- `idx_calendar_tokens_user` - User token lookup

## Verification Checklist

After running the migration, verify:

- [ ] All 5 new tables exist
- [ ] Jobs table has 4 new columns
- [ ] Applications table has 6 new columns
- [ ] All 17 indexes are created
- [ ] 6 feature flags are inserted
- [ ] 4 triggers are created (updated_at)
- [ ] RLS policies are enabled
- [ ] Foreign key constraints are in place

Run the verification script:
```bash
psql $DATABASE_URL -f backend/database/migrations/verify_migration.sql
```

## Common Issues

### Issue: "column already exists"
**Cause:** Migration was partially applied before
**Solution:** 
1. Check which columns exist
2. Either complete the migration manually or rollback and reapply

### Issue: "relation does not exist"
**Cause:** Base schema (users, jobs, applications) not created
**Solution:** Run base schema first: `backend/database/schema.sql`

### Issue: "permission denied"
**Cause:** Insufficient database privileges
**Solution:** Use superuser or service role key for Supabase

### Issue: Migration is slow
**Cause:** Large existing dataset
**Solution:** 
1. Run during low-traffic period
2. Consider adding indexes after data migration
3. Use `CONCURRENTLY` for index creation (requires separate statements)

## Performance Considerations

### For Large Databases (>100k applications)

1. **Add indexes concurrently** (after migration):
```sql
CREATE INDEX CONCURRENTLY idx_applications_fit_score ON applications(fit_score DESC);
```

2. **Analyze tables** after migration:
```sql
ANALYZE jobs;
ANALYZE applications;
ANALYZE interviews;
```

3. **Monitor query performance**:
```sql
-- Check slow queries
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%applications%' 
ORDER BY mean_exec_time DESC 
LIMIT 10;
```

## Data Migration Notes

### Existing Jobs
- All existing jobs get `number_of_openings = 1` (default)
- `shortlisting_buffer` is set equal to `number_of_openings`
- `automation_enabled = TRUE` (can be changed per job)
- `applications_closed = FALSE` (must be set to start automation)

### Existing Applications
- All get `fit_score = 0` (will be updated by AI processing)
- `shortlist_status = 'pending'` (default state)
- `ai_processed = FALSE` (will be set after processing)
- `rank = NULL` (will be assigned during shortlisting)

### No Data Loss
- All existing data is preserved
- Only new columns are added with safe defaults
- No existing columns are modified or dropped

## Rollback Impact

Rolling back will **permanently delete**:
- All interview records and scheduling data
- All automation logs and audit trail
- All negotiation session history
- All calendar OAuth tokens
- All AI processing results (fit_scores, summaries, ranks)
- All shortlisting status information

**Before rollback:**
1. Export data you want to keep:
```sql
-- Export interviews
COPY interviews TO '/tmp/interviews_backup.csv' CSV HEADER;

-- Export automation logs
COPY automation_logs TO '/tmp/automation_logs_backup.csv' CSV HEADER;
```

2. Notify users that automation will be disabled

3. Stop all background processes

## Next Steps After Migration

1. **Update application code** to use new schema
2. **Configure feature flags** as needed
3. **Set up background scheduler** (cron job)
4. **Configure Google Calendar OAuth** for recruiters
5. **Test automation workflow** on staging
6. **Enable automation** for pilot jobs first
7. **Monitor automation logs** for issues

## Support

For issues:
1. Check migration logs for errors
2. Review verification script output
3. Check database logs: `SELECT * FROM pg_stat_activity;`
4. Consult design document: `.kiro/specs/ai-hiring-orchestrator/design.md`

## Migration Metadata

- **Migration ID:** 001
- **Feature:** AI Hiring Orchestrator
- **Requirements:** 10.1-10.12, 12.5-12.7
- **Estimated Time:** 1-5 minutes (depends on data size)
- **Reversible:** Yes (with data loss)
- **Breaking Changes:** No (backward compatible)
