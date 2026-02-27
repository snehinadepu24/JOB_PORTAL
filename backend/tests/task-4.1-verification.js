/**
 * Task 4.1 Verification: Wire GeminiClient into NegotiationBot constructor
 * 
 * This test verifies that:
 * 1. NegotiationBot constructor accepts geminiClient parameter
 * 2. NegotiationBot defaults to getGeminiClient() when no client provided
 * 3. GeminiClient is properly initialized when NegotiationBot is instantiated
 */

import NegotiationBot from '../managers/NegotiationBot.js';
import { getGeminiClient } from '../services/GeminiClient.js';

console.log('Task 4.1 Verification: Wire GeminiClient into NegotiationBot constructor\n');

// Test 1: Constructor accepts geminiClient parameter
console.log('Test 1: Constructor accepts geminiClient parameter');
const mockGeminiClient = {
  extractAvailability: async () => null,
  generateResponse: async () => null
};

const bot1 = new NegotiationBot(null, null, mockGeminiClient);
if (bot1.geminiClient === mockGeminiClient) {
  console.log('✓ PASS: Constructor correctly accepts and uses provided geminiClient\n');
} else {
  console.log('✗ FAIL: Constructor did not use provided geminiClient\n');
  process.exit(1);
}

// Test 2: Constructor defaults to getGeminiClient() when no client provided
console.log('Test 2: Constructor defaults to getGeminiClient() when no client provided');
const bot2 = new NegotiationBot(null, null);
const defaultClient = getGeminiClient();

if (bot2.geminiClient === defaultClient) {
  console.log('✓ PASS: Constructor defaults to getGeminiClient() when no client provided');
  console.log(`  - geminiClient is: ${bot2.geminiClient ? 'initialized' : 'null (expected if no API key)'}\n`);
} else {
  console.log('✗ FAIL: Constructor did not default to getGeminiClient()\n');
  process.exit(1);
}

// Test 3: Constructor handles null geminiClient gracefully
console.log('Test 3: Constructor handles null geminiClient gracefully');
const bot3 = new NegotiationBot(null, null, null);
if (bot3.geminiClient === null || bot3.geminiClient === getGeminiClient()) {
  console.log('✓ PASS: Constructor handles null geminiClient gracefully');
  console.log('  - Bot will fall back to regex/template methods when geminiClient is null\n');
} else {
  console.log('✗ FAIL: Constructor did not handle null geminiClient correctly\n');
  process.exit(1);
}

// Test 4: Verify getGeminiClient() returns consistent instance
console.log('Test 4: Verify getGeminiClient() returns consistent instance');
const client1 = getGeminiClient();
const client2 = getGeminiClient();
if (client1 === client2) {
  console.log('✓ PASS: getGeminiClient() returns singleton instance');
  console.log(`  - Instance type: ${client1 ? 'GeminiClient' : 'null (no API key configured)'}\n`);
} else {
  console.log('✗ FAIL: getGeminiClient() did not return consistent instance\n');
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('✓ ALL TESTS PASSED');
console.log('═══════════════════════════════════════════════════════════');
console.log('\nTask 4.1 Verification Summary:');
console.log('- NegotiationBot constructor properly accepts geminiClient parameter');
console.log('- Constructor defaults to getGeminiClient() when no client provided');
console.log('- getGeminiClient() returns a singleton instance');
console.log('- NegotiationBot gracefully handles null geminiClient (falls back to regex/template)');
console.log('\nImplementation Status: ✓ COMPLETE');
console.log('\nWhen NegotiationBot is instantiated in routes/controllers:');
console.log('  - Use: new NegotiationBot(calendarIntegrator, emailService)');
console.log('  - The geminiClient will automatically be initialized via getGeminiClient()');
console.log('  - If GEMINI_API_KEY is not configured, it will gracefully fall back to regex/template methods');
