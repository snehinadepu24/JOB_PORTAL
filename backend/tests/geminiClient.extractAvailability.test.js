/**
 * GeminiClient extractAvailability Tests
 * 
 * Tests the extractAvailability method including:
 * - Availability extraction prompt building
 * - Response validation
 * - Date parsing and validation
 * - Error handling
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 7.2
 */

import { GeminiClient } from '../services/GeminiClient.js';

console.log('=== GeminiClient extractAvailability Tests ===\n');

// Save original environment
const originalEnv = { ...process.env };
process.env.GEMINI_API_KEY = 'test-api-key-123';

/**
 * Test 1: Validate valid availability response
 */
console.log('Test 1: Validate valid availability response');
try {
  const client = new GeminiClient();
  
  const validResponse = {
    start_date: '2024-12-20',
    end_date: '2024-12-27',
    preferred_hours: { start: 9, end: 17 },
    preferred_days: ['monday', 'wednesday', 'friday']
  };
  
  const validated = client._validateAvailabilityResponse(validResponse);
  
  if (validated && 
      validated.start_date instanceof Date &&
      validated.end_date instanceof Date &&
      validated.preferred_hours.start === 9 &&
      validated.preferred_days.length === 3) {
    console.log('✓ PASSED: Valid response validated correctly');
    console.log('  - start_date:', validated.start_date.toISOString());
    console.log('  - end_date:', validated.end_date.toISOString());
    console.log('  - preferred_hours:', validated.preferred_hours);
    console.log('  - preferred_days:', validated.preferred_days, '\n');
  } else {
    console.log('✗ FAILED: Valid response not validated correctly\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 2: Reject response with missing start_date
 */
console.log('Test 2: Reject response with missing start_date');
try {
  const client = new GeminiClient();
  
  const invalidResponse = {
    end_date: '2024-12-27',
    preferred_hours: null,
    preferred_days: null
  };
  
  const validated = client._validateAvailabilityResponse(invalidResponse);
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected response with missing start_date\n');
  } else {
    console.log('✗ FAILED: Should have rejected response with missing start_date\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 3: Reject response with missing end_date
 */
console.log('Test 3: Reject response with missing end_date');
try {
  const client = new GeminiClient();
  
  const invalidResponse = {
    start_date: '2024-12-20',
    preferred_hours: null,
    preferred_days: null
  };
  
  const validated = client._validateAvailabilityResponse(invalidResponse);
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected response with missing end_date\n');
  } else {
    console.log('✗ FAILED: Should have rejected response with missing end_date\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 4: Reject response with invalid date format
 */
console.log('Test 4: Reject response with invalid date format');
try {
  const client = new GeminiClient();
  
  const invalidResponse = {
    start_date: 'invalid-date',
    end_date: '2024-12-27',
    preferred_hours: null,
    preferred_days: null
  };
  
  const validated = client._validateAvailabilityResponse(invalidResponse);
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected response with invalid date format\n');
  } else {
    console.log('✗ FAILED: Should have rejected response with invalid date format\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 5: Reject response where start_date is after end_date
 */
console.log('Test 5: Reject response where start_date is after end_date');
try {
  const client = new GeminiClient();
  
  const invalidResponse = {
    start_date: '2024-12-27',
    end_date: '2024-12-20',
    preferred_hours: null,
    preferred_days: null
  };
  
  const validated = client._validateAvailabilityResponse(invalidResponse);
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected response where start_date > end_date\n');
  } else {
    console.log('✗ FAILED: Should have rejected response where start_date > end_date\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 6: Accept response with null preferred_hours
 */
console.log('Test 6: Accept response with null preferred_hours');
try {
  const client = new GeminiClient();
  
  const validResponse = {
    start_date: '2024-12-20',
    end_date: '2024-12-27',
    preferred_hours: null,
    preferred_days: null
  };
  
  const validated = client._validateAvailabilityResponse(validResponse);
  
  if (validated && validated.preferred_hours === null) {
    console.log('✓ PASSED: Correctly accepted response with null preferred_hours\n');
  } else {
    console.log('✗ FAILED: Should have accepted response with null preferred_hours\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 7: Reject response with invalid preferred_hours (not an object)
 */
console.log('Test 7: Reject response with invalid preferred_hours (not an object)');
try {
  const client = new GeminiClient();
  
  const invalidResponse = {
    start_date: '2024-12-20',
    end_date: '2024-12-27',
    preferred_hours: 'invalid',
    preferred_days: null
  };
  
  const validated = client._validateAvailabilityResponse(invalidResponse);
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected response with invalid preferred_hours type\n');
  } else {
    console.log('✗ FAILED: Should have rejected response with invalid preferred_hours type\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 8: Reject response with preferred_hours out of range
 */
console.log('Test 8: Reject response with preferred_hours out of range');
try {
  const client = new GeminiClient();
  
  const invalidResponse = {
    start_date: '2024-12-20',
    end_date: '2024-12-27',
    preferred_hours: { start: 9, end: 25 },
    preferred_days: null
  };
  
  const validated = client._validateAvailabilityResponse(invalidResponse);
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected response with preferred_hours out of range\n');
  } else {
    console.log('✗ FAILED: Should have rejected response with preferred_hours out of range\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 9: Reject response with preferred_hours start >= end
 */
console.log('Test 9: Reject response with preferred_hours start >= end');
try {
  const client = new GeminiClient();
  
  const invalidResponse = {
    start_date: '2024-12-20',
    end_date: '2024-12-27',
    preferred_hours: { start: 17, end: 9 },
    preferred_days: null
  };
  
  const validated = client._validateAvailabilityResponse(invalidResponse);
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected response with preferred_hours start >= end\n');
  } else {
    console.log('✗ FAILED: Should have rejected response with preferred_hours start >= end\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 10: Accept response with null preferred_days
 */
console.log('Test 10: Accept response with null preferred_days');
try {
  const client = new GeminiClient();
  
  const validResponse = {
    start_date: '2024-12-20',
    end_date: '2024-12-27',
    preferred_hours: { start: 9, end: 17 },
    preferred_days: null
  };
  
  const validated = client._validateAvailabilityResponse(validResponse);
  
  if (validated && validated.preferred_days === null) {
    console.log('✓ PASSED: Correctly accepted response with null preferred_days\n');
  } else {
    console.log('✗ FAILED: Should have accepted response with null preferred_days\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 11: Reject response with invalid preferred_days (not an array)
 */
console.log('Test 11: Reject response with invalid preferred_days (not an array)');
try {
  const client = new GeminiClient();
  
  const invalidResponse = {
    start_date: '2024-12-20',
    end_date: '2024-12-27',
    preferred_hours: null,
    preferred_days: 'monday'
  };
  
  const validated = client._validateAvailabilityResponse(invalidResponse);
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected response with invalid preferred_days type\n');
  } else {
    console.log('✗ FAILED: Should have rejected response with invalid preferred_days type\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 12: Reject response with invalid day name
 */
console.log('Test 12: Reject response with invalid day name');
try {
  const client = new GeminiClient();
  
  const invalidResponse = {
    start_date: '2024-12-20',
    end_date: '2024-12-27',
    preferred_hours: null,
    preferred_days: ['monday', 'invalidday']
  };
  
  const validated = client._validateAvailabilityResponse(invalidResponse);
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected response with invalid day name\n');
  } else {
    console.log('✗ FAILED: Should have rejected response with invalid day name\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 13: Accept response with valid preferred_days
 */
console.log('Test 13: Accept response with valid preferred_days');
try {
  const client = new GeminiClient();
  
  const validResponse = {
    start_date: '2024-12-20',
    end_date: '2024-12-27',
    preferred_hours: null,
    preferred_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  };
  
  const validated = client._validateAvailabilityResponse(validResponse);
  
  if (validated && validated.preferred_days.length === 5) {
    console.log('✓ PASSED: Correctly accepted response with valid preferred_days');
    console.log('  - preferred_days:', validated.preferred_days, '\n');
  } else {
    console.log('✗ FAILED: Should have accepted response with valid preferred_days\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 14: Reject response with error field
 */
console.log('Test 14: Reject response with error field');
try {
  const client = new GeminiClient();
  
  const errorResponse = {
    error: 'no_availability_found'
  };
  
  const validated = client._validateAvailabilityResponse(errorResponse);
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected response with error field\n');
  } else {
    console.log('✗ FAILED: Should have rejected response with error field\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 15: Reject null response
 */
console.log('Test 15: Reject null response');
try {
  const client = new GeminiClient();
  
  const validated = client._validateAvailabilityResponse(null);
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected null response\n');
  } else {
    console.log('✗ FAILED: Should have rejected null response\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 16: Reject non-object response
 */
console.log('Test 16: Reject non-object response');
try {
  const client = new GeminiClient();
  
  const validated = client._validateAvailabilityResponse('invalid');
  
  if (validated === null) {
    console.log('✓ PASSED: Correctly rejected non-object response\n');
  } else {
    console.log('✗ FAILED: Should have rejected non-object response\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 17: Availability prompt includes current date
 */
console.log('Test 17: Availability prompt includes current date');
try {
  const client = new GeminiClient();
  
  const message = 'I am available next Monday';
  const prompt = client._buildAvailabilityPrompt(message);
  
  const currentDate = new Date().toISOString().split('T')[0];
  
  if (prompt.includes(currentDate)) {
    console.log('✓ PASSED: Availability prompt includes current date');
    console.log('  - Current date:', currentDate, '\n');
  } else {
    console.log('✗ FAILED: Availability prompt missing current date\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 18: Availability prompt includes time expression rules
 */
console.log('Test 18: Availability prompt includes time expression rules');
try {
  const client = new GeminiClient();
  
  const message = 'I am available in the morning';
  const prompt = client._buildAvailabilityPrompt(message);
  
  if (prompt.includes('morning') && 
      prompt.includes('{start: 9, end: 12}') &&
      prompt.includes('afternoon') &&
      prompt.includes('evening')) {
    console.log('✓ PASSED: Availability prompt includes time expression rules\n');
  } else {
    console.log('✗ FAILED: Availability prompt missing time expression rules\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

/**
 * Test 19: Availability prompt includes JSON format instructions
 */
console.log('Test 19: Availability prompt includes JSON format instructions');
try {
  const client = new GeminiClient();
  
  const message = 'I am available next week';
  const prompt = client._buildAvailabilityPrompt(message);
  
  if (prompt.includes('ONLY valid JSON') && 
      prompt.includes('ISO 8601') &&
      prompt.includes('start_date') &&
      prompt.includes('end_date') &&
      prompt.includes('preferred_hours') &&
      prompt.includes('preferred_days')) {
    console.log('✓ PASSED: Availability prompt includes JSON format instructions\n');
  } else {
    console.log('✗ FAILED: Availability prompt missing JSON format instructions\n');
  }
} catch (error) {
  console.log('✗ FAILED:', error.message, '\n');
}

console.log('=== All Tests Complete ===');

// Restore original environment
process.env = originalEnv;
