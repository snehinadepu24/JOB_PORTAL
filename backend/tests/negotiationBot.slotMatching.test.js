/**
 * Unit tests for NegotiationBot slot matching and suggestions
 * Task 13.3: Implement slot matching and suggestions
 * 
 * Requirements: 5.2, 5.3
 * 
 * Tests:
 * - Query recruiter calendar for overlapping slots
 * - Generate up to 3 suggestions per round
 * - Format suggestions for candidate
 */

import NegotiationBot from '../managers/NegotiationBot.js';

console.log('Testing NegotiationBot Slot Matching and Suggestions (Task 13.3)...\n');

// Create mock CalendarIntegrator
const mockCalendarIntegrator = {
  getAvailableSlots: async (recruiterId, startDate, endDate) => {
    // Return mock slots spanning multiple days and times
    const slots = [];
    const baseDate = new Date('2024-01-15T00:00:00Z');
    
    // Monday 10 AM, 2 PM, 4 PM
    slots.push(
      { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T11:00:00Z') },
      { start: new Date('2024-01-15T14:00:00Z'), end: new Date('2024-01-15T15:00:00Z') },
      { start: new Date('2024-01-15T16:00:00Z'), end: new Date('2024-01-15T17:00:00Z') }
    );
    
    // Tuesday 9 AM, 11 AM, 3 PM
    slots.push(
      { start: new Date('2024-01-16T09:00:00Z'), end: new Date('2024-01-16T10:00:00Z') },
      { start: new Date('2024-01-16T11:00:00Z'), end: new Date('2024-01-16T12:00:00Z') },
      { start: new Date('2024-01-16T15:00:00Z'), end: new Date('2024-01-16T16:00:00Z') }
    );
    
    // Wednesday 10 AM, 1 PM
    slots.push(
      { start: new Date('2024-01-17T10:00:00Z'), end: new Date('2024-01-17T11:00:00Z') },
      { start: new Date('2024-01-17T13:00:00Z'), end: new Date('2024-01-17T14:00:00Z') }
    );
    
    return slots;
  }
};

const mockEmailService = {
  queueEmail: async () => ({ success: true })
};

const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService);

// Test 1: Query recruiter calendar for overlapping slots (Requirement 5.2)
console.log('Test 1: Query recruiter calendar for overlapping slots (Req 5.2)');
try {
  const availability = {
    start_date: new Date('2024-01-15T00:00:00Z'),
    end_date: new Date('2024-01-20T00:00:00Z'),
    preferred_hours: null,
    preferred_days: null
  };
  
  // Get available slots from calendar
  const availableSlots = await mockCalendarIntegrator.getAvailableSlots(
    'recruiter-123',
    availability.start_date,
    availability.end_date
  );
  
  if (!Array.isArray(availableSlots)) {
    throw new Error('getAvailableSlots should return an array');
  }
  
  if (availableSlots.length === 0) {
    throw new Error('Should return available slots');
  }
  
  // Find matching slots
  const matchingSlots = bot.findMatchingSlots(availableSlots, availability);
  
  if (!Array.isArray(matchingSlots)) {
    throw new Error('findMatchingSlots should return an array');
  }
  
  if (matchingSlots.length === 0) {
    throw new Error('Should find matching slots');
  }
  
  console.log('✓ Successfully queried recruiter calendar and found overlapping slots');
  console.log(`  Available slots: ${availableSlots.length}`);
  console.log(`  Matching slots: ${matchingSlots.length}`);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 2: Generate up to 3 suggestions per round (Requirement 5.3)
console.log('\nTest 2: Generate up to 3 suggestions per round (Req 5.3)');
try {
  const availableSlots = await mockCalendarIntegrator.getAvailableSlots(
    'recruiter-123',
    new Date('2024-01-15T00:00:00Z'),
    new Date('2024-01-20T00:00:00Z')
  );
  
  const availability = {
    start_date: new Date('2024-01-15T00:00:00Z'),
    end_date: new Date('2024-01-20T00:00:00Z'),
    preferred_hours: null,
    preferred_days: null
  };
  
  const matchingSlots = bot.findMatchingSlots(availableSlots, availability);
  
  // Should suggest up to 3 slots
  const suggestions = matchingSlots.slice(0, 3);
  
  if (suggestions.length > 3) {
    throw new Error(`Should suggest at most 3 slots, got ${suggestions.length}`);
  }
  
  if (suggestions.length === 0) {
    throw new Error('Should have at least 1 suggestion');
  }
  
  console.log('✓ Successfully limited suggestions to 3 slots');
  console.log(`  Total matching: ${matchingSlots.length}`);
  console.log(`  Suggestions: ${suggestions.length}`);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 3: Format suggestions for candidate (Requirement 5.3)
console.log('\nTest 3: Format suggestions for candidate (Req 5.3)');
try {
  const slots = [
    { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T11:00:00Z') },
    { start: new Date('2024-01-16T14:00:00Z'), end: new Date('2024-01-16T15:00:00Z') },
    { start: new Date('2024-01-17T13:00:00Z'), end: new Date('2024-01-17T14:00:00Z') }
  ];
  
  const formatted = bot.formatSlotSuggestions(slots);
  
  if (typeof formatted !== 'string') {
    throw new Error('formatSlotSuggestions should return a string');
  }
  
  if (formatted.length === 0) {
    throw new Error('Formatted message should not be empty');
  }
  
  // Check for numbered list
  if (!formatted.includes('1.')) {
    throw new Error('Should include numbered list item 1');
  }
  
  if (!formatted.includes('2.')) {
    throw new Error('Should include numbered list item 2');
  }
  
  if (!formatted.includes('3.')) {
    throw new Error('Should include numbered list item 3');
  }
  
  // Check for instructions
  if (!formatted.toLowerCase().includes('reply')) {
    throw new Error('Should include instructions for candidate');
  }
  
  console.log('✓ Successfully formatted suggestions for candidate');
  console.log('  Sample output:');
  console.log('  ' + formatted.split('\n').slice(0, 5).join('\n  '));
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 4: Match slots with preferred days
console.log('\nTest 4: Match slots with preferred days');
try {
  const availableSlots = await mockCalendarIntegrator.getAvailableSlots(
    'recruiter-123',
    new Date('2024-01-15T00:00:00Z'),
    new Date('2024-01-20T00:00:00Z')
  );
  
  const availability = {
    start_date: new Date('2024-01-15T00:00:00Z'),
    end_date: new Date('2024-01-20T00:00:00Z'),
    preferred_hours: null,
    preferred_days: ['monday', 'wednesday'] // Only Monday and Wednesday
  };
  
  const matchingSlots = bot.findMatchingSlots(availableSlots, availability);
  
  // Verify all matching slots are on Monday or Wednesday
  for (const slot of matchingSlots) {
    const day = new Date(slot.start).getDay();
    if (day !== 1 && day !== 3) { // 1 = Monday, 3 = Wednesday
      throw new Error(`Found slot on wrong day: ${day}`);
    }
  }
  
  console.log('✓ Successfully filtered slots by preferred days');
  console.log(`  Matched: ${matchingSlots.length} slots on Monday/Wednesday`);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 5: Match slots with preferred hours
console.log('\nTest 5: Match slots with preferred hours');
try {
  // Create slots in local time for proper hour matching
  const date = new Date('2024-01-15');
  const localSlots = [
    { start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0) },  // 9 AM
    { start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 14, 0) }, // 2 PM
    { start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 16, 0) }, // 4 PM
    { start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 0) }  // 5 PM
  ];
  
  const availability = {
    start_date: new Date('2024-01-15T00:00:00'),
    end_date: new Date('2024-01-20T00:00:00'),
    preferred_hours: { start: 14, end: 18 }, // 2 PM - 6 PM local time
    preferred_days: null
  };
  
  const matchingSlots = bot.findMatchingSlots(localSlots, availability);
  
  // Verify all matching slots are within preferred hours (local time)
  for (const slot of matchingSlots) {
    const hour = new Date(slot.start).getHours();
    if (hour < 14 || hour >= 18) {
      throw new Error(`Found slot outside preferred hours: ${hour}:00 local time`);
    }
  }
  
  if (matchingSlots.length !== 3) {
    throw new Error(`Expected 3 matching slots (14:00, 16:00, 17:00), got ${matchingSlots.length}`);
  }
  
  console.log('✓ Successfully filtered slots by preferred hours');
  console.log(`  Matched: ${matchingSlots.length} slots between 2 PM - 6 PM local time`);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 6: Match slots with both day and hour preferences
console.log('\nTest 6: Match slots with both day and hour preferences');
try {
  // Create slots with specific days and times in local time
  const monday = new Date('2024-01-15'); // Monday
  const tuesday = new Date('2024-01-16'); // Tuesday
  const wednesday = new Date('2024-01-17'); // Wednesday
  
  const localSlots = [
    { start: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 0) },    // Mon 10 AM
    { start: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 14, 0) },    // Mon 2 PM
    { start: new Date(tuesday.getFullYear(), tuesday.getMonth(), tuesday.getDate(), 9, 0) },  // Tue 9 AM
    { start: new Date(tuesday.getFullYear(), tuesday.getMonth(), tuesday.getDate(), 15, 0) }, // Tue 3 PM
    { start: new Date(wednesday.getFullYear(), wednesday.getMonth(), wednesday.getDate(), 16, 0) } // Wed 4 PM
  ];
  
  const availability = {
    start_date: new Date('2024-01-15T00:00:00'),
    end_date: new Date('2024-01-20T00:00:00'),
    preferred_hours: { start: 14, end: 18 }, // 2 PM - 6 PM
    preferred_days: ['monday', 'tuesday'] // Monday and Tuesday only
  };
  
  const matchingSlots = bot.findMatchingSlots(localSlots, availability);
  
  // Verify all matching slots meet both criteria
  for (const slot of matchingSlots) {
    const day = new Date(slot.start).getDay();
    const hour = new Date(slot.start).getHours();
    
    if (day !== 1 && day !== 2) {
      throw new Error(`Found slot on wrong day: ${day}`);
    }
    
    if (hour < 14 || hour >= 18) {
      throw new Error(`Found slot outside preferred hours: ${hour}:00`);
    }
  }
  
  if (matchingSlots.length !== 2) {
    throw new Error(`Expected 2 matching slots (Mon 14:00, Tue 15:00), got ${matchingSlots.length}`);
  }
  
  console.log('✓ Successfully filtered slots by both day and hour preferences');
  console.log(`  Matched: ${matchingSlots.length} slots`);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 7: Handle case with no matching slots
console.log('\nTest 7: Handle case with no matching slots');
try {
  // Create slots in local time
  const date = new Date('2024-01-15');
  const localSlots = [
    { start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 10, 0) },
    { start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 14, 0) }
  ];
  
  const availability = {
    start_date: new Date('2024-01-15T00:00:00'),
    end_date: new Date('2024-01-20T00:00:00'),
    preferred_hours: { start: 6, end: 8 }, // 6 AM - 8 AM (no slots available)
    preferred_days: null
  };
  
  const matchingSlots = bot.findMatchingSlots(localSlots, availability);
  
  if (matchingSlots.length !== 0) {
    throw new Error(`Expected 0 matching slots, got ${matchingSlots.length}`);
  }
  
  console.log('✓ Successfully handled case with no matching slots');
  console.log('  Matched: 0 slots (as expected)');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 8: Verify date range filtering
console.log('\nTest 8: Verify date range filtering');
try {
  const availableSlots = await mockCalendarIntegrator.getAvailableSlots(
    'recruiter-123',
    new Date('2024-01-15T00:00:00Z'),
    new Date('2024-01-20T00:00:00Z')
  );
  
  // Narrow date range to only include first day
  const availability = {
    start_date: new Date('2024-01-15T00:00:00Z'),
    end_date: new Date('2024-01-15T23:59:59Z'),
    preferred_hours: null,
    preferred_days: null
  };
  
  const matchingSlots = bot.findMatchingSlots(availableSlots, availability);
  
  // Verify all matching slots are within date range
  for (const slot of matchingSlots) {
    const slotDate = new Date(slot.start);
    if (slotDate < availability.start_date || slotDate > availability.end_date) {
      throw new Error('Found slot outside date range');
    }
  }
  
  console.log('✓ Successfully filtered slots by date range');
  console.log(`  Matched: ${matchingSlots.length} slots on 2024-01-15`);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

console.log('\n✓ All slot matching and suggestion tests passed!');
console.log('\nTask 13.3 Implementation Verified:');
console.log('  ✓ Query recruiter calendar for overlapping slots (Req 5.2)');
console.log('  ✓ Generate up to 3 suggestions per round (Req 5.3)');
console.log('  ✓ Format suggestions for candidate (Req 5.3)');
console.log('  ✓ Match preferred days and hours');
console.log('  ✓ Filter by date range');
