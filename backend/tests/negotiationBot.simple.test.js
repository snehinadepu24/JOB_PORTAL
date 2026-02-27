/**
 * Simple tests for NegotiationBot
 * Tests basic session management and message processing
 */

import NegotiationBot from '../managers/NegotiationBot.js';

console.log('Testing NegotiationBot...\n');

// Create mock dependencies
const mockCalendarIntegrator = {
  getAvailableSlots: async (recruiterId, startDate, endDate) => {
    // Return mock slots
    const slots = [];
    const start = new Date(startDate);
    start.setHours(10, 0, 0, 0);
    
    for (let i = 0; i < 5; i++) {
      const slotStart = new Date(start);
      slotStart.setDate(start.getDate() + i);
      
      const slotEnd = new Date(slotStart);
      slotEnd.setHours(11, 0, 0, 0);
      
      slots.push({ start: slotStart, end: slotEnd });
    }
    
    return slots;
  }
};

const mockEmailService = {
  queueEmail: async (emailData) => {
    return { success: true };
  }
};

const bot = new NegotiationBot(mockCalendarIntegrator, mockEmailService);

// Test 1: Parse availability from message with "next week"
console.log('Test 1: Parse availability from "next week" message');
try {
  const availability = bot.parseAvailability("I'm available next week");
  
  if (!availability) {
    throw new Error('Failed to parse availability');
  }
  
  if (!(availability.start_date instanceof Date)) {
    throw new Error('start_date is not a Date');
  }
  
  if (!(availability.end_date instanceof Date)) {
    throw new Error('end_date is not a Date');
  }
  
  if (availability.end_date <= availability.start_date) {
    throw new Error('end_date should be after start_date');
  }
  
  console.log('✓ Successfully parsed "next week" availability');
  console.log('  Start:', availability.start_date.toISOString());
  console.log('  End:', availability.end_date.toISOString());
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 2: Parse availability with time preferences
console.log('\nTest 2: Parse availability with time preferences');
try {
  const availability = bot.parseAvailability("I'm free Monday afternoon");
  
  if (!availability) {
    throw new Error('Failed to parse availability');
  }
  
  if (!availability.preferred_hours) {
    throw new Error('preferred_hours not parsed');
  }
  
  if (availability.preferred_hours.start !== 12) {
    throw new Error(`Expected start hour 12, got ${availability.preferred_hours.start}`);
  }
  
  if (availability.preferred_hours.end !== 18) {
    throw new Error(`Expected end hour 18, got ${availability.preferred_hours.end}`);
  }
  
  console.log('✓ Successfully parsed time preferences');
  console.log('  Preferred hours:', availability.preferred_hours);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 3: Parse morning preference
console.log('\nTest 3: Parse morning preference');
try {
  const availability = bot.parseAvailability("I'm available this week in the morning");
  
  if (!availability) {
    throw new Error('Failed to parse availability');
  }
  
  if (!availability.preferred_hours) {
    throw new Error('preferred_hours not parsed');
  }
  
  if (availability.preferred_hours.start !== 9) {
    throw new Error(`Expected start hour 9, got ${availability.preferred_hours.start}`);
  }
  
  if (availability.preferred_hours.end !== 12) {
    throw new Error(`Expected end hour 12, got ${availability.preferred_hours.end}`);
  }
  
  console.log('✓ Successfully parsed morning preference');
  console.log('  Preferred hours:', availability.preferred_hours);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 4: Format slot suggestions
console.log('\nTest 4: Format slot suggestions');
try {
  const slots = [
    { start: new Date('2024-01-15T10:00:00Z'), end: new Date('2024-01-15T11:00:00Z') },
    { start: new Date('2024-01-16T14:00:00Z'), end: new Date('2024-01-16T15:00:00Z') }
  ];
  
  const formatted = bot.formatSlotSuggestions(slots);
  
  if (!formatted.includes('1.')) {
    throw new Error('Missing numbered list item 1');
  }
  
  if (!formatted.includes('2.')) {
    throw new Error('Missing numbered list item 2');
  }
  
  if (!formatted.includes('reply with the number')) {
    throw new Error('Missing instruction text');
  }
  
  console.log('✓ Successfully formatted slot suggestions');
  console.log('  Sample output:', formatted.substring(0, 100) + '...');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 5: Filter slots by preferred days
console.log('\nTest 5: Filter slots by preferred days');
try {
  const availableSlots = [
    { start: new Date('2024-01-15T10:00:00Z') }, // Monday
    { start: new Date('2024-01-16T10:00:00Z') }, // Tuesday
    { start: new Date('2024-01-17T10:00:00Z') }  // Wednesday
  ];
  
  const availability = {
    start_date: new Date('2024-01-15T00:00:00Z'),
    end_date: new Date('2024-01-20T00:00:00Z'),
    preferred_days: ['monday', 'wednesday']
  };
  
  const matching = bot.findMatchingSlots(availableSlots, availability);
  
  if (matching.length !== 2) {
    throw new Error(`Expected 2 matching slots, got ${matching.length}`);
  }
  
  if (matching[0].start.getDay() !== 1) {
    throw new Error('First slot should be Monday');
  }
  
  if (matching[1].start.getDay() !== 3) {
    throw new Error('Second slot should be Wednesday');
  }
  
  console.log('✓ Successfully filtered slots by preferred days');
  console.log('  Matched:', matching.length, 'slots');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 6: Filter slots by preferred hours
console.log('\nTest 6: Filter slots by preferred hours');
try {
  // Create dates with local times instead of UTC
  const date = new Date('2024-01-15');
  const slot1 = new Date(date);
  slot1.setHours(9, 0, 0, 0);
  
  const slot2 = new Date(date);
  slot2.setHours(14, 0, 0, 0);
  
  const slot3 = new Date(date);
  slot3.setHours(17, 0, 0, 0);
  
  const availableSlots = [
    { start: slot1 }, // 9 AM local
    { start: slot2 }, // 2 PM local
    { start: slot3 }  // 5 PM local
  ];
  
  const availability = {
    start_date: new Date('2024-01-15T00:00:00'),
    end_date: new Date('2024-01-20T00:00:00'),
    preferred_hours: { start: 14, end: 18 } // 2 PM - 6 PM
  };
  
  const matching = bot.findMatchingSlots(availableSlots, availability);
  
  if (matching.length !== 2) {
    throw new Error(`Expected 2 matching slots, got ${matching.length}`);
  }
  
  if (matching[0].start.getHours() !== 14) {
    throw new Error('First slot should be at 14:00');
  }
  
  if (matching[1].start.getHours() !== 17) {
    throw new Error('Second slot should be at 17:00');
  }
  
  console.log('✓ Successfully filtered slots by preferred hours');
  console.log('  Matched:', matching.length, 'slots');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 7: Parse time range
console.log('\nTest 7: Parse time range from time strings');
try {
  const times = ['2pm', '5pm'];
  const timeRange = bot.parseTimeRange(times);
  
  if (!timeRange) {
    throw new Error('Failed to parse time range');
  }
  
  if (timeRange.start !== 14) {
    throw new Error(`Expected start hour 14, got ${timeRange.start}`);
  }
  
  if (timeRange.end !== 17) {
    throw new Error(`Expected end hour 17, got ${timeRange.end}`);
  }
  
  console.log('✓ Successfully parsed time range');
  console.log('  Range:', timeRange);
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

// Test 8: Return null for unclear messages
console.log('\nTest 8: Return null for unclear availability messages');
try {
  const availability = bot.parseAvailability("I can't make it");
  
  if (availability !== null) {
    throw new Error('Should return null for unclear message');
  }
  
  console.log('✓ Correctly returned null for unclear message');
} catch (error) {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
}

console.log('\n✓ All NegotiationBot tests passed!');
