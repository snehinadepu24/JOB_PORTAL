/**
 * Feature Flag System
 * 
 * Provides runtime feature control for automation features.
 * Supports global flags and job-level overrides.
 * 
 * Requirements: 12.8, 12.9
 * 
 * Key Features:
 * - Global feature flags (apply to all jobs)
 * - Job-level overrides (specific job can override global setting)
 * - Default behavior when flag doesn't exist (automation enabled by default)
 * - CRUD operations for feature flags
 */

import { supabase } from '../database/supabaseClient.js';

/**
 * Check if a feature is enabled
 * 
 * Checks both global flag and job-level overrides.
 * 
 * Logic:
 * 1. Check global flag - if disabled, return false
 * 2. Check job-level override if jobId provided
 * 3. Default to true if flag doesn't exist (fail-open for backward compatibility)
 * 
 * Requirements: 12.8, 12.9
 * 
 * @param {string} flagName - Name of the feature flag
 * @param {string|null} jobId - Optional job ID for job-level overrides
 * @returns {Promise<boolean>} True if feature is enabled
 */
export async function isFeatureEnabled(flagName, jobId = null) {
  try {
    // 1. Check global flag
    const { data: globalFlag, error: flagError } = await supabase
      .from('feature_flags')
      .select('enabled')
      .eq('flag_name', flagName)
      .single();

    // If flag doesn't exist, default to enabled (fail-open for backward compatibility)
    if (flagError || !globalFlag) {
      console.log(`[FeatureFlags] Flag '${flagName}' not found, defaulting to enabled`);
      return true;
    }

    // If global flag is disabled, return false immediately
    if (!globalFlag.enabled) {
      console.log(`[FeatureFlags] Global flag '${flagName}' is disabled`);
      return false;
    }

    // 2. Check job-level override if jobId provided
    if (jobId) {
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('automation_enabled')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        console.log(`[FeatureFlags] Job ${jobId} not found, using global flag`);
        return globalFlag.enabled;
      }

      // Check job-specific automation settings
      // Map feature flags to job-level settings
      const jobLevelOverrides = {
        'auto_shortlisting': job.automation_enabled,
        'auto_promotion': job.automation_enabled,
        'global_automation': job.automation_enabled
      };

      // If this flag has a job-level override, use it
      if (jobLevelOverrides.hasOwnProperty(flagName)) {
        const isEnabled = jobLevelOverrides[flagName];
        console.log(`[FeatureFlags] Job ${jobId} override for '${flagName}': ${isEnabled}`);
        return isEnabled;
      }
    }

    // 3. Return global flag value
    console.log(`[FeatureFlags] Flag '${flagName}' is ${globalFlag.enabled ? 'enabled' : 'disabled'}`);
    return globalFlag.enabled;
  } catch (error) {
    console.error(`[FeatureFlags] Error checking feature flag '${flagName}':`, error);
    // Fail-open: if we can't check the flag, allow the feature
    return true;
  }
}

/**
 * Get a feature flag by name
 * 
 * @param {string} flagName - Name of the feature flag
 * @returns {Promise<Object>} Feature flag object or null
 */
export async function getFeatureFlag(flagName) {
  try {
    const { data: flag, error } = await supabase
      .from('feature_flags')
      .select('*')
      .eq('flag_name', flagName)
      .single();

    if (error) {
      console.error(`[FeatureFlags] Error fetching flag '${flagName}':`, error);
      return null;
    }

    return flag;
  } catch (error) {
    console.error(`[FeatureFlags] Error in getFeatureFlag:`, error);
    return null;
  }
}

/**
 * Get all feature flags
 * 
 * @returns {Promise<Array>} Array of feature flag objects
 */
export async function getAllFeatureFlags() {
  try {
    const { data: flags, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('flag_name', { ascending: true });

    if (error) {
      console.error('[FeatureFlags] Error fetching all flags:', error);
      return [];
    }

    return flags || [];
  } catch (error) {
    console.error('[FeatureFlags] Error in getAllFeatureFlags:', error);
    return [];
  }
}

/**
 * Create a new feature flag
 * 
 * @param {string} flagName - Name of the feature flag
 * @param {boolean} enabled - Whether the flag is enabled
 * @param {string} description - Description of the flag
 * @returns {Promise<Object>} Created feature flag or error
 */
export async function createFeatureFlag(flagName, enabled = false, description = '') {
  try {
    const { data: flag, error } = await supabase
      .from('feature_flags')
      .insert([{
        flag_name: flagName,
        enabled: enabled,
        description: description
      }])
      .select()
      .single();

    if (error) {
      console.error(`[FeatureFlags] Error creating flag '${flagName}':`, error);
      return { success: false, error: error.message };
    }

    console.log(`[FeatureFlags] Created flag '${flagName}': ${enabled}`);
    return { success: true, data: flag };
  } catch (error) {
    console.error('[FeatureFlags] Error in createFeatureFlag:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a feature flag
 * 
 * @param {string} flagName - Name of the feature flag
 * @param {boolean} enabled - Whether the flag is enabled
 * @param {string} description - Optional description update
 * @returns {Promise<Object>} Updated feature flag or error
 */
export async function updateFeatureFlag(flagName, enabled, description = null) {
  try {
    const updates = { enabled };
    if (description !== null) {
      updates.description = description;
    }

    const { data: flag, error } = await supabase
      .from('feature_flags')
      .update(updates)
      .eq('flag_name', flagName)
      .select()
      .single();

    if (error) {
      console.error(`[FeatureFlags] Error updating flag '${flagName}':`, error);
      return { success: false, error: error.message };
    }

    console.log(`[FeatureFlags] Updated flag '${flagName}': ${enabled}`);
    return { success: true, data: flag };
  } catch (error) {
    console.error('[FeatureFlags] Error in updateFeatureFlag:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a feature flag
 * 
 * @param {string} flagName - Name of the feature flag
 * @returns {Promise<Object>} Success status
 */
export async function deleteFeatureFlag(flagName) {
  try {
    const { error } = await supabase
      .from('feature_flags')
      .delete()
      .eq('flag_name', flagName);

    if (error) {
      console.error(`[FeatureFlags] Error deleting flag '${flagName}':`, error);
      return { success: false, error: error.message };
    }

    console.log(`[FeatureFlags] Deleted flag '${flagName}'`);
    return { success: true };
  } catch (error) {
    console.error('[FeatureFlags] Error in deleteFeatureFlag:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Enable a feature flag
 * 
 * @param {string} flagName - Name of the feature flag
 * @returns {Promise<Object>} Updated feature flag or error
 */
export async function enableFeatureFlag(flagName) {
  return updateFeatureFlag(flagName, true);
}

/**
 * Disable a feature flag
 * 
 * @param {string} flagName - Name of the feature flag
 * @returns {Promise<Object>} Updated feature flag or error
 */
export async function disableFeatureFlag(flagName) {
  return updateFeatureFlag(flagName, false);
}

/**
 * Toggle a feature flag
 * 
 * @param {string} flagName - Name of the feature flag
 * @returns {Promise<Object>} Updated feature flag or error
 */
export async function toggleFeatureFlag(flagName) {
  try {
    const flag = await getFeatureFlag(flagName);
    if (!flag) {
      return { success: false, error: 'Flag not found' };
    }

    return updateFeatureFlag(flagName, !flag.enabled);
  } catch (error) {
    console.error('[FeatureFlags] Error in toggleFeatureFlag:', error);
    return { success: false, error: error.message };
  }
}

// Export all functions
export default {
  isFeatureEnabled,
  getFeatureFlag,
  getAllFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  enableFeatureFlag,
  disableFeatureFlag,
  toggleFeatureFlag
};
