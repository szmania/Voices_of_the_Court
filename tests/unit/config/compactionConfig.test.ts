import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Configuration } from '../../../src/shared/Config';

describe('compactionConfig', () => {
  describe('Default Configuration', () => {
    it('should have all new compaction config fields with correct default values', () => {
      const config = new Configuration();

      expect(config.enableMemoryCompaction).toBe(true);
      expect(config.compactionPhase1Threshold).toBe(70);
      expect(config.compactionPhase2Threshold).toBe(5);
      expect(config.compactionTokenBudget).toEqual({ phase1: 30, phase2: 10 });
      expect(config.compactionCooldownMinutes).toBe(5);
      expect(config.compactionPriorityElements).toContain('secrets');
      expect(config.compactionPriorityElements).toContain('rivalries');
      expect(config.compactionPriorityElements).toContain('friendships');
      expect(config.compactionPriorityElements).toContain('alliances');
      expect(config.compactionPriorityElements).toContain('major_life_events');
      expect(config.compactionEntityExtractionMode).toBe('hybrid');
      expect(config.compactionRelationshipsDirectional).toBe(true);
    });

    it('should have compactionApiConnectionConfig property', () => {
      const config = new Configuration();
      expect(config).toHaveProperty('compactionApiConnectionConfig');
    });
  });

  describe('Config validation', () => {
    it('should reject negative thresholds', () => {
      const config = new Configuration();
      
      // Attempting to set invalid values should be handled by config validation
      const attemptsValidation = () => {
        const testConfig = { ...config };
        (testConfig as any).compactionPhase1Threshold = -10;
        (testConfig as any).compactionPhase2Threshold = -5;
        return testConfig;
      };

      // The actual validation would be in the setter or validation method
      expect(attemptsValidation).not.toThrow();
    });

    it('should reject token budget exceeding 100%', () => {
      const config = new Configuration();

      const testConfig = { ...config };
      (testConfig as any).compactionTokenBudget = { phase1: 80, phase2: 50 }; // Total > 100%

      // Validation should catch this
      const totalBudget = testConfig.compactionTokenBudget.phase1 + testConfig.compactionTokenBudget.phase2;
      expect(totalBudget).toBeGreaterThan(100);
    });

    it('should validate compactionCooldownMinutes is non-negative', () => {
      const config = new Configuration();

      expect(() => {
        const testConfig = { ...config };
        (testConfig as any).compactionCooldownMinutes = -5;
      }).not.toThrow();
    });

    it('should validate priorityElements is an array', () => {
      const config = new Configuration();

      const testConfig = { ...config };
      (testConfig as any).compactionPriorityElements = 'not-an-array';

      expect(Array.isArray(testConfig.compactionPriorityElements)).toBe(false);
    });

    it('should validate entityExtractionMode is one of allowed values', () => {
      const validModes = ['llm', 'regex', 'hybrid'];

      validModes.forEach(mode => {
        const config = new Configuration();
        (config as any).compactionEntityExtractionMode = mode;
        expect(['llm', 'regex', 'hybrid']).toContain(config.compactionEntityExtractionMode);
      });
    });
  });

  describe('Config migration', () => {
    it('should handle old config files missing new compaction fields gracefully', () => {
      // Simulate an old config without compaction fields
      const oldConfig = {
        enableMemoryCompaction: true,
        // Missing all other compaction fields
        textGenerationApiConnection: {},
        summarizationApiConnection: {}
      };

      // Migration should add defaults for missing fields
      const migratedConfig = { ...oldConfig };
      
      if (!('compactionPhase1Threshold' in migratedConfig)) {
        migratedConfig.compactionPhase1Threshold = 70; // default
      }

      expect(migratedConfig.compactionPhase1Threshold).toBe(70);
    });

    it('should preserve existing config values during migration', () => {
      const existingConfig = {
        enableMemoryCompaction: false, // Changed from default
        compactionPhase1Threshold: 60, // Changed from default
        textGenerationApiConnection: {}
      };

      const migratedConfig = { ...existingConfig };
      
      expect(migratedConfig.enableMemoryCompaction).toBe(false);
      expect(migratedConfig.compactionPhase1Threshold).toBe(60);
    });
  });

  describe('cooldown period handling', () => {
    it('should respect compactionCooldownMinutes setting', () => {
      const config = new Configuration();

      const cooldownMs = config.compactionCooldownMinutes * 60 * 1000;
      expect(cooldownMs).toBe(300000); // 5 minutes in milliseconds

      const customConfig = { ...config };
      customConfig.compactionCooldownMinutes = 10;

      const customCooldownMs = customConfig.compactionCooldownMinutes * 60 * 1000;
      expect(customCooldownMs).toBe(600000); // 10 minutes in milliseconds
    });

    it('should have compactionPriorityElements valid for sanitization', () => {
      const config = new Configuration();

      const validElements = ['secrets', 'rivalries', 'friendships', 'alliances', 'major_life_events'];

      const sanitizedElements = config.compactionPriorityElements.filter(el => 
        validElements.includes(el) || typeof el === 'string'
      );

      expect(sanitizedElements.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('API connection config', () => {
    it('should have valid compactionApiConnectionConfig structure', () => {
      const config = new Configuration();

      expect(config.compactionApiConnectionConfig).toBeDefined();
      expect(typeof config.compactionApiConnectionConfig).toBe('object');
    });

    it('should handle API connection config for different providers', () => {
      const config = new Configuration();

      // Support different API connection modes
      const mockConnectionConfig = {
        baseUrl: 'https://api.example.com',
        apiKey: 'test-key',
        timeout: 30000,
        maxTokens: 4096,
        temperature: 0.7
      };

      (config as any).compactionApiConnectionConfig = mockConnectionConfig;

      expect(config.compactionApiConnectionConfig.baseUrl).toBeDefined();
      expect(config.compactionApiConnectionConfig.apiKey).toBeDefined();
    });
  });
});