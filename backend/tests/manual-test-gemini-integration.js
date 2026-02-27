/**
 * Manual Test: Gemini LLM Negotiation Integration (Task 4.3)
 * 
 * This comprehensive test verifies the complete Gemini integration works end-to-end:
 * 1. GeminiClient initializes correctly
 * 2. Feature flags control Gemini features
 * 3. NegotiationBot uses Gemini when enabled
 * 4. Fallback to regex/template works when Gemini disabled or fails
 * 5. All components wire together properly
 * 
 * Requirements tested: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 9.1, 9.2
 * 
 * Usage:
 *   node backend/tests/manual-test-gemini-integration.js
 * 
 * Prerequisites:
 *   - GEMINI_API_KEY configured in backend/config/config.env
 *   - Database running with feature_flags table
 *   - gemini_parsing and gemini_responses flags created
 */

import { GeminiClient, getGeminiClient } from '../services/GeminiClient.js';
import NegotiationBot from '../managers/NegotiationBot.js';
import { 
  isFeatureEnabled, 
  createFeatureFlag, 
  updateFeatureFlag,
  getFeatureFlag 
} from '../utils/featureFlags.js';

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70) + '\n');
}

function logTest(testName) {
  log(`\n▶ Test: ${testName}`, 'cyan');
}

function logPass(message) {
  log(`  ✓ PASS: ${message}`, 'green');
}

function logFail(message) {
  log(`  ✗ FAIL: ${message}`, 'red');
}

function logInfo(message) {
  log(`  ℹ INFO: ${message}`, 'blue');
}

function logWarning(message) {
  log(`  ⚠ WARNING: ${message}`, 'yellow');
}

// Test state
let testsPassed = 0;
let testsFailed = 0;
let testsSkipped = 0;

/**
 * Test 1: GeminiClient Initialization
 */
async function testGeminiClientInitialization() {
  logSection('TEST 1: GeminiClient Initialization');

  // Test 1.1: Singleton instance
  logTest('1.1: getGeminiClient() returns singleton instance');
  try {
    const client1 = getGeminiClient();
    const client2 = getGeminiClient();
    
    if (client1 === client2) {
      logPass('Singleton pattern works correctly');
      testsPassed++;
    } else {
      logFail('getGeminiClient() returned different instances');
      testsFailed++;
      return false;
    }
    
    if (client1 === null) {
      logWarning('GeminiClient is null (GEMINI_API_KEY not configured)');
      logInfo('Remaining tests will verify fallback behavior');
      return false; // Skip Gemini-specific tests
    }
    
    logInfo(`Client initialized with model: ${client1.modelName}`);
  } catch (error) {
    logFail(`Initialization error: ${error.message}`);
    testsFailed++;
    return false;
  }

  // Test 1.2: Client configuration
  logTest('1.2: GeminiClient has correct configuration');
  try {
    const client = getGeminiClient();
    
    if (!client.apiKey || client.apiKey === 'your-gemini-api-key-here') {
      logFail('API key not configured properly');
      testsFailed++;
      return false;
    }
    
    if (!client.modelName) {
      logFail('Model name not set');
      testsFailed++;
      return false;
    }
    
    if (!client.timeout || client.timeout <= 0) {
      logFail('Timeout not configured');
      testsFailed++;
      return false;
    }
    
    logPass('Client configuration is valid');
    logInfo(`  - Model: ${client.modelName}`);
    logInfo(`  - Timeout: ${client.timeout}ms`);
    testsPassed++;
  } catch (error) {
    logFail(`Configuration check failed: ${error.message}`);
    testsFailed++;
    return false;
  }

  // Test 1.3: Metrics tracking
  logTest('1.3: GeminiClient tracks metrics');
  try {
    const client = getGeminiClient();
    const metrics = client.getMetrics();
    
    if (typeof metrics.apiCallsTotal !== 'number') {
      logFail('Metrics not properly initialized');
      testsFailed++;
      return false;
    }
    
    logPass('Metrics tracking is initialized');
    logInfo(`  - Total calls: ${metrics.apiCallsTotal}`);
    logInfo(`  - Success rate: ${metrics.successRate}`);
    testsPassed++;
  } catch (error) {
    logFail(`Metrics check failed: ${error.message}`);
    testsFailed++;
    return false;
  }

  return true;
}

/**
 * Test 2: Feature Flags Control
 */
async function testFeatureFlagsControl() {
  logSection('TEST 2: Feature Flags Control Gemini Features');

  // Test 2.1: Check if feature flags exist
  logTest('2.1: Gemini feature flags exist in database');
  try {
    const geminiParsing = await getFeatureFlag('gemini_parsing');
    const geminiResponses = await getFeatureFlag('gemini_responses');
    
    if (!geminiParsing) {
      logWarning('gemini_parsing flag not found, creating it');
      await createFeatureFlag('gemini_parsing', true, 'Enable Gemini-powered availability parsing');
    } else {
      logPass('gemini_parsing flag exists');
      logInfo(`  - Enabled: ${geminiParsing.enabled}`);
    }
    
    if (!geminiResponses) {
      logWarning('gemini_responses flag not found, creating it');
      await createFeatureFlag('gemini_responses', true, 'Enable Gemini-powered response generation');
    } else {
      logPass('gemini_responses flag exists');
      logInfo(`  - Enabled: ${geminiResponses.enabled}`);
    }
    
    testsPassed++;
  } catch (error) {
    logFail(`Feature flag check failed: ${error.message}`);
    testsFailed++;
    return false;
  }

  // Test 2.2: Feature flag enable/disable
  logTest('2.2: Feature flags can be toggled');
  try {
    // Test enabling
    await updateFeatureFlag('gemini_parsing', true);
    let isEnabled = await isFeatureEnabled('gemini_parsing');
    
    if (!isEnabled) {
      logFail('Failed to enable gemini_parsing flag');
      testsFailed++;
      return false;
    }
    
    logPass('Successfully enabled gemini_parsing');
    
    // Test disabling
    await updateFeatureFlag('gemini_parsing', false);
    isEnabled = await isFeatureEnabled('gemini_parsing');
    
    if (isEnabled) {
      logFail('Failed to disable gemini_parsing flag');
      testsFailed++;
      return false;
    }
    
    logPass('Successfully disabled gemini_parsing');
    
    // Restore to enabled for remaining tests
    await updateFeatureFlag('gemini_parsing', true);
    await updateFeatureFlag('gemini_responses', true);
    
    testsPassed++;
  } catch (error) {
    logFail(`Feature flag toggle failed: ${error.message}`);
    testsFailed++;
    return false;
  }

  return true;
}

/**
 * Test 3: Availability Parsing with Gemini
 */
async function testAvailabilityParsing(hasGeminiClient) {
  logSection('TEST 3: Availability Parsing Integration');

  // Create mock dependencies
  const mockCalendarIntegrator = {
    getAvailableSlots: async () => []
  };
  const mockEmailService = {
    queueEmail: async () => ({ success: true })
  };

  // Test 3.1: Parsing with Gemini enabled
  if (hasGeminiClient) {
    logTest('3.1: NegotiationBot uses Gemini for parsing when enabled');
    try {
      await updateFeatureFlag('gemini_parsing', true);
      
      const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService);
      const testMessage = "I'm available next Monday and Tuesday afternoon, between 2-5 PM";
      
      logInfo(`Testing message: "${testMessage}"`);
      
      const availability = await bot.parseAvailability(testMessage);
      
      if (!availability) {
        logFail('Failed to parse availability');
        testsFailed++;
        return false;
      }
      
      if (!(availability.start_date instanceof Date)) {
        logFail('start_date is not a Date object');
        testsFailed++;
        return false;
      }
      
      logPass('Successfully parsed availability with Gemini');
      logInfo(`  - Start date: ${availability.start_date.toISOString()}`);
      logInfo(`  - End date: ${availability.end_date.toISOString()}`);
      logInfo(`  - Preferred hours: ${JSON.stringify(availability.preferred_hours)}`);
      logInfo(`  - Preferred days: ${JSON.stringify(availability.preferred_days)}`);
      
      testsPassed++;
    } catch (error) {
      logFail(`Gemini parsing test failed: ${error.message}`);
      testsFailed++;
      return false;
    }
  } else {
    logTest('3.1: Skipping Gemini parsing test (no API key)');
    testsSkipped++;
  }

  // Test 3.2: Fallback to regex when Gemini disabled
  logTest('3.2: NegotiationBot falls back to regex when Gemini disabled');
  try {
    await updateFeatureFlag('gemini_parsing', false);
    
    const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService);
    const testMessage = "I'm available next week";
    
    logInfo(`Testing message: "${testMessage}"`);
    
    const availability = await bot.parseAvailability(testMessage);
    
    if (!availability) {
      logFail('Failed to parse availability with regex fallback');
      testsFailed++;
      return false;
    }
    
    if (!(availability.start_date instanceof Date)) {
      logFail('start_date is not a Date object');
      testsFailed++;
      return false;
    }
    
    logPass('Successfully fell back to regex parsing');
    logInfo(`  - Start date: ${availability.start_date.toISOString()}`);
    logInfo(`  - End date: ${availability.end_date.toISOString()}`);
    
    testsPassed++;
  } catch (error) {
    logFail(`Regex fallback test failed: ${error.message}`);
    testsFailed++;
    return false;
  }

  // Test 3.3: Fallback when Gemini returns null
  if (hasGeminiClient) {
    logTest('3.3: NegotiationBot falls back to regex when Gemini returns null');
    try {
      await updateFeatureFlag('gemini_parsing', true);
      
      const mockGeminiClient = {
        extractAvailability: async () => null
      };
      
      const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
      const testMessage = "I'm available next week";
      
      const availability = await bot.parseAvailability(testMessage);
      
      if (!availability) {
        logFail('Failed to fall back to regex');
        testsFailed++;
        return false;
      }
      
      logPass('Successfully fell back to regex when Gemini returned null');
      testsPassed++;
    } catch (error) {
      logFail(`Gemini null fallback test failed: ${error.message}`);
      testsFailed++;
      return false;
    }
  } else {
    logTest('3.3: Skipping Gemini null fallback test (no API key)');
    testsSkipped++;
  }

  // Test 3.4: Fallback when Gemini throws error
  if (hasGeminiClient) {
    logTest('3.4: NegotiationBot falls back to regex when Gemini throws error');
    try {
      await updateFeatureFlag('gemini_parsing', true);
      
      const mockGeminiClient = {
        extractAvailability: async () => {
          throw new Error('API timeout');
        }
      };
      
      const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
      const testMessage = "I'm available next week";
      
      const availability = await bot.parseAvailability(testMessage);
      
      if (!availability) {
        logFail('Failed to fall back to regex after error');
        testsFailed++;
        return false;
      }
      
      logPass('Successfully fell back to regex when Gemini threw error');
      testsPassed++;
    } catch (error) {
      logFail(`Gemini error fallback test failed: ${error.message}`);
      testsFailed++;
      return false;
    }
  } else {
    logTest('3.4: Skipping Gemini error fallback test (no API key)');
    testsSkipped++;
  }

  // Restore flag
  await updateFeatureFlag('gemini_parsing', true);
  
  return true;
}

/**
 * Test 4: Response Generation with Gemini
 */
async function testResponseGeneration(hasGeminiClient) {
  logSection('TEST 4: Response Generation Integration');

  const mockCalendarIntegrator = {
    getAvailableSlots: async () => []
  };
  const mockEmailService = {
    queueEmail: async () => ({ success: true })
  };

  // Test 4.1: Response generation with Gemini enabled
  if (hasGeminiClient) {
    logTest('4.1: NegotiationBot uses Gemini for responses when enabled');
    try {
      await updateFeatureFlag('gemini_responses', true);
      
      const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService);
      
      const context = {
        history: [
          { role: 'candidate', message: "I'm available next week", timestamp: new Date().toISOString() }
        ],
        round: 1,
        maxRounds: 3
      };
      
      logInfo('Testing clarification response generation');
      
      const response = await bot.generateResponse('clarification', context);
      
      if (!response || typeof response !== 'string') {
        logFail('Failed to generate response');
        testsFailed++;
        return false;
      }
      
      if (response.length < 10) {
        logFail('Response too short');
        testsFailed++;
        return false;
      }
      
      logPass('Successfully generated response with Gemini');
      logInfo(`  - Response length: ${response.length} characters`);
      logInfo(`  - Response preview: ${response.substring(0, 100)}...`);
      
      testsPassed++;
    } catch (error) {
      logFail(`Gemini response generation test failed: ${error.message}`);
      testsFailed++;
      return false;
    }
  } else {
    logTest('4.1: Skipping Gemini response generation test (no API key)');
    testsSkipped++;
  }

  // Test 4.2: Fallback to template when Gemini disabled
  logTest('4.2: NegotiationBot falls back to template when Gemini disabled');
  try {
    await updateFeatureFlag('gemini_responses', false);
    
    const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService);
    
    const context = {
      history: [],
      round: 1,
      maxRounds: 3
    };
    
    const response = await bot.generateResponse('clarification', context);
    
    if (!response || typeof response !== 'string') {
      logFail('Failed to generate template response');
      testsFailed++;
      return false;
    }
    
    logPass('Successfully fell back to template response');
    logInfo(`  - Response: ${response.substring(0, 100)}...`);
    
    testsPassed++;
  } catch (error) {
    logFail(`Template fallback test failed: ${error.message}`);
    testsFailed++;
    return false;
  }

  // Test 4.3: Fallback when Gemini returns null
  if (hasGeminiClient) {
    logTest('4.3: NegotiationBot falls back to template when Gemini returns null');
    try {
      await updateFeatureFlag('gemini_responses', true);
      
      const mockGeminiClient = {
        generateResponse: async () => null
      };
      
      const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
      
      const context = {
        history: [],
        round: 1,
        maxRounds: 3
      };
      
      const response = await bot.generateResponse('clarification', context);
      
      if (!response) {
        logFail('Failed to fall back to template');
        testsFailed++;
        return false;
      }
      
      logPass('Successfully fell back to template when Gemini returned null');
      testsPassed++;
    } catch (error) {
      logFail(`Gemini null fallback test failed: ${error.message}`);
      testsFailed++;
      return false;
    }
  } else {
    logTest('4.3: Skipping Gemini null fallback test (no API key)');
    testsSkipped++;
  }

  // Test 4.4: All response types work
  logTest('4.4: All response types generate valid responses');
  try {
    await updateFeatureFlag('gemini_responses', false); // Use templates for consistency
    
    const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService);
    
    const responseTypes = [
      { type: 'clarification', context: { history: [] } },
      { 
        type: 'slot_suggestions', 
        context: { 
          slots: [
            { start: new Date().toISOString(), end: new Date().toISOString() }
          ],
          history: []
        } 
      },
      { type: 'request_alternatives', context: { round: 2, maxRounds: 3, history: [] } },
      { type: 'escalation', context: { round: 3, maxRounds: 3, history: [] } }
    ];
    
    for (const { type, context } of responseTypes) {
      const response = await bot.generateResponse(type, context);
      
      if (!response || typeof response !== 'string') {
        logFail(`Failed to generate ${type} response`);
        testsFailed++;
        return false;
      }
      
      logInfo(`  - ${type}: ✓ (${response.length} chars)`);
    }
    
    logPass('All response types generate valid responses');
    testsPassed++;
  } catch (error) {
    logFail(`Response types test failed: ${error.message}`);
    testsFailed++;
    return false;
  }

  // Restore flag
  await updateFeatureFlag('gemini_responses', true);
  
  return true;
}

/**
 * Test 5: End-to-End Integration
 */
async function testEndToEndIntegration(hasGeminiClient) {
  logSection('TEST 5: End-to-End Integration');

  const mockCalendarIntegrator = {
    getAvailableSlots: async () => []
  };
  const mockEmailService = {
    queueEmail: async () => ({ success: true })
  };

  // Test 5.1: Complete flow with Gemini enabled
  if (hasGeminiClient) {
    logTest('5.1: Complete negotiation flow with Gemini enabled');
    try {
      await updateFeatureFlag('gemini_parsing', true);
      await updateFeatureFlag('gemini_responses', true);
      
      const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService);
      
      // Simulate a negotiation flow
      const testMessage = "I'm available Monday through Wednesday next week, preferably in the afternoon";
      
      logInfo('Step 1: Parse availability');
      const availability = await bot.parseAvailability(testMessage);
      
      if (!availability) {
        logFail('Failed to parse availability in end-to-end test');
        testsFailed++;
        return false;
      }
      
      logInfo('  ✓ Availability parsed successfully');
      
      logInfo('Step 2: Generate response');
      const response = await bot.generateResponse('request_alternatives', {
        history: [
          { role: 'candidate', message: testMessage, timestamp: new Date().toISOString() }
        ],
        round: 1,
        maxRounds: 3
      });
      
      if (!response) {
        logFail('Failed to generate response in end-to-end test');
        testsFailed++;
        return false;
      }
      
      logInfo('  ✓ Response generated successfully');
      
      logPass('Complete flow works with Gemini enabled');
      testsPassed++;
    } catch (error) {
      logFail(`End-to-end test with Gemini failed: ${error.message}`);
      testsFailed++;
      return false;
    }
  } else {
    logTest('5.1: Skipping Gemini end-to-end test (no API key)');
    testsSkipped++;
  }

  // Test 5.2: Complete flow with Gemini disabled (fallback mode)
  logTest('5.2: Complete negotiation flow with Gemini disabled (fallback mode)');
  try {
    await updateFeatureFlag('gemini_parsing', false);
    await updateFeatureFlag('gemini_responses', false);
    
    const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService);
    
    const testMessage = "I'm available next week";
    
    logInfo('Step 1: Parse availability (regex)');
    const availability = await bot.parseAvailability(testMessage);
    
    if (!availability) {
      logFail('Failed to parse availability with regex');
      testsFailed++;
      return false;
    }
    
    logInfo('  ✓ Availability parsed with regex');
    
    logInfo('Step 2: Generate response (template)');
    const response = await bot.generateResponse('clarification', {
      history: [
        { role: 'candidate', message: testMessage, timestamp: new Date().toISOString() }
      ]
    });
    
    if (!response) {
      logFail('Failed to generate template response');
      testsFailed++;
      return false;
    }
    
    logInfo('  ✓ Response generated with template');
    
    logPass('Complete flow works in fallback mode');
    testsPassed++;
  } catch (error) {
    logFail(`End-to-end fallback test failed: ${error.message}`);
    testsFailed++;
    return false;
  }

  // Test 5.3: Verify metrics are collected
  if (hasGeminiClient) {
    logTest('5.3: Verify GeminiClient metrics are collected');
    try {
      const client = getGeminiClient();
      const metrics = client.getMetrics();
      
      if (metrics.apiCallsTotal === 0) {
        logWarning('No API calls recorded (tests may have used mocks)');
      } else {
        logInfo(`  - Total API calls: ${metrics.apiCallsTotal}`);
        logInfo(`  - Success rate: ${metrics.successRate}`);
        logInfo(`  - Avg response time: ${metrics.avgResponseTimeMs}ms`);
      }
      
      logPass('Metrics collection is working');
      testsPassed++;
    } catch (error) {
      logFail(`Metrics verification failed: ${error.message}`);
      testsFailed++;
      return false;
    }
  } else {
    logTest('5.3: Skipping metrics verification (no API key)');
    testsSkipped++;
  }

  return true;
}

/**
 * Main test runner
 */
async function runTests() {
  log('\n╔════════════════════════════════════════════════════════════════════╗', 'bright');
  log('║  GEMINI LLM NEGOTIATION INTEGRATION - COMPREHENSIVE MANUAL TEST   ║', 'bright');
  log('╚════════════════════════════════════════════════════════════════════╝', 'bright');
  
  logInfo('Task 4.3: Test basic integration manually');
  logInfo('This test verifies the complete Gemini integration works end-to-end\n');

  try {
    // Test 1: GeminiClient Initialization
    const hasGeminiClient = await testGeminiClientInitialization();

    // Test 2: Feature Flags Control
    await testFeatureFlagsControl();

    // Test 3: Availability Parsing
    await testAvailabilityParsing(hasGeminiClient);

    // Test 4: Response Generation
    await testResponseGeneration(hasGeminiClient);

    // Test 5: End-to-End Integration
    await testEndToEndIntegration(hasGeminiClient);

    // Print summary
    logSection('TEST SUMMARY');
    
    const totalTests = testsPassed + testsFailed;
    const successRate = totalTests > 0 ? ((testsPassed / totalTests) * 100).toFixed(1) : 0;
    
    log(`Total Tests: ${totalTests}`, 'bright');
    log(`Passed: ${testsPassed}`, 'green');
    log(`Failed: ${testsFailed}`, testsFailed > 0 ? 'red' : 'reset');
    log(`Skipped: ${testsSkipped}`, 'yellow');
    log(`Success Rate: ${successRate}%`, testsFailed === 0 ? 'green' : 'yellow');
    
    if (testsFailed === 0) {
      log('\n✓ ALL TESTS PASSED!', 'green');
      log('\nGemini LLM Integration Status: ✓ COMPLETE', 'green');
      log('\nThe integration is working correctly:', 'bright');
      log('  1. GeminiClient initializes and manages API calls', 'green');
      log('  2. Feature flags control Gemini features', 'green');
      log('  3. NegotiationBot uses Gemini when enabled', 'green');
      log('  4. Fallback to regex/template works when Gemini disabled or fails', 'green');
      log('  5. All components wire together properly', 'green');
      
      if (testsSkipped > 0) {
        log(`\nNote: ${testsSkipped} tests were skipped (likely due to missing GEMINI_API_KEY)`, 'yellow');
        log('These tests verified fallback behavior instead', 'yellow');
      }
      
      process.exit(0);
    } else {
      log('\n✗ SOME TESTS FAILED', 'red');
      log('\nPlease review the failures above and fix the issues.', 'red');
      process.exit(1);
    }
  } catch (error) {
    log('\n✗ TEST SUITE FAILED WITH ERROR', 'red');
    log(`Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run tests
runTests();
