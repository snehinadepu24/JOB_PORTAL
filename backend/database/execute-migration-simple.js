/**
 * Simple Migration Executor
 * 
 * This script reads the migration SQL file and executes it using Supabase client.
 * Note: Supabase client has limitations with complex SQL, so this may not work
 * for all statements. For production, use psql or Supabase CLI.
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '../config/config.env') });

import { supabase } from './supabaseClient.js';

async function executeMigration() {
  console.log('\n' + '='.repeat(70));
  console.log('Executing AI Hiring Orchestrator Migration');
  console.log('='.repeat(70) + '\n');

  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_add_ai_orchestrator_schema.up.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📝 Migration file loaded');
    console.log(`   File: ${migrationPath}`);
    console.log(`   Size: ${migrationSQL.length} characters\n`);

    // Split SQL into individual statements
    // This is a simple split - may not work for all SQL
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`📊 Found ${statements.length} SQL statements\n`);
    console.log('⚠️  Note: Supabase client has limitations with complex SQL.');
    console.log('   If this fails, please use Supabase SQL Editor or psql.\n');

    console.log('🚀 Executing migration...\n');

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < Math.min(statements.length, 10); i++) {
      const statement = statements[i];
      const preview = statement.substring(0, 60).replace(/\n/g, ' ');
      
      try {
        console.log(`   [${i + 1}/${statements.length}] ${preview}...`);
        
        // Execute using Supabase RPC or direct SQL
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.log(`      ❌ Error: ${error.message}`);
          errorCount++;
        } else {
          console.log(`      ✓ Success`);
          successCount++;
        }
      } catch (error) {
        console.log(`      ❌ Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('Migration Execution Summary');
    console.log('='.repeat(70));
    console.log(`✓ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log('='.repeat(70) + '\n');

    if (errorCount > 0) {
      console.log('⚠️  Some statements failed. This is expected with Supabase client.');
      console.log('   Please use one of these alternatives:\n');
      console.log('1. Supabase SQL Editor (Recommended):');
      console.log('   - Open Supabase Dashboard > SQL Editor');
      console.log('   - Copy entire migration file contents');
      console.log('   - Execute as a single query\n');
      console.log('2. Using psql:');
      console.log(`   psql $DATABASE_URL -f ${migrationPath}\n`);
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nPlease use Supabase SQL Editor or psql to run the migration manually.');
    process.exit(1);
  }
}

executeMigration();
