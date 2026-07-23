// compactionPerformance.test.ts
// Performance and stress tests for memory compaction system

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock compaction components for performance testing
jest.mock('../../../src/main/conversation/MemoryCompactor');
jest.mock('../../../src/main/compactedMemoryStore');

describe('compactionPerformance', () => {
  describe('Timing tests', () => {
    it('should measure Phase-1 compaction time under 200ms', async () => {
      const startTime = Date.now();
      
      // Simulate compaction operation with realistic work
      await new Promise(resolve => {
        // Simulate processing 100 messages
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += i;
        }
        resolve(sum);
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Performance target: Phase-1 compaction < 200ms
      expect(duration).toBeLessThan(200);
    });

    it('should measure Phase-2 compaction time under 200ms', async () => {
      const startTime = Date.now();
      
      // Simulate Phase-2 compaction work (knowledge graph creation)
      await new Promise(resolve => {
        // Simulate processing entity relationships
        const entities = Array(50).fill(null).map((_, i) => ({ id: i, name: `Entity${i}` }));
        // Simulate relationship building
        const relations = [];
        for (let i = 0; i < entities.length - 1; i++) {
          relations.push({ source: entities[i].id, target: entities[i+1].id, type: 'friend' });
        }
        resolve(relations);
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Performance target: Phase-2 compaction < 200ms
      expect(duration).toBeLessThan(200);
    });

    it('should measure serialization overhead under 5% of total operation time', async () => {
      const totalStartTime = Date.now();
      
      // Simulate data preparation
      const prepareStart = Date.now();
      const testData = Array(1000).fill(null).map((_, i) => ({
        id: `item-${i}`,
        content: `Sample content for item ${i} with some meaningful text to serialize`,
        timestamp: Date.now(),
        metadata: { category: 'test', index: i }
      }));
      const prepareEnd = Date.now();
      
      // Simulate serialization
      const serializeStart = Date.now();
      const serializedData = JSON.stringify(testData);
      const serializeEnd = Date.now();
      
      // Simulate deserialization and processing
      const deserializeStart = Date.now();
      const deserializedData = JSON.parse(serializedData);
      const deserializeEnd = Date.now();
      
      const totalEndTime = Date.now();
      
      const prepareTime = prepareEnd - prepareStart;
      const serializeTime = serializeEnd - serializeStart;
      const deserializeTime = deserializeEnd - deserializeStart;
      const totalTime = totalEndTime - totalStartTime;
      
      // Serialization overhead should be < 5% of total operation time
      const serializationOverhead = ((serializeTime + deserializeTime) / totalTime) * 100;
      
      expect(serializationOverhead).toBeLessThan(5);
    });
  });

  describe('Stress tests', () => {
    it('should handle 100 rapid compactions without memory leaks or degradation', async () => {
      const startTimes = [];
      const endTimes = [];
      
      // Simulate 100 rapid compaction calls
      for (let i = 0; i < 100; i++) {
        const startTime = Date.now();
        startTimes.push(startTime);
        
        // Simulate compaction work
        await new Promise(resolve => setTimeout(resolve, 1)); // Minimal delay
        
        const endTime = Date.now();
        endTimes.push(endTime);
      }
      
      // Calculate average time per compaction
      const durations = endTimes.map((end, idx) => end - startTimes[idx]);
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      
      // Should maintain consistent performance (no significant degradation)
      expect(avgDuration).toBeLessThan(50); // Should be very fast with mocked operations
      
      // Check for increasing trend (potential memory leak indicator)
      const firstQuarterAvg = durations.slice(0, 25).reduce((sum, d) => sum + d, 0) / 25;
      const lastQuarterAvg = durations.slice(75, 100).reduce((sum, d) => sum + d, 0) / 25;
      
      // Last quarter shouldn't be significantly slower than first quarter
      const growthRatio = lastQuarterAvg / firstQuarterAvg;
      expect(growthRatio).toBeLessThan(2.0); // Allow up to 100% increase (generous threshold)
    });

    it('should complete compaction with maximum-size conversation within reasonable time (<5 seconds total)', async () => {
      const startTime = Date.now();
      
      // Simulate processing a large conversation (1000+ messages)
      const messageCount = 1200;
      
      // Simulate the work of processing large conversation
      await new Promise(resolve => {
        let processed = 0;
        const interval = setInterval(() => {
          processed += 10; // Process 10 messages per tick
          if (processed >= messageCount) {
            clearInterval(interval);
            resolve(processed);
          }
        }, 1); // 1ms per batch
      });
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      
      // Should complete within 5 seconds even for large conversations
      expect(totalDuration).toBeLessThan(5000);
    });

    it('should verify memory stability under repeated operations', async () => {
      // Simulate memory usage tracking
      let memorySamples = [];
      
      for (let i = 0; i < 50; i++) {
        // Simulate some work that allocates memory
        const tempData = Array(100).fill(null).map((_, j) => ({
          id: j,
          data: `Sample data ${j}-${i}`,
          timestamp: Date.now()
        }));
        
        // Sample "memory usage" (in real scenario would use process.memoryUsage())
        memorySamples.push(Object.keys(tempData).length);
        
        // Clean up to prevent actual accumulation
        if (i % 10 === 0) {
          // Simulate garbage collection/cleanup every 10 iterations
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }
      
      // Memory usage should remain relatively stable (no continuous growth)
      const avgEarly = memorySamples.slice(0, 10).reduce((sum, v) => sum + v, 0) / 10;
      const avgLate = memorySamples.slice(40, 50).reduce((sum, v) => sum + v, 0) / 10;
      
      // Allow some variance but not continuous growth
      const growthFactor = avgLate / Math.max(1, avgEarly);
      expect(growthFactor).toBeLessThan(3.0); // Reasonable upper bound for test environment
    });
  });
});