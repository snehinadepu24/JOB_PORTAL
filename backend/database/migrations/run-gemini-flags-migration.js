/**
 * Gemini Feature Flags Migration Runner
 * 
 * Adds three feature flags for Gemini LLM integration:
 * - gemini_enabled: Master flag for all Gemini features
 * - gemini_parsing: Enable Gemini-powered availability parsing
 * - gemini_responses: Enable Gemini-powered response generation
 * 
 * Usage:
 *   node backend/database/migrations/run-gemini-flags-migration.js
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createFeatureFlag, getFeatureFlag } from '../../utils/featureFlags.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '../../config/config.env') });

async function runMigration() {
  console.log('\n' + '='.repeat(70));
  console.log('Gemini Feature Flags Migration');
  console.log('='.repeat(70) + '\n');

  const flags = [
    {
      name: 'gemini_enabled',
      enabled: false,
      description: 'Master flag for all Gemini LLM features'
    },
    {
      name: 'gemini_parsing',
      enabled: false,
      description: 'Enable Gemini-powered availability parsing'
    },
    {
      name: 'gemini_responses',
      enabled: false,
      description: 'Enable Gemini-powered response generation'
    }
  ];

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const flag of flags) {
    try {
      // Check if flag already exists
      const existing = await getFeatureFlag(flag.name);
      
      if (existing) {
        console.log(`⏭️  Skipping '${flag.name}' - already exists`);
        skipCount++;
        continue;
      }

      // Create the flag
      const result = await createFeatureFlag(flag.name, flag.enabled, flag.description);
      
      if (result.success) {
        console.log(`✓ Created '${flag.name}' (enabled: ${flag.enabled})`);
        successCount++;
      } else {
        console.log(`❌ Failed to create '${flag.name}': ${result.error}`);
        errorCount++;
      }
    } catch (error) {
      console.log(`❌ Error creating '${flag.name}': ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('Migration Summary');
  console.log('='.repeat(70));
  console.log(`✓ Created: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log('='.repeat(70) + '\n');

  if (successCount > 0) {
    console.log('✓ Migration completed successfully!\n');
    console.log('The following flags are now available (all disabled by default):');
    console.log('  - gemini_enabled: Master flag for all Gemini features');
    console.log('  - gemini_parsing: Enable Gemini-powered availability parsing');
    console.log('  - gemini_responses: Enable Gemini-powered response generation\n');
    console.log('To enable these flags, use the feature flags API or update them directly in the database.\n');
  } else if (skipCount === flags.length) {
    console.log('✓ All flags already exist - no changes needed.\n');
  } else {
    console.log('⚠️  Migration completed with errors. Please check the output above.\n');
    process.exit(1);
  }
}

// Run the migration
runMigration()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  });
