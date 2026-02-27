/**
 * Unit Tests for Feature Flag System
 * 
 * Tests CRUD operations and isFeatureEnabled logic.
 * 
 * Requirements: 12.8, 12.9
 */

import { supabase } from '../database/supabaseClient.js';
import {
  isFeatureEnabled,
  getFeatureFlag,
  getAllFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  enableFeatureFlag,
  disableFeatureFlag,
  toggleFeatureFlag
} from '../utils/featureFlags.js';

describe('Feature Flag System', () => {
  let testFlagName;
  let testJobId;

  beforeEach(async () => {
    // Create a unique test flag name
    testFlagName = `test_flag_${Date.now()}`;
    
    // Create a test job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert([{
        title: 'Test Job for Feature Flags',
        description: 'Test job',
        category: 'Technology', // Required field
        posted_by: '00000000-0000-0000-0000-000000000000', // Placeholder UUID
        number_of_openings: 3,
        automation_enabled: true
      }])
      .select()
      .single();

    if (jobError) {
      console.error('Error creating test job:', jobError);
      throw jobError;
    }

    testJobId = job.id;
  });

  afterEach(async () => {
    // Clean up test flag
    await supabase
      .from('feature_flags')
      .delete()
      .eq('flag_name', testFlagName);

    // Clean up test job
    if (testJobId) {
      await supabase
        .from('jobs')
        .delete()
        .eq('id', testJobId);
    }
  });

  describe('CRUD Operations', () => {
    it('should create a new feature flag', async () => {
      const result = await createFeatureFlag(testFlagName, true, 'Test flag');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.flag_name).toBe(testFlagName);
      expect(result.data.enabled).toBe(true);
      expect(result.data.description).toBe('Test flag');
    });

    it('should get a feature flag by name', async () => {
      // Create flag first
      await createFeatureFlag(testFlagName, true, 'Test flag');

      // Get flag
      const flag = await getFeatureFlag(testFlagName);

      expect(flag).toBeDefined();
      expect(flag.flag_name).toBe(testFlagName);
      expect(flag.enabled).toBe(true);
    });

    it('should return null for non-existent flag', async () => {
      const flag = await getFeatureFlag('non_existent_flag');
      expect(flag).toBeNull();
    });

    it('should get all feature flags', async () => {
      // Create test flag
      await createFeatureFlag(testFlagName, true, 'Test flag');

      // Get all flags
      const flags = await getAllFeatureFlags();

      expect(Array.isArray(flags)).toBe(true);
      expect(flags.length).toBeGreaterThan(0);
      
      // Should include our test flag
      const testFlag = flags.find(f => f.flag_name === testFlagName);
      expect(testFlag).toBeDefined();
    });

    it('should update a feature flag', async () => {
      // Create flag
      await createFeatureFlag(testFlagName, true, 'Original description');

      // Update flag
      const result = await updateFeatureFlag(testFlagName, false, 'Updated description');

      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(false);
      expect(result.data.description).toBe('Updated description');
    });

    it('should enable a feature flag', async () => {
      // Create disabled flag
      await createFeatureFlag(testFlagName, false, 'Test flag');

      // Enable it
      const result = await enableFeatureFlag(testFlagName);

      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(true);
    });

    it('should disable a feature flag', async () => {
      // Create enabled flag
      await createFeatureFlag(testFlagName, true, 'Test flag');

      // Disable it
      const result = await disableFeatureFlag(testFlagName);

      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(false);
    });

    it('should toggle a feature flag', async () => {
      // Create enabled flag
      await createFeatureFlag(testFlagName, true, 'Test flag');

      // Toggle to disabled
      let result = await toggleFeatureFlag(testFlagName);
      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(false);

      // Toggle back to enabled
      result = await toggleFeatureFlag(testFlagName);
      expect(result.success).toBe(true);
      expect(result.data.enabled).toBe(true);
    });

    it('should delete a feature flag', async () => {
      // Create flag
      await createFeatureFlag(testFlagName, true, 'Test flag');

      // Delete it
      const result = await deleteFeatureFlag(testFlagName);
      expect(result.success).toBe(true);

      // Verify it's gone
      const flag = await getFeatureFlag(testFlagName);
      expect(flag).toBeNull();
    });
  });

  describe('isFeatureEnabled - Global Flags', () => {
    it('should return true when global flag is enabled', async () => {
      // Create enabled flag
      await createFeatureFlag(testFlagName, true, 'Test flag');

      const isEnabled = await isFeatureEnabled(testFlagName);
      expect(isEnabled).toBe(true);
    });

    it('should return false when global flag is disabled', async () => {
      // Create disabled flag
      await createFeatureFlag(testFlagName, false, 'Test flag');

      const isEnabled = await isFeatureEnabled(testFlagName);
      expect(isEnabled).toBe(false);
    });

    it('should return true (fail-open) when flag does not exist', async () => {
      const isEnabled = await isFeatureEnabled('non_existent_flag');
      expect(isEnabled).toBe(true);
    });
  });

  describe('isFeatureEnabled - Job-Level Overrides', () => {
    it('should respect job-level automation_enabled override for auto_shortlisting', async () => {
      // Create enabled global flag
      await createFeatureFlag('auto_shortlisting', true, 'Auto shortlisting');

      // Disable automation for the job
      await supabase
        .from('jobs')
        .update({ automation_enabled: false })
        .eq('id', testJobId);

      // Should return false due to job-level override
      const isEnabled = await isFeatureEnabled('auto_shortlisting', testJobId);
      expect(isEnabled).toBe(false);
    });

    it('should respect job-level automation_enabled override for auto_promotion', async () => {
      // Create enabled global flag
      await createFeatureFlag('auto_promotion', true, 'Auto promotion');

      // Disable automation for the job
      await supabase
        .from('jobs')
        .update({ automation_enabled: false })
        .eq('id', testJobId);

      // Should return false due to job-level override
      const isEnabled = await isFeatureEnabled('auto_promotion', testJobId);
      expect(isEnabled).toBe(false);
    });

    it('should respect job-level automation_enabled override for global_automation', async () => {
      // Create enabled global flag
      await createFeatureFlag('global_automation', true, 'Global automation');

      // Disable automation for the job
      await supabase
        .from('jobs')
        .update({ automation_enabled: false })
        .eq('id', testJobId);

      // Should return false due to job-level override
      const isEnabled = await isFeatureEnabled('global_automation', testJobId);
      expect(isEnabled).toBe(false);
    });

    it('should return true when both global and job-level flags are enabled', async () => {
      // Create enabled global flag
      await createFeatureFlag('auto_shortlisting', true, 'Auto shortlisting');

      // Enable automation for the job
      await supabase
        .from('jobs')
        .update({ automation_enabled: true })
        .eq('id', testJobId);

      // Should return true
      const isEnabled = await isFeatureEnabled('auto_shortlisting', testJobId);
      expect(isEnabled).toBe(true);
    });

    it('should return false when global flag is disabled regardless of job setting', async () => {
      // Create disabled global flag
      await createFeatureFlag('auto_shortlisting', false, 'Auto shortlisting');

      // Enable automation for the job
      await supabase
        .from('jobs')
        .update({ automation_enabled: true })
        .eq('id', testJobId);

      // Should return false because global flag is disabled
      const isEnabled = await isFeatureEnabled('auto_shortlisting', testJobId);
      expect(isEnabled).toBe(false);
    });

    it('should use global flag for features without job-level overrides', async () => {
      // Create enabled global flag for a feature without job-level override
      await createFeatureFlag('negotiation_bot', true, 'Negotiation bot');

      // Disable automation for the job (should not affect negotiation_bot)
      await supabase
        .from('jobs')
        .update({ automation_enabled: false })
        .eq('id', testJobId);

      // Should return true because negotiation_bot doesn't have job-level override
      const isEnabled = await isFeatureEnabled('negotiation_bot', testJobId);
      expect(isEnabled).toBe(true);
    });

    it('should handle non-existent job gracefully', async () => {
      // Create enabled global flag
      await createFeatureFlag('auto_shortlisting', true, 'Auto shortlisting');

      // Use non-existent job ID
      const fakeJobId = '00000000-0000-0000-0000-000000000001';
      
      // Should fall back to global flag
      const isEnabled = await isFeatureEnabled('auto_shortlisting', fakeJobId);
      expect(isEnabled).toBe(true);
    });
  });

  describe('Default Feature Flags', () => {
    it('should have global_automation flag in database', async () => {
      const flag = await getFeatureFlag('global_automation');
      expect(flag).toBeDefined();
      expect(flag.flag_name).toBe('global_automation');
    });

    it('should have auto_shortlisting flag in database', async () => {
      const flag = await getFeatureFlag('auto_shortlisting');
      expect(flag).toBeDefined();
      expect(flag.flag_name).toBe('auto_shortlisting');
    });

    it('should have auto_promotion flag in database', async () => {
      const flag = await getFeatureFlag('auto_promotion');
      expect(flag).toBeDefined();
      expect(flag.flag_name).toBe('auto_promotion');
    });

    it('should have negotiation_bot flag in database', async () => {
      const flag = await getFeatureFlag('negotiation_bot');
      expect(flag).toBeDefined();
      expect(flag.flag_name).toBe('negotiation_bot');
    });

    it('should have no_show_prediction flag in database', async () => {
      const flag = await getFeatureFlag('no_show_prediction');
      expect(flag).toBeDefined();
      expect(flag.flag_name).toBe('no_show_prediction');
    });

    it('should have calendar_integration flag in database', async () => {
      const flag = await getFeatureFlag('calendar_integration');
      expect(flag).toBeDefined();
      expect(flag.flag_name).toBe('calendar_integration');
    });
  });
});
