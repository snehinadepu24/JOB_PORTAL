/**
 * Tests for NegotiationBot.generateResponse method
 * Task 3.2: Add generateResponse method to NegotiationBot
 * 
 * Tests:
 * 1. generateResponse returns Gemini result when client returns valid response
 * 2. generateResponse falls back to template when Gemini returns null
 * 3. generateResponse falls back to template when Gemini throws error
 * 4. generateResponse falls back to template when no Gemini client provided
 * 5. generateResponse validates response length and content
 * 6. generateResponse correctly maps response types
 * 
 * Note: These tests verify the fallback logic works correctly.
 * Feature flag behavior is tested separately in integration tests.
 */

import NegotiationBot from '../managers/NegotiationBot.js';

console.log('Testing NegotiationBot.generateResponse (Task 3.2)...\n');

// Create mock dependencies
const mockCalendarIntegrator = {
  getAvailableSlots: async () => []
};

const mockEmailService = {
  queueEmail: async () => ({ success: true })
};

// Test 1: Gemini returns valid response
console.log('Test 1: generateResponse returns Gemini result when valid');
try {
  const mockGeminiClient = {
    generateResponse: async (context) => {
      return "Great! I found some times that work with your schedule. Would you like to hear them?";
    }
  };

  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
  const response = await bot.generateResponse('clarification', {
    history: [],
    round: 1,
    maxRounds: 3
  });
  
  if (!response) {
    throw new Error('No response generated');
  }
  
  if (response.includes("I'd be happy to help")) {
    throw new Error('Used template instead of Gemini response');
  }
  
  if (!response.includes("Great! I found some times")) {
    throw new Error('Did not return Gemini response');
  }
  
  console.log('✓ Successfully returned Gemini response');
  console.log('  Response:', response.substring(0, 50) + '...');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 2: Gemini returns null, falls back to template
console.log('\nTest 2: generateResponse falls back to template when Gemini returns null');
try {
  const mockGeminiClient = {
    generateResponse: async () => null
  };

  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
  const response = await bot.generateResponse('clarification', {
    history: [],
    round: 1,
    maxRounds: 3
  });
  
  if (!response) {
    throw new Error('No response generated');
  }
  
  if (!response.includes("I'd be happy to help")) {
    throw new Error('Did not fall back to template');
  }
  
  console.log('✓ Successfully fell back to template when Gemini returned null');
  console.log('  Response:', response.substring(0, 50) + '...');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 3: Gemini throws error, falls back to template
console.log('\nTest 3: generateResponse falls back to template when Gemini throws error');
try {
  const mockGeminiClient = {
    generateResponse: async () => {
      throw new Error('API timeout');
    }
  };

  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
  const response = await bot.generateResponse('request_alternatives', {
    history: [],
    round: 2,
    maxRounds: 3
  });
  
  if (!response) {
    throw new Error('No response generated');
  }
  
  if (!response.includes("those times don't align")) {
    throw new Error('Did not fall back to template');
  }
  
  console.log('✓ Successfully fell back to template when Gemini threw error');
  console.log('  Response:', response.substring(0, 50) + '...');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 4: No Gemini client provided, uses template
console.log('\nTest 4: generateResponse uses template when no Gemini client');
try {
  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, null);
  const response = await bot.generateResponse('escalation', {
    history: [],
    round: 4,
    maxRounds: 3
  });
  
  if (!response) {
    throw new Error('No response generated');
  }
  
  if (!response.includes("I haven't been able to find")) {
    throw new Error('Did not use template');
  }
  
  console.log('✓ Successfully used template when no Gemini client');
  console.log('  Response:', response.substring(0, 50) + '...');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 5: Validates response length (rejects too short)
console.log('\nTest 5: generateResponse validates response length (too short)');
try {
  const mockGeminiClient = {
    generateResponse: async () => "OK"
  };

  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
  const response = await bot.generateResponse('clarification', {
    history: [],
    round: 1,
    maxRounds: 3
  });
  
  if (!response) {
    throw new Error('No response generated');
  }
  
  if (response === "OK") {
    throw new Error('Did not reject short response');
  }
  
  if (!response.includes("I'd be happy to help")) {
    throw new Error('Did not fall back to template');
  }
  
  console.log('✓ Successfully rejected short response and fell back to template');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 6: Validates response length (rejects too long)
console.log('\nTest 6: generateResponse validates response length (too long)');
try {
  const longResponse = 'word '.repeat(300); // 300 words
  
  const mockGeminiClient = {
    generateResponse: async () => longResponse
  };

  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
  const response = await bot.generateResponse('clarification', {
    history: [],
    round: 1,
    maxRounds: 3
  });
  
  if (!response) {
    throw new Error('No response generated');
  }
  
  if (response === longResponse) {
    throw new Error('Did not reject long response');
  }
  
  if (!response.includes("I'd be happy to help")) {
    throw new Error('Did not fall back to template');
  }
  
  console.log('✓ Successfully rejected long response and fell back to template');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 7: Correctly maps response types
console.log('\nTest 7: generateResponse correctly maps response types');
try {
  let capturedContext = null;
  
  const mockGeminiClient = {
    generateResponse: async (context) => {
      capturedContext = context;
      return "This is a valid response from Gemini that is long enough to pass validation.";
    }
  };

  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
  
  // Test slot_suggestions -> slot_suggestion mapping
  await bot.generateResponse('slot_suggestions', {
    slots: [{ start: new Date() }],
    history: [],
    round: 1,
    maxRounds: 3
  });
  
  if (capturedContext.type !== 'slot_suggestion') {
    throw new Error(`Expected type 'slot_suggestion', got '${capturedContext.type}'`);
  }
  
  console.log('✓ Successfully mapped slot_suggestions to slot_suggestion');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 8: Passes correct context to Gemini
console.log('\nTest 8: generateResponse passes correct context to Gemini');
try {
  let capturedContext = null;
  
  const mockGeminiClient = {
    generateResponse: async (context) => {
      capturedContext = context;
      return "This is a valid response from Gemini that is long enough to pass validation.";
    }
  };

  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, mockGeminiClient);
  
  const testHistory = [
    { role: 'candidate', message: 'Test message' }
  ];
  
  const testSlots = [
    { start: new Date('2024-12-20T10:00:00Z') }
  ];
  
  await bot.generateResponse('slot_suggestions', {
    slots: testSlots,
    history: testHistory,
    round: 2,
    maxRounds: 3
  });
  
  if (!capturedContext) {
    throw new Error('Context not captured');
  }
  
  if (capturedContext.round !== 2) {
    throw new Error(`Expected round 2, got ${capturedContext.round}`);
  }
  
  if (capturedContext.maxRounds !== 3) {
    throw new Error(`Expected maxRounds 3, got ${capturedContext.maxRounds}`);
  }
  
  if (!capturedContext.history || capturedContext.history.length !== 1) {
    throw new Error('History not passed correctly');
  }
  
  if (!capturedContext.slots || capturedContext.slots.length !== 1) {
    throw new Error('Slots not passed correctly');
  }
  
  console.log('✓ Successfully passed correct context to Gemini');
  console.log('  Context:', JSON.stringify(capturedContext, null, 2).substring(0, 100) + '...');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 9: generateTemplateResponse still works for all types
console.log('\nTest 9: generateTemplateResponse works for all response types');
try {
  const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService, null);
  
  // Test clarification
  const clarification = bot.generateTemplateResponse('clarification');
  if (!clarification.includes("I'd be happy to help")) {
    throw new Error('Clarification template incorrect');
  }
  
  // Test slot_suggestions
  const slots = bot.generateTemplateResponse('slot_suggestions', {
    slots: [{ start: new Date('2024-12-20T10:00:00Z') }]
  });
  if (!slots.includes("Great! I found these available times")) {
    throw new Error('Slot suggestions template incorrect');
  }
  
  // Test request_alternatives
  const alternatives = bot.generateTemplateResponse('request_alternatives', {
    round: 2,
    maxRounds: 3
  });
  if (!alternatives.includes("those times don't align")) {
    throw new Error('Request alternatives template incorrect');
  }
  
  // Test escalation
  const escalation = bot.generateTemplateResponse('escalation');
  if (!escalation.includes("I haven't been able to find")) {
    throw new Error('Escalation template incorrect');
  }
  
  console.log('✓ All template response types work correctly');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

console.log('\n✓ All NegotiationBot.generateResponse tests passed!');
