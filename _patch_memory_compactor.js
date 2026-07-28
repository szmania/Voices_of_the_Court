// Patch script to apply all Phase 4 changes to MemoryCompactor.ts atomically
const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'src', 'main', 'conversation', 'MemoryCompactor.ts');

console.log('Reading file:', targetPath);
let content = fs.readFileSync(targetPath, 'utf8');
console.log('Original lines:', content.split('\n').length);

// 1. Add CompactionMetrics to compactionTypes import
content = content.replace(
  'import { CompactedMemory, CompactionConfig, KnowledgeGraph, EntityReference, Relationship, KnowledgeEdge, NarrativeThread } from',
  'import { CompactedMemory, CompactionConfig, CompactionMetrics, KnowledgeGraph, EntityReference, Relationship, KnowledgeEdge, NarrativeThread } from'
);

// 2. Add helper imports after randomUUID import
content = content.replace(
  "import { randomUUID } from 'crypto';",
  "import { randomUUID } from 'crypto';\n" +
  "import { CompactionMetrics as CompactionMetricsTracker } from './CompactionMetrics';\n" +
  "import { CompactionLocalizationValidator } from './CompactionLocalizationValidator';"
);

// 3. Add class properties after config
content = content.replace(
  '    private config: CompactionConfig;\n\n    constructor(config: CompactionConfig)',
  '    private config: CompactionConfig;\n' +
  '    private metricsTracker: CompactionMetricsTracker;\n' +
  '    private localizationValidator: CompactionLocalizationValidator;\n' +
  '\n' +
  '    constructor(config: CompactionConfig)'
);

// 4. Add constructor init after accuracyValidator
content = content.replace(
  '        this.accuracyValidator = new ContextAccuracyValidator();\n    }\n\n    /**',
  '        this.accuracyValidator = new ContextAccuracyValidator();\n' +
  '        this.metricsTracker = new CompactionMetricsTracker();\n' +
  '        this.localizationValidator = new CompactionLocalizationValidator();\n' +
  '    }\n\n    /**'
);

// 5. Add initialize() updates and public accessors before cleanup
content = content.replace(
  '        this.scheduler = new CompactionScheduler(config);\n    }\n\n    public cleanup(): void {\n        this.compactedMemories.clear();\n    }',
  '        this.scheduler = new CompactionScheduler(config);\n' +
  '        this.metricsTracker = new CompactionMetricsTracker();\n' +
  '        this.localizationValidator = new CompactionLocalizationValidator();\n' +
  '    }\n\n' +
  '    /** Returns the metrics tracker for external performance monitoring. */\n' +
  '    public getMetricsTracker(): CompactionMetricsTracker {\n' +
  '        return this.metricsTracker;\n' +
  '    }\n\n' +
  '    /** Returns the localization validator for external cross-language checks. */\n' +
  '    public getLocalizationValidator(): CompactionLocalizationValidator {\n' +
  '        return this.localizationValidator;\n' +
  '    }\n\n' +
  '    public cleanup(): void {\n' +
  '        this.compactedMemories.clear();\n' +
  '    }'
);

// 6. Add metrics? to CompactionResult interface
content = content.replace(
  '    accuracyScore?: number;\n}',
  '    accuracyScore?: number;\n    metrics?: CompactionMetrics;\n}'
);

console.log('Writing file...');
fs.writeFileSync(targetPath, content, 'utf8');
console.log('Done. New lines:', content.split('\n').length);

// Verify
const verify = fs.readFileSync(targetPath, 'utf8');
console.log('Has CompactionMetrics import:', verify.includes('CompactionMetrics'));
console.log('Has CompactionMetricsTracker:', verify.includes('CompactionMetricsTracker'));
console.log('Has CompactionLocalizationValidator:', verify.includes('CompactionLocalizationValidator'));
console.log('Has metricsTracker prop:', verify.includes('metricsTracker:'));
console.log('Has localizationValidator prop:', verify.includes('localizationValidator:'));
console.log('Has getMetricsTracker:', verify.includes('getMetricsTracker'));
console.log('Has getLocalizationValidator:', verify.includes('getLocalizationValidator'));
console.log('Has metrics? in CompactionResult:', verify.includes('metrics?: CompactionMetrics'));
console.log('Duplicate cleanup count:', (verify.match(/public cleanup\(\): void/g) || []).length);