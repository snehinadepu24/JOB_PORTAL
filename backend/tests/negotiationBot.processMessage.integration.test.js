/**
 * Integration test for Task 3.3: Verify processMessage uses generateResponse
 * 
 * This test verifies that all four response generation points in processMessage
 * now call generateResponse instead of generateTemplateResponse directly.
 */

import { jest } from '@jest/globals';

describe('NegotiationBot.processMessage - generateResponse integration', () => {
  let NegotiationBot;
  let mockGeminiClient;
  let mockCalendarIntegrator;
  let bot;

  beforeAll(async () => {
    // Import NegotiationBot
    const module = await import('../managers/NegotiationBot.js');
    NegotiationBot = module.default;
  });

  beforeEach(() => {
    // Mock GeminiClient
    mockGeminiClient = {
      generateResponse: jest.fn()
    };

    // Mock CalendarIntegrator
    mockCalendarIntegrator = {
      getAvailableSlots: jest.fn()
    };

    // Create bot instance with mocks
    bot = new NegotiationBot(mockCalendarIntegrator, mockGeminiClient);
    
    // Spy on generateResponse to verify it's called
    jest.spyOn(bot, 'generateResponse');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('processMessage calls generateResponse for clarification (no availability parsed)', async () => {
    const session = {
      id: 'test-session-1',
      interview_id: 'test-interview-1',
      round: 1,
      state: 'active',
      history: []
    };

    const message = 'Hello';

    // Mock parseAvailability to return null (triggers clarification)
    jest.spyOn(bot, 'parseAvailability').mockResolvedValue(null);

    // Mock generateResponse to return a template response
    bot.generateResponse.mockResolvedValue("I'd be happy to help find a suitable time.");

    // Mock updateSession
    jest.spyOn(bot, 'updateSession').mockResolvedValue();

    await bot.processMessage(session, message);

    // Verify generateResponse was called with correct parameters
    expect(bot.generateResponse).toHaveBeenCalledWith('clarification', expect.objectContaining({
      history: expect.any(Array)
    }));
  });

  test('processMessage calls generateResponse for slot_suggestions (matching slots found)', async () => {
    const session = {
      id: 'test-session-2',
      interview_id: 'test-interview-2',
      round: 1,
      state: 'active',
      history: []
    };

    const message = 'I am available Monday 2-5pm';

    const availability = {
      start_date: new Date('2024-12-16'),
      end_date: new Date('2024-12-16'),
      preferred_hours: { start: 14, end: 17 },
      preferred_days: ['monday']
    };

    const availableSlots = [
      { start: new Date('2024-12-16T14:00:00Z'), end: new Date('2024-12-16T15:00:00Z') }
    ];

    // Mock dependencies
    jest.spyOn(bot, 'parseAvailability').mockResolvedValue(availability);
    mockCalendarIntegrator.getAvailableSlots.mockResolvedValue(availableSlots);
    jest.spyOn(bot, 'findMatchingSlots').mockReturnValue(availableSlots);
    bot.generateResponse.mockResolvedValue('Great! I found some matching times.');
    jest.spyOn(bot, 'updateSession').mockResolvedValue();

    // Mock supabase query
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'test-interview-2',
          recruiter_id: 'recruiter-1',
          job_id: 'job-1'
        }
      })
    };
    
    // Temporarily replace supabase import
    const originalSupabase = bot.supabase;
    bot.supabase = mockSupabase;

    await bot.processMessage(session, message);

    // Restore supabase
    bot.supabase = originalSupabase;

    // Verify generateResponse was called with correct parameters
    expect(bot.generateResponse).toHaveBeenCalledWith('slot_suggestions', expect.objectContaining({
      slots: expect.any(Array),
      history: expect.any(Array)
    }));
  });

  test('processMessage calls generateResponse for request_alternatives (no matching slots)', async () => {
    const session = {
      id: 'test-session-3',
      interview_id: 'test-interview-3',
      round: 1,
      state: 'active',
      history: []
    };

    const message = 'I am available Monday 2-5pm';

    const availability = {
      start_date: new Date('2024-12-16'),
      end_date: new Date('2024-12-16'),
      preferred_hours: { start: 14, end: 17 },
      preferred_days: ['monday']
    };

    // Mock dependencies
    jest.spyOn(bot, 'parseAvailability').mockResolvedValue(availability);
    mockCalendarIntegrator.getAvailableSlots.mockResolvedValue([]);
    jest.spyOn(bot, 'findMatchingSlots').mockReturnValue([]);
    bot.generateResponse.mockResolvedValue('Unfortunately, those times don\'t work.');
    jest.spyOn(bot, 'updateSession').mockResolvedValue();

    // Mock supabase query
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'test-interview-3',
          recruiter_id: 'recruiter-1',
          job_id: 'job-1'
        }
      })
    };
    
    bot.supabase = mockSupabase;

    await bot.processMessage(session, message);

    // Verify generateResponse was called with correct parameters
    expect(bot.generateResponse).toHaveBeenCalledWith('request_alternatives', expect.objectContaining({
      round: 2,
      maxRounds: bot.MAX_ROUNDS,
      history: expect.any(Array)
    }));
  });

  test('processMessage calls generateResponse for escalation (max rounds exceeded)', async () => {
    const session = {
      id: 'test-session-4',
      interview_id: 'test-interview-4',
      round: 3, // MAX_ROUNDS is 3, so next round will be 4
      state: 'active',
      history: []
    };

    const message = 'I am available Monday 2-5pm';

    const availability = {
      start_date: new Date('2024-12-16'),
      end_date: new Date('2024-12-16'),
      preferred_hours: { start: 14, end: 17 },
      preferred_days: ['monday']
    };

    // Mock dependencies
    jest.spyOn(bot, 'parseAvailability').mockResolvedValue(availability);
    mockCalendarIntegrator.getAvailableSlots.mockResolvedValue([]);
    jest.spyOn(bot, 'findMatchingSlots').mockReturnValue([]);
    jest.spyOn(bot, 'escalateToRecruiter').mockResolvedValue();
    bot.generateResponse.mockResolvedValue('I\'ve notified the recruiter.');
    jest.spyOn(bot, 'updateSession').mockResolvedValue();

    // Mock supabase query
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'test-interview-4',
          recruiter_id: 'recruiter-1',
          job_id: 'job-1'
        }
      })
    };
    
    bot.supabase = mockSupabase;

    await bot.processMessage(session, message);

    // Verify generateResponse was called with correct parameters
    expect(bot.generateResponse).toHaveBeenCalledWith('escalation', expect.objectContaining({
      history: expect.any(Array),
      round: 4,
      maxRounds: bot.MAX_ROUNDS
    }));
  });
});
