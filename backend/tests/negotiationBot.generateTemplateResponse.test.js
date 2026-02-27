/**
 * Unit tests for NegotiationBot.generateTemplateResponse method
 * Task 3.1: Refactor existing response generation into generateTemplateResponse
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import NegotiationBot from '../managers/NegotiationBot.js';

describe('NegotiationBot.generateTemplateResponse', () => {
  let bot;

  beforeAll(() => {
    // Create bot without Gemini client for testing template responses
    bot = new NegotiationBot(null, null, null);
  });

  it('should generate clarification response', () => {
    const response = bot.generateTemplateResponse('clarification');
    
    expect(response).toBeTruthy();
    expect(response).toContain('available dates and times');
    expect(response).toContain('example');
  });

  it('should generate slot suggestions response', () => {
    const slots = [
      { start: new Date('2024-01-15T15:30:00Z'), end: new Date('2024-01-15T16:30:00Z') },
      { start: new Date('2024-01-16T19:00:00Z'), end: new Date('2024-01-16T20:00:00Z') }
    ];

    const response = bot.generateTemplateResponse('slot_suggestions', { slots });
    
    expect(response).toBeTruthy();
    expect(response).toContain('available times');
    expect(response).toContain('1.');
    expect(response).toContain('2.');
  });

  it('should throw error when slots missing for slot_suggestions', () => {
    expect(() => {
      bot.generateTemplateResponse('slot_suggestions', {});
    }).toThrow('Slots required');
  });

  it('should generate request alternatives response', () => {
    const response = bot.generateTemplateResponse('request_alternatives', {
      round: 2,
      maxRounds: 3
    });
    
    expect(response).toBeTruthy();
    expect(response).toContain('alternative times');
    expect(response).toContain('Attempt 2 of 3');
  });

  it('should use default values for request alternatives', () => {
    const response = bot.generateTemplateResponse('request_alternatives', {});
    
    expect(response).toBeTruthy();
    expect(response).toContain('Attempt 1 of');
  });

  it('should generate escalation response', () => {
    const response = bot.generateTemplateResponse('escalation');
    
    expect(response).toBeTruthy();
    expect(response).toContain('recruiter');
    expect(response).toContain('reach out');
  });

  it('should throw error for unknown response type', () => {
    expect(() => {
      bot.generateTemplateResponse('unknown_type', {});
    }).toThrow('Unknown response type');
  });

  it('should preserve existing response formats', () => {
    // Test that the refactored method produces the same responses as before
    
    // Clarification
    const clarification = bot.generateTemplateResponse('clarification');
    expect(clarification).toBe("I'd be happy to help find a suitable time. Could you please provide your available dates and times? For example: 'I'm available Monday-Wednesday next week, 2-5 PM' or 'I'm free on 12/15 and 12/16 in the afternoon'.");

    // Escalation
    const escalation = bot.generateTemplateResponse('escalation');
    expect(escalation).toBe("I haven't been able to find a matching time after several attempts. I've notified the recruiter, who will reach out to you directly to schedule the interview. Thank you for your patience!");

    // Request alternatives with specific values
    const requestAlt = bot.generateTemplateResponse('request_alternatives', {
      round: 2,
      maxRounds: 3
    });
    expect(requestAlt).toBe("Unfortunately, those times don't align with the recruiter's availability. Could you provide some alternative times? (Attempt 2 of 3)");
  });
});
