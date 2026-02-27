/**
 * Unit Tests for Gemini Feature Flags
 * 
 * Tests that the three Gemini feature flags are properly integrated
 * with the feature flag system.
 */

import {
  isFeatureEnabled,
  getFeatureFlag,
  enableFeatureFlag,
  disableFeatureFlag
} from '../utils/featureFlags.js';

describe('Gemini Feature Flags', () => {
  describe('Flag Existence', () => {
    it('should have gemini_enabled flag', async () => {
      const flag = await getFeatureFlag('gemini_enabled');
      expect(flag).toBeDefined();
      expect(flag.flag_name).toBe('gemini_enabled');
      expect(flag.description).toBe('Master flag for all Gemini LLM features');
    });

    it('should have gemini_parsing flag', async () => {
      const flag = await getFeatureFlag('gemini_parsing');
      expect(flag).toBeDefined();
      expect(flag.flag_name).toBe('gemini_parsing');
      expect(flag.description).toBe('Enable Gemini-powered availability parsing');
    });

    it('should have gemini_responses flag', async () => {
      const flag = await getFeatureFlag('gemini_responses');
      expect(flag).toBeDefined();
      expect(flag.flag_name).toBe('gemini_responses');
      expect(flag.description).toBe('Enable Gemini-powered response generation');
    });
  });

  describe('Default State', () => {
    it('should have gemini_enabled disabled by default', async () => {
      const isEnabled = await isFeatureEnabled('gemini_enabled');
      // Note: isFeatureEnabled returns true for non-existent flags (fail-open)
      // But for existing flags, it returns the actual value
      const flag = await getFeatureFlag('gemini_enabled');
      expect(flag.enabled).toBe(false);
    });

    it('should have gemini_parsing disabled by default', async () => {
      const flag = await getFeatureFlag('gemini_parsing');
      expect(flag.enabled).toBe(false);
    });

    it('should have gemini_responses disabled by default', async () => {
      const flag = await getFeatureFlag('gemini_responses');
      expect(flag.enabled).toBe(false);
    });
  });

  describe('Flag Control', () => {
    afterEach(async () => {
      // Reset flags to disabled state after each test
      await disableFeatureFlag('gemini_enabled');
      await disableFeatureFlag('gemini_parsing');
      await disableFeatureFlag('gemini_responses');
    });

    it('should enable gemini_enabled flag', async () => {
      const result = await enableFeatureFlag('gemini_enabled');
      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(true);

      const flag = await getFeatureFlag('gemini_enabled');
      expect(flag.enabled).toBe(true);
    });

    it('should disable gemini_enabled flag', async () => {
      // First enable it
      await enableFeatureFlag('gemini_enabled');
      
      // Then disable it
      const result = await disableFeatureFlag('gemini_enabled');
      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(false);

      const flag = await getFeatureFlag('gemini_enabled');
      expect(flag.enabled).toBe(false);
    });

    it('should enable gemini_parsing flag', async () => {
      const result = await enableFeatureFlag('gemini_parsing');
      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(true);

      const flag = await getFeatureFlag('gemini_parsing');
      expect(flag.enabled).toBe(true);
    });

    it('should enable gemini_responses flag', async () => {
      const result = await enableFeatureFlag('gemini_responses');
      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(true);

      const flag = await getFeatureFlag('gemini_responses');
      expect(flag.enabled).toBe(true);
    });
  });

  describe('isFeatureEnabled Integration', () => {
    afterEach(async () => {
      // Reset flags to disabled state after each test
      await disableFeatureFlag('gemini_enabled');
      await disableFeatureFlag('gemini_parsing');
      await disableFeatureFlag('gemini_responses');
    });

    it('should return false when gemini_enabled is disabled', async () => {
      await disableFeatureFlag('gemini_enabled');
      const isEnabled = await isFeatureEnabled('gemini_enabled');
      expect(isEnabled).toBe(false);
    });

    it('should return true when gemini_enabled is enabled', async () => {
      await enableFeatureFlag('gemini_enabled');
      const isEnabled = await isFeatureEnabled('gemini_enabled');
      expect(isEnabled).toBe(true);
    });

    it('should return false when gemini_parsing is disabled', async () => {
      await disableFeatureFlag('gemini_parsing');
      const isEnabled = await isFeatureEnabled('gemini_parsing');
      expect(isEnabled).toBe(false);
    });

    it('should return true when gemini_parsing is enabled', async () => {
      await enableFeatureFlag('gemini_parsing');
      const isEnabled = await isFeatureEnabled('gemini_parsing');
      expect(isEnabled).toBe(true);
    });

    it('should return false when gemini_responses is disabled', async () => {
      await disableFeatureFlag('gemini_responses');
      const isEnabled = await isFeatureEnabled('gemini_responses');
      expect(isEnabled).toBe(false);
    });

    it('should return true when gemini_responses is enabled', async () => {
      await enableFeatureFlag('gemini_responses');
      const isEnabled = await isFeatureEnabled('gemini_responses');
      expect(isEnabled).toBe(true);
    });
  });

  describe('Independent Flag Control', () => {
    afterEach(async () => {
      // Reset all flags
      await disableFeatureFlag('gemini_enabled');
      await disableFeatureFlag('gemini_parsing');
      await disableFeatureFlag('gemini_responses');
    });

    it('should allow enabling gemini_parsing independently of gemini_enabled', async () => {
      await disableFeatureFlag('gemini_enabled');
      await enableFeatureFlag('gemini_parsing');

      const masterEnabled = await isFeatureEnabled('gemini_enabled');
      const parsingEnabled = await isFeatureEnabled('gemini_parsing');

      expect(masterEnabled).toBe(false);
      expect(parsingEnabled).toBe(true);
    });

    it('should allow enabling gemini_responses independently of gemini_enabled', async () => {
      await disableFeatureFlag('gemini_enabled');
      await enableFeatureFlag('gemini_responses');

      const masterEnabled = await isFeatureEnabled('gemini_enabled');
      const responsesEnabled = await isFeatureEnabled('gemini_responses');

      expect(masterEnabled).toBe(false);
      expect(responsesEnabled).toBe(true);
    });

    it('should allow enabling all three flags independently', async () => {
      await enableFeatureFlag('gemini_enabled');
      await enableFeatureFlag('gemini_parsing');
      await enableFeatureFlag('gemini_responses');

      const masterEnabled = await isFeatureEnabled('gemini_enabled');
      const parsingEnabled = await isFeatureEnabled('gemini_parsing');
      const responsesEnabled = await isFeatureEnabled('gemini_responses');

      expect(masterEnabled).toBe(true);
      expect(parsingEnabled).toBe(true);
      expect(responsesEnabled).toBe(true);
    });
  });
});
