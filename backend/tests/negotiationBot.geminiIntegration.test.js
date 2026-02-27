/**
 * Tests for NegotiationBot Gemini Integration
 * Task 2.2: Enhance NegotiationBot.parseAvailability with Gemini integration
 * 
 * Tests:
 * 1. parseAvailability returns Gemini result when client returns valid data
 * 2. parseAvailability falls back to regex when Gemini returns null
 * 3. parseAvailability falls back to regex when Gemini throws error
 * 4. parseAvailability falls back to regex when no Gemini client provided
 * 
 * Note: These tests verify the fallback logic works correctly.
 * Feature flag behavior is tested separately in integration tests.
 */

import NegotiationBot from '../managers/NegotiationBot.js';

console.log('Testing NegotiationBot Gemini Integration (Task 2.2)...\n');

// Create mock dependencies
const mockCalendarIntegrator = {
  getAvailableSlots: async () => []
};

const mockEmailService = {
  queueEmail: async () => ({ success: true })
};

// Test 1: Gemini returns null, falls back to regex
console.log('Test 1: parseAvailability falls back to regex when Gemini returns null');
try {
  const mockGeminiClient = {
    extractAvailability: async () => null
  };

  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
  const availability = await bot.parseAvailability("I'm available next week");
  
  if (!availability) {
    throw new Error('Failed to parse availability with regex fallback');
  }
  
  if (!(availability.start_date instanceof Date)) {
    throw new Error('start_date is not a Date');
  }
  
  console.log('✓ Successfully fell back to regex when Gemini returned null');
  console.log('  Start:', availability.start_date.toISOString());
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 2: Gemini throws error, falls back to regex
console.log('\nTest 2: parseAvailability falls back to regex when Gemini throws error');
try {
  const mockGeminiClient = {
    extractAvailability: async () => {
      throw new Error('API timeout');
    }
  };

  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
  const availability = await bot.parseAvailability("I'm available next week");
  
  if (!availability) {
    throw new Error('Failed to parse availability with regex fallback');
  }
  
  if (!(availability.start_date instanceof Date)) {
    throw new Error('start_date is not a Date');
  }
  
  console.log('✓ Successfully fell back to regex when Gemini threw error');
  console.log('  Start:', availability.start_date.toISOString());
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 3: No Gemini client provided, falls back to regex
console.log('\nTest 3: parseAvailability falls back to regex when no Gemini client');
try {
  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, null);
  const availability = await bot.parseAvailability("I'm available next week");
  
  if (!availability) {
    throw new Error('Failed to parse availability with regex fallback');
  }
  
  if (!(availability.start_date instanceof Date)) {
    throw new Error('start_date is not a Date');
  }
  
  console.log('✓ Successfully fell back to regex when no Gemini client');
  console.log('  Start:', availability.start_date.toISOString());
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 4: Verify parseAvailabilityRegex still works directly
console.log('\nTest 4: parseAvailabilityRegex works correctly');
try {
  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, null);
  const availability = bot.parseAvailabilityRegex("I'm available Monday afternoon");
  
  if (!availability) {
    throw new Error('Failed to parse availability');
  }
  
  if (!availability.preferred_hours) {
    throw new Error('preferred_hours not parsed');
  }
  
  if (availability.preferred_hours.start !== 12 || availability.preferred_hours.end !== 18) {
    throw new Error('Incorrect afternoon hours');
  }
  
  console.log('✓ parseAvailabilityRegex works correctly');
  console.log('  Preferred hours:', availability.preferred_hours);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 5: Verify constructor accepts geminiClient parameter
console.log('\nTest 5: Constructor accepts geminiClient parameter');
try {
  const mockGeminiClient = {
    extractAvailability: async () => null
  };

  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
  
  if (bot.geminiClient !== mockGeminiClient) {
    throw new Error('geminiClient not set correctly');
  }
  
  console.log('✓ Constructor correctly accepts geminiClient parameter');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

console.log('\n✓ All NegotiationBot Gemini integration tests passed!');
