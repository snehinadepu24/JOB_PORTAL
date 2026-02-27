# Database Migrations

This directory contains database migration scripts for the AI Hiring Orchestrator feature.

## Migration Files

### 001_add_ai_orchestrator_schema

**Purpose:** Adds all database schema changes required for the AI Hiring Orchestrator feature.

**What it does:**
- Extends `jobs` table with automation fields (number_of_openings, shortlisting_buffer, automation_enabled, applications_closed)
- Extends `applications` table with AI processing fields (fit_score, rank, summary, shortlist_status, ai_processed, job_id)
- Creates `interviews` table for interview scheduling and tracking
- Creates `automation_logs` table for audit trail
- Creates `feature_flags` table for runtime feature control
- Creates `negotiation_sessions` table for chatbot negotiations
- Creates `calendar_tokens` table for Google Calendar OAuth tokens
- Adds all necessary indexes for performance
- Sets up Row Level Security (RLS) policies
- Creates triggers for automatic timestamp updates

**Requirements covered:** 10.1-10.12, 12.5-12.7

## How to Run Migrations

### Using psql (PostgreSQL CLI)

**Apply migration (up):**
```bash
psql -h <host> -U <user> -d <database> -f backend/database/migrations/001_add_ai_orchestrator_schema.up.sql
```

**Rollback migration (down):**
```bash
psql -h <host> -U <user> -d <database> -f backend/database/migrations/001_add_ai_orchestrator_schema.down.sql
```

### Using Supabase CLI

**Apply migration:**
```bash
supabase db push --file backend/database/migrations/001_add_ai_orchestrator_schema.up.sql
```

**Rollback migration:**
```bash
supabase db push --file backend/database/migrations/001_add_ai_orchestrator_schema.down.sql
```

### Using Node.js Script

Create a migration runner script:

```javascript
// backend/database/runMigration.js
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration(direction = 'up') {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    const migrationFile = path.join(
      __dirname,
      'migrations',
      `001_add_ai_orchestrator_schema.${direction}.sql`
    );
    
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log(`Running migration: ${direction}...`);
    await pool.query(sql);
    console.log(`Migration ${direction} completed successfully!`);
  } catch (error) {
    console.error(`Migration ${direction} failed:`, error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run with: node backend/database/runMigration.js up
// Rollback with: node backend/database/runMigration.js down
const direction = process.argv[2] || 'up';
runMigration(direction);
```

Then run:
```bash
# Apply migration
node backend/database/runMigration.js up

# Rollback migration
node backend/database/runMigration.js down
```

## Migration Safety

### Before Running Migration

1. **Backup your database:**
   ```bash
   pg_dump -h <host> -U <user> -d <database> > backup_before_migration.sql
   ```

2. **Test on staging environment first**

3. **Review the migration SQL file** to understand what changes will be made

4. **Check for existing data conflicts** - ensure no existing columns have the same names

### After Running Migration

1. **Verify tables were created:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('interviews', 'automation_logs', 'feature_flags', 'negotiation_sessions', 'calendar_tokens');
   ```

2. **Verify columns were added:**
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'jobs' 
   AND column_name IN ('number_of_openings', 'shortlisting_buffer', 'automation_enabled', 'applications_closed');
   
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'applications' 
   AND column_name IN ('fit_score', 'rank', 'summary', 'shortlist_status', 'ai_processed', 'job_id');
   ```

3. **Verify indexes were created:**
   ```sql
   SELECT indexname 
   FROM pg_indexes 
   WHERE tablename IN ('applications', 'interviews', 'automation_logs');
   ```

4. **Check feature flags were inserted:**
   ```sql
   SELECT flag_name, enabled FROM feature_flags;
   ```

## Rollback Considerations

⚠️ **WARNING:** Rolling back the migration will:
- Delete all interviews data
- Delete all automation logs
- Delete all negotiation sessions
- Delete all calendar tokens
- Remove AI processing data from applications (fit_score, rank, summary, etc.)
- Remove automation settings from jobs

**Before rollback:**
1. Export any data you want to preserve
2. Notify users that automation features will be disabled
3. Ensure no active background processes are running

**After rollback:**
1. Verify all new tables are removed
2. Verify applications and jobs tables are back to original schema
3. Test existing functionality still works

## Schema Overview

### New Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `interviews` | Track interview invitations and scheduling | status, confirmation_deadline, scheduled_time, no_show_risk |
| `automation_logs` | Audit trail for all automation actions | action_type, trigger_source, details (JSONB) |
| `feature_flags` | Runtime feature toggles | flag_name, enabled |
| `negotiation_sessions` | Chatbot negotiation conversations | interview_id, round, state, history (JSONB) |
| `calendar_tokens` | OAuth tokens for calendar integration | user_id, access_token, refresh_token (encrypted) |

### Extended Tables

**jobs:**
- `number_of_openings` - Maximum candidates to shortlist
- `shortlisting_buffer` - Number of buffer candidates
- `automation_enabled` - Enable/disable automation per job
- `applications_closed` - Whether ranking can begin

**applications:**
- `fit_score` - AI-computed score (0-100)
- `rank` - Candidate rank position
- `summary` - AI-generated profile summary
- `shortlist_status` - Current status (pending/shortlisted/buffer/rejected/expired)
- `ai_processed` - Whether AI processing completed
- `job_id` - Foreign key to jobs table

## Performance Indexes

All critical query paths are indexed:
- Applications: fit_score (DESC), shortlist_status, rank, job_id
- Interviews: status, confirmation_deadline, slot_selection_deadline, scheduled_time, job_id, candidate_id
- Automation logs: job_id, action_type, created_at (DESC), trigger_source

## Troubleshooting

### Migration fails with "column already exists"
The migration uses `IF NOT EXISTS` clauses, so it should be idempotent. If you still get this error, check if a partial migration was applied.

### Migration fails with "relation does not exist"
Ensure the base schema (users, jobs, applications tables) exists before running this migration.

### Rollback fails with "cannot drop table because other objects depend on it"
The rollback uses `CASCADE` to handle dependencies. If it still fails, manually drop dependent objects first.

### Performance issues after migration
Run `ANALYZE` on all tables to update query planner statistics:
```sql
ANALYZE jobs;
ANALYZE applications;
ANALYZE interviews;
ANALYZE automation_logs;
```

## Support

For issues or questions about migrations:
1. Check the design document: `.kiro/specs/ai-hiring-orchestrator/design.md`
2. Review requirements: `.kiro/specs/ai-hiring-orchestrator/requirements.md`
3. Check database logs for detailed error messages
