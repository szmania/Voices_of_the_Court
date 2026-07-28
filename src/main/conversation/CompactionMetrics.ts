import { CompactionMetrics as CompactionMetricsData } from '../../shared/compactionTypes';

/**
 * CompactionMetrics - Tracks and evaluates performance metrics for memory compaction operations.
 * Provides recording, measurement, evaluation against targets, and summary capabilities.
 */
export class CompactionMetrics {
    private metricsHistory: CompactionMetricsData[] = [];
    private readonly maxHistorySize: number = 100;

    // Performance targets (from plan Section 8.1)
    private readonly TARGET_COMPACTION_TIME_MS = 200;
    private readonly TARGET_SERIALIZATION_OVERHEAD_PCT = 5;
    private readonly TARGET_MEMORY_REDUCTION_PCT = 10;
    private readonly TARGET_ACCURACY_SCORE = 0.95;

    /**
     * Records a compaction metrics entry into the history.
     * Automatically trims history to maxHistorySize.
     */
    public record(metrics: CompactionMetricsData): void {
        this.metricsHistory.push(metrics);
        if (this.metricsHistory.length > this.maxHistorySize) {
            this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Evaluates a single metrics entry against performance targets.
     * Returns an object with pass/fail status for each target.
     */
    public evaluate(metrics: CompactionMetricsData): MetricsEvaluation {
        const compactionTimeMs = Math.max(metrics.phase1DurationMs, metrics.phase2DurationMs);
        const totalOpTimeMs = metrics.totalDurationMs || 1; // avoid division by zero
        const serializationOverheadPct = totalOpTimeMs > 0
            ? (metrics.serializationTimeMs / totalOpTimeMs) * 100
            : 0;
        const memoryReductionPct = metrics.memoryBeforeBytes > 0
            ? ((metrics.memoryBeforeBytes - metrics.memoryAfterBytes) / metrics.memoryBeforeBytes) * 100
            : 0;

        return {
            compactionTimePass: compactionTimeMs <= this.TARGET_COMPACTION_TIME_MS,
            compactionTimeMs,
            serializationOverheadPass: serializationOverheadPct <= this.TARGET_SERIALIZATION_OVERHEAD_PCT,
            serializationOverheadPct,
            memoryReductionPass: memoryReductionPct >= this.TARGET_MEMORY_REDUCTION_PCT,
            memoryReductionPct,
            accuracyPass: metrics.accuracyScore >= this.TARGET_ACCURACY_SCORE,
            accuracyScore: metrics.accuracyScore,
            allPassed: compactionTimeMs <= this.TARGET_COMPACTION_TIME_MS
                && serializationOverheadPct <= this.TARGET_SERIALIZATION_OVERHEAD_PCT
                && memoryReductionPct >= this.TARGET_MEMORY_REDUCTION_PCT
                && metrics.accuracyScore >= this.TARGET_ACCURACY_SCORE,
        };
    }

    /**
     * Returns a summary of all recorded metrics including averages and pass rates.
     */
    public summarize(): MetricsSummary {
        const history = this.metricsHistory;
        if (history.length === 0) {
            return {
                totalCompactions: 0,
                averageCompactionTimeMs: 0,
                averageSerializationOverheadPct: 0,
                averageMemoryReductionPct: 0,
                averageAccuracyScore: 0,
                passRate: 0,
                evaluations: [],
            };
        }

        const evaluations = history.map(m => this.evaluate(m));
        const passedCount = evaluations.filter(e => e.allPassed).length;

        return {
            totalCompactions: history.length,
            averageCompactionTimeMs: this.average(history.map(m => Math.max(m.phase1DurationMs, m.phase2DurationMs))),
            averageSerializationOverheadPct: this.average(evaluations.map(e => e.serializationOverheadPct)),
            averageMemoryReductionPct: this.average(evaluations.map(e => e.memoryReductionPct)),
            averageAccuracyScore: this.average(history.map(m => m.accuracyScore)),
            passRate: history.length > 0 ? passedCount / history.length : 0,
            evaluations,
        };
    }

    /**
     * Logs a detailed metrics report to the console for debugging.
     */
    public logMetrics(metrics: CompactionMetricsData): void {
        const evaluation = this.evaluate(metrics);
        console.log('=== Compaction Metrics Report ===');
        console.log(`Total Duration: ${metrics.totalDurationMs}ms`);
        console.log(`Phase 1 Duration: ${metrics.phase1DurationMs}ms ${evaluation.compactionTimePass ? '✓' : '✗ (target: ≤${this.TARGET_COMPACTION_TIME_MS}ms)'}`);
        console.log(`Phase 2 Duration: ${metrics.phase2DurationMs}ms ${evaluation.compactionTimePass ? '✓' : '✗'}`);
        console.log(`Serialization Overhead: ${evaluation.serializationOverheadPct.toFixed(1)}% ${evaluation.serializationOverheadPass ? '✓' : '✗ (target: ≤${this.TARGET_SERIALIZATION_OVERHEAD_PCT}%)'}`);
        console.log(`Memory Reduction: ${evaluation.memoryReductionPct.toFixed(1)}% ${evaluation.memoryReductionPass ? '✓' : '✗ (target: ≥${this.TARGET_MEMORY_REDUCTION_PCT}%)'}`);
        console.log(`Accuracy Score: ${(metrics.accuracyScore * 100).toFixed(1)}% ${evaluation.accuracyPass ? '✓' : '✗ (target: ≥${(this.TARGET_ACCURACY_SCORE * 100).toFixed(0)}%)'}`);
        console.log(`Messages Compacted: ${metrics.messagesCompacted}`);
        console.log(`Phase-1 Summaries Consolidated: ${metrics.phase1SummariesConsolidated}`);
        console.log(`All Targets Passed: ${evaluation.allPassed ? 'YES' : 'NO'}`);
        console.log('================================');
    }

    /** Returns the full metrics history. */
    public getHistory(): CompactionMetricsData[] {
        return [...this.metricsHistory];
    }

    /** Clears the metrics history. */
    public clearHistory(): void {
        this.metricsHistory = [];
    }

    private average(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
}

/** Result of evaluating a single metrics entry against performance targets. */
export interface MetricsEvaluation {
    compactionTimePass: boolean;
    compactionTimeMs: number;
    serializationOverheadPass: boolean;
    serializationOverheadPct: number;
    memoryReductionPass: boolean;
    memoryReductionPct: number;
    accuracyPass: boolean;
    accuracyScore: number;
    allPassed: boolean;
}

/** Summary of all recorded compaction metrics. */
export interface MetricsSummary {
    totalCompactions: number;
    averageCompactionTimeMs: number;
    averageSerializationOverheadPct: number;
    averageMemoryReductionPct: number;
    averageAccuracyScore: number;
    passRate: number;
    evaluations: MetricsEvaluation[];
}