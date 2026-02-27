/**
 * Verify Gemini Feature Flags Migration
 * 
 * Checks that all three Gemini feature flags were created successfully.
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFeatureFlag, getAllFeatureFlags } from '../../utils/featureFlags.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.join(__dirname, '../../config/config.env') });

async function verifyMigration() {
  console.log('\n' + '='.repeat(70));
  console.log('Verifying Gemini Feature Flags Migration');
  console.log('='.repeat(70) + '\n');

  const expectedFlags = [
    'gemini_enabled',
    'gemini_parsing',
    'gemini_responses'
  ];

  let allPassed = true;

  for (const flagName of expectedFlags) {
    try {
      const flag = await getFeatureFlag(flagName);
      
      if (flag) {
        console.log(`✓ Flag '${flagName}' exists`);
        console.log(`  - Enabled: ${flag.enabled}`);
        console.log(`  - Description: ${flag.description}`);
        console.log(`  - ID: ${flag.id}\n`);
      } else {
        console.log(`❌ Flag '${flagName}' NOT FOUND\n`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ Error checking '${flagName}': ${error.message}\n`);
      allPassed = false;
    }
  }

  // Show all feature flags
  console.log('='.repeat(70));
  console.log('All Feature Flags in Database');
  console.log('='.repeat(70) + '\n');
  
  const allFlags = await getAllFeatureFlags();
  console.log(`Total flags: ${allFlags.length}\n`);
  
  allFlags.forEach(flag => {
    const status = flag.enabled ? '✓ ENABLED' : '○ DISABLED';
    console.log(`${status} ${flag.flag_name}`);
    if (flag.description) {
      console.log(`  ${flag.description}`);
    }
  });

  console.log('\n' + '='.repeat(70));
  if (allPassed) {
    console.log('✓ All Gemini feature flags verified successfully!');
  } else {
    console.log('❌ Verification failed - some flags are missing');
  }
  console.log('='.repeat(70) + '\n');

  return allPassed;
}

// Run verification
verifyMigration()
  .then((passed) => {
    process.exit(passed ? 0 : 1);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  });
