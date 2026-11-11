import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
    findChronicleMemoryBlock,
    parseChronicleMemoryBlock,
    waitForChronicleMemoryBlock,
    blockRecordToObservationInputs,
    type ChronicleMemoryBlockRecord
} from '../../src/main/chronicle/ChronicleMemoryBlockParser';

function startLine(requestId: number, playerId: string, currentDateTotalDays: number): string {
    return `VOTC:CHRONICLE_MEMORY/;/start/;/${requestId}/;/${playerId}/;/${currentDateTotalDays}`;
}

function memoryLine(
    requestId: number,
    ordinal: number,
    ownerId: string,
    ownerName: string,
    typeToken: string,
    memoryName: string,
    creationTotalDays: number,
    creationDisplay: string,
    description: string,
    relevance: number,
    participantCount: number
): string {
    const fields = [
        'memory',
        String(requestId),
        String(ordinal),
        ownerId,
        ownerName,
        typeToken,
        memoryName,
        String(creationTotalDays),
        creationDisplay,
        description,
        String(relevance),
        String(participantCount)
    ];
    return `VOTC:CHRONICLE_MEMORY/;/${fields.join('/;/')}`;
}

function participantLine(requestId: number, ordinal: number, participantId: string | number): string {
    return `VOTC:CHRONICLE_MEMORY/;/participant/;/${requestId}/;/${ordinal}/;/${participantId}`;
}

function endLine(requestId: number, memoryCount: number): string {
    return `VOTC:CHRONICLE_MEMORY/;/end/;/${requestId}/;/${memoryCount}`;
}

function buildBlock(
    requestId: number,
    playerId: string,
    currentDateTotalDays: number,
    memories: Array<{
        ordinal: number;
        ownerId: string;
        ownerName: string;
        typeToken: string;
        memoryName: string;
        creationTotalDays: number;
        creationDisplay: string;
        description: string;
        relevance: number;
        participants: Array<string | number>;
    }> = []
): string {
    const lines: string[] = [startLine(requestId, playerId, currentDateTotalDays)];
    for (const m of memories) {
        lines.push(memoryLine(
            requestId,
            m.ordinal,
            m.ownerId,
            m.ownerName,
            m.typeToken,
            m.memoryName,
            m.creationTotalDays,
            m.creationDisplay,
            m.description,
            m.relevance,
            m.participants.length
        ));
        for (const p of m.participants) {
            lines.push(participantLine(requestId, m.ordinal, p));
        }
    }
    lines.push(endLine(requestId, memories.length));
    return lines.join('\n');
}

describe('parseChronicleMemoryBlock - complete block (Step 6)', () => {
    it('parses a complete block with one memory and participants', () => {
        const requestId = 777;
        const block = buildBlock(requestId, '100', 388738, [
            {
                ordinal: 1,
                ownerId: '121441',
                ownerName: '李某',
                typeToken: '姑姨死亡',
                memoryName: '姑姨死亡',
                creationTotalDays: 365859,
                creationDisplay: '1000.1.1',
                description: '唐皇帝李某，王佑峻的父亲...',
                relevance: 80,
                participants: [99247, 100001]
            }
        ]);
        const lines = block.split('\n');
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories).toHaveLength(1);
        const mem = result.memories[0];
        expect(mem.snapshotOrdinal).toBe(1);
        expect(mem.ownerId).toBe('121441');
        expect(mem.ownerName).toBe('李某');
        expect(mem.memoryTypeToken).toBe('姑姨死亡');
        expect(mem.memoryName).toBe('姑姨死亡');
        expect(mem.creationDate?.totalDays).toBe(365859);
        expect(mem.creationDateDisplay).toBe('1000.1.1');
        expect(mem.description).toBe('唐皇帝李某，王佑峻的父亲...');
        expect(mem.relevanceWeight).toBe(80);
        expect(mem.participantIds).toEqual([99247, 100001]);
    });

    it('parses a complete block with multiple memories', () => {
        const requestId = 42;
        const block = buildBlock(requestId, '100', 1000, [
            {
                ordinal: 1,
                ownerId: '1',
                ownerName: 'A',
                typeToken: 't1',
                memoryName: 'm1',
                creationTotalDays: 900,
                creationDisplay: '900.1.1',
                description: 'd1',
                relevance: 10,
                participants: [2]
            },
            {
                ordinal: 2,
                ownerId: '3',
                ownerName: 'B',
                typeToken: 't2',
                memoryName: 'm2',
                creationTotalDays: 950,
                creationDisplay: '950.1.1',
                description: 'd2',
                relevance: 20,
                participants: [4, 5]
            }
        ]);
        const lines = block.split('\n');
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories).toHaveLength(2);
        expect(result.memories[0].snapshotOrdinal).toBe(1);
        expect(result.memories[1].snapshotOrdinal).toBe(2);
        expect(result.memories[1].participantIds).toEqual([4, 5]);
    });
});

describe('parseChronicleMemoryBlock - zero memory (Step 5)', () => {
    it('start + end with memoryCount = 0 is a valid complete snapshot', () => {
        const requestId = 10;
        const block = buildBlock(requestId, '100', 500, []);
        const lines = block.split('\n');
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories).toHaveLength(0);
    });
});

describe('parseChronicleMemoryBlock - truncated block (Step 6)', () => {
    it('rejects a block that is missing the end line', () => {
        const requestId = 5;
        const lines = [
            startLine(requestId, '100', 100),
            memoryLine(requestId, 1, '1', 'A', 't', 'm', 90, '90.1.1', 'd', 10, 0)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('incomplete');
    });

    it('rejects a block missing the start line', () => {
        const requestId = 5;
        const lines = [
            memoryLine(requestId, 1, '1', 'A', 't', 'm', 90, '90.1.1', 'd', 10, 0),
            endLine(requestId, 1)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('incomplete');
    });

    it('rejects a block where a memory line is followed by a new start (truncated)', () => {
        const requestId = 5;
        const lines = [
            startLine(requestId, '100', 100),
            memoryLine(requestId, 1, '1', 'A', 't', 'm', 90, '90.1.1', 'd', 10, 1),
            startLine(requestId + 1, '100', 200)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('incomplete');
    });
});

describe('parseChronicleMemoryBlock - request id mismatch (Step 6)', () => {
    it('rejects an end line with a different request id', () => {
        const requestId = 5;
        const lines = [
            startLine(requestId, '100', 100),
            endLine(requestId + 1, 0)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('incomplete');
    });

    it('ignores memory lines with a different request id', () => {
        const requestId = 5;
        const lines = [
            startLine(requestId, '100', 100),
            memoryLine(requestId + 99, 1, '1', 'A', 't', 'm', 90, '90.1.1', 'd', 10, 0),
            endLine(requestId, 0)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories).toHaveLength(0);
    });
});

describe('parseChronicleMemoryBlock - duplicate ordinal (Step 6)', () => {
    it('rejects two memories with the same snapshotOrdinal in one block', () => {
        const requestId = 5;
        const block = buildBlock(requestId, '100', 100, [
            {
                ordinal: 1,
                ownerId: '1',
                ownerName: 'A',
                typeToken: 't',
                memoryName: 'm',
                creationTotalDays: 90,
                creationDisplay: '90.1.1',
                description: 'd1',
                relevance: 10,
                participants: []
            },
            {
                ordinal: 1,
                ownerId: '2',
                ownerName: 'B',
                typeToken: 't2',
                memoryName: 'm2',
                creationTotalDays: 91,
                creationDisplay: '91.1.1',
                description: 'd2',
                relevance: 20,
                participants: []
            }
        ]);
        const lines = block.split('\n');
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('ordinal');
    });
});

describe('parseChronicleMemoryBlock - participant count mismatch (Step 6)', () => {
    it('rejects a memory whose participant count does not match the declared count', () => {
        const requestId = 5;
        const lines = [
            startLine(requestId, '100', 100),
            memoryLine(requestId, 1, '1', 'A', 't', 'm', 90, '90.1.1', 'd', 10, 2),
            participantLine(requestId, 1, 100),
            endLine(requestId, 1)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('participant');
    });

    it('accepts a memory with participant count = 0 and no participant lines', () => {
        const requestId = 5;
        const block = buildBlock(requestId, '100', 100, [
            {
                ordinal: 1,
                ownerId: '1',
                ownerName: 'A',
                typeToken: 't',
                memoryName: 'm',
                creationTotalDays: 90,
                creationDisplay: '90.1.1',
                description: 'd',
                relevance: 10,
                participants: []
            }
        ]);
        const lines = block.split('\n');
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories[0].participantIds).toEqual([]);
    });
});

describe('parseChronicleMemoryBlock - owner and creation date validation (Step 3)', () => {
    it('rejects a memory with an empty ownerId', () => {
        const requestId = 5;
        const lines = [
            startLine(requestId, '100', 100),
            memoryLine(requestId, 1, '', 'A', 't', 'm', 90, '90.1.1', 'd', 10, 0),
            endLine(requestId, 1)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('owner');
    });

    it('rejects a memory with an empty memoryTypeToken', () => {
        const requestId = 5;
        const lines = [
            startLine(requestId, '100', 100),
            memoryLine(requestId, 1, '1', 'A', '', 'm', 90, '90.1.1', 'd', 10, 0),
            endLine(requestId, 1)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('token');
    });

    it('rejects a memory with a non-numeric creationTotalDays', () => {
        const requestId = 5;
        const lines = [
            startLine(requestId, '100', 100),
            `VOTC:CHRONICLE_MEMORY/;/memory/;/${requestId}/;/1/;/1/;/A/;/t/;/m/;/abc/;/90.1.1/;/d/;/10/;/0`,
            endLine(requestId, 1)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('creation');
    });

    it('rejects a memory with a non-positive creationTotalDays (zero)', () => {
        const requestId = 5;
        const lines = [
            startLine(requestId, '100', 100),
            memoryLine(requestId, 1, '1', 'A', 't', 'm', 0, '0.1.1', 'd', 10, 0),
            endLine(requestId, 1)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('creationTotalDays');
        expect(result.reason).toContain('positive');
    });

    it('rejects a memory with a negative creationTotalDays', () => {
        const requestId = 5;
        const lines = [
            startLine(requestId, '100', 100),
            memoryLine(requestId, 1, '1', 'A', 't', 'm', -5, '-5.1.1', 'd', 10, 0),
            endLine(requestId, 1)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('creationTotalDays');
        expect(result.reason).toContain('positive');
    });

    it('rejects a memory with an empty description', () => {
        const requestId = 5;
        const lines = [
            startLine(requestId, '100', 100),
            memoryLine(requestId, 1, '1', 'A', 't', 'm', 90, '90.1.1', '', 10, 0),
            endLine(requestId, 1)
        ];
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('description');
    });
});

describe('parseChronicleMemoryBlock - memoryCount validation (Step 3)', () => {
    it('rejects an end line whose memoryCount does not match the parsed memory count', () => {
        const requestId = 5;
        const block = buildBlock(requestId, '100', 100, [
            {
                ordinal: 1,
                ownerId: '1',
                ownerName: 'A',
                typeToken: 't',
                memoryName: 'm',
                creationTotalDays: 90,
                creationDisplay: '90.1.1',
                description: 'd',
                relevance: 10,
                participants: []
            }
        ]);
        const lines = block.split('\n');
        lines[lines.length - 1] = endLine(requestId, 2);
        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('invalid');
        if (result.status !== 'invalid') return;
        expect(result.reason).toContain('count');
    });
});

describe('findChronicleMemoryBlock - scanning log content (Step 6)', () => {
    it('finds CK3 debug lines that include timestamp and log-level prefixes', () => {
        const requestId = 778;
        const prefixed = buildBlock(requestId, '100', 388738, [{
            ordinal: 1,
            ownerId: '1',
            ownerName: 'A',
            typeToken: 't',
            memoryName: 'm',
            creationTotalDays: 90,
            creationDisplay: '90.1.1',
            description: 'd',
            relevance: 10,
            participants: []
        }]).split('\n').map(line => `[19:15:01][jomini_script_system][D] ${line}`).join('\n');

        const result = findChronicleMemoryBlock(prefixed, requestId);
        expect(result.status).toBe('complete');
    });

    it('removes CK3 rich-text control codes from memory display fields', () => {
        const requestId = 779;
        const lines = [
            startLine(requestId, '100', 100),
            memoryLine(
                requestId, 1, '1', '\x15positive_value Alice\x16', 'friendship',
                'Friendship', 90, '90.1.1', '\x15positive_value Alice became a friend!\x16',
                50, 0
            ),
            endLine(requestId, 1)
        ];

        const result = parseChronicleMemoryBlock(lines, requestId);
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories[0].ownerName).toBe('Alice');
        expect(result.memories[0].description).toBe('Alice became a friend');
    });

    it('finds a complete block in the middle of other log content', () => {
        const requestId = 777;
        const block = buildBlock(requestId, '100', 388738, [
            {
                ordinal: 1,
                ownerId: '1',
                ownerName: 'A',
                typeToken: 't',
                memoryName: 'm',
                creationTotalDays: 90,
                creationDisplay: '90.1.1',
                description: 'd',
                relevance: 10,
                participants: [2]
            }
        ]);
        const logContent = [
            'Some other log line',
            'VOTC:IN/;/init/;/123/;/Player',
            block,
            'Trailing line'
        ].join('\n');
        const result = findChronicleMemoryBlock(logContent, requestId);
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories).toHaveLength(1);
    });

    it('returns incomplete when no block exists for the requestId', () => {
        const logContent = [
            'Some line',
            startLine(999, '100', 100),
            endLine(999, 0)
        ].join('\n');
        const result = findChronicleMemoryBlock(logContent, 777);
        expect(result.status).toBe('incomplete');
    });

    it('handles multiple old blocks and picks the one matching the requestId', () => {
        const oldBlock = buildBlock(1, '100', 100, [
            {
                ordinal: 1,
                ownerId: '1',
                ownerName: 'old',
                typeToken: 't',
                memoryName: 'm',
                creationTotalDays: 90,
                creationDisplay: '90.1.1',
                description: 'old desc',
                relevance: 5,
                participants: []
            }
        ]);
        const newBlock = buildBlock(2, '100', 200, [
            {
                ordinal: 1,
                ownerId: '2',
                ownerName: 'new',
                typeToken: 't',
                memoryName: 'm',
                creationTotalDays: 190,
                creationDisplay: '190.1.1',
                description: 'new desc',
                relevance: 50,
                participants: [3]
            }
        ]);
        const logContent = [oldBlock, newBlock].join('\n\n');
        const result = findChronicleMemoryBlock(logContent, 2);
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories).toHaveLength(1);
        expect(result.memories[0].ownerId).toBe('2');
        expect(result.memories[0].description).toBe('new desc');
    });

    it('uses the last matching block when multiple blocks exist for the same requestId', () => {
        const requestId = 5;
        const first = buildBlock(requestId, '100', 100, [
            {
                ordinal: 1,
                ownerId: '1',
                ownerName: 'first',
                typeToken: 't',
                memoryName: 'm',
                creationTotalDays: 90,
                creationDisplay: '90.1.1',
                description: 'first desc',
                relevance: 5,
                participants: []
            }
        ]);
        const second = buildBlock(requestId, '100', 200, [
            {
                ordinal: 1,
                ownerId: '2',
                ownerName: 'second',
                typeToken: 't',
                memoryName: 'm',
                creationTotalDays: 190,
                creationDisplay: '190.1.1',
                description: 'second desc',
                relevance: 10,
                participants: []
            }
        ]);
        const logContent = [first, second].join('\n\n');
        const result = findChronicleMemoryBlock(logContent, requestId);
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories[0].description).toBe('second desc');
    });
});

describe('findChronicleMemoryBlock - description dynamic change (Step 6)', () => {
    it('parses a block where description differs from a previous block (dynamic re-render)', () => {
        const requestId = 5;
        const firstBlock = buildBlock(requestId, '100', 100, [
            {
                ordinal: 1,
                ownerId: '1',
                ownerName: '李某',
                typeToken: 't',
                memoryName: 'm',
                creationTotalDays: 90,
                creationDisplay: '90.1.1',
                description: '唐皇帝李某...',
                relevance: 10,
                participants: []
            }
        ]);
        const secondBlock = buildBlock(requestId, '100', 200, [
            {
                ordinal: 1,
                ownerId: '1',
                ownerName: '乡绅李某',
                typeToken: 't',
                memoryName: 'm',
                creationTotalDays: 90,
                creationDisplay: '90.1.1',
                description: '乡绅李某，已是布衣...',
                relevance: 20,
                participants: []
            }
        ]);
        const logContent = [firstBlock, secondBlock].join('\n');
        const result = findChronicleMemoryBlock(logContent, requestId);
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories[0].description).toBe('乡绅李某，已是布衣...');
        expect(result.memories[0].ownerName).toBe('乡绅李某');
        expect(result.memories[0].relevanceWeight).toBe(20);
    });
});

describe('waitForChronicleMemoryBlock - log polling (Step 4)', () => {
    let tmpDir: string;
    let logPath: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-chronicle-poll-'));
        logPath = path.join(tmpDir, 'debug.log');
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns the parsed block when it is already present', async () => {
        const requestId = 777;
        const block = buildBlock(requestId, '100', 388738, [
            {
                ordinal: 1,
                ownerId: '1',
                ownerName: 'A',
                typeToken: 't',
                memoryName: 'm',
                creationTotalDays: 90,
                creationDisplay: '90.1.1',
                description: 'd',
                relevance: 10,
                participants: [2]
            }
        ]);
        fs.writeFileSync(logPath, block, 'utf8');
        const result = await waitForChronicleMemoryBlock(logPath, requestId, 500);
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories).toHaveLength(1);
    });

    it('returns memory_snapshot_unavailable when the block never arrives', async () => {
        fs.writeFileSync(logPath, 'unrelated content\n', 'utf8');
        const result = await waitForChronicleMemoryBlock(logPath, 999, 300);
        expect(result.status).toBe('memory_snapshot_unavailable');
    });

    it('returns memory_snapshot_unavailable when the file does not exist', async () => {
        const result = await waitForChronicleMemoryBlock(path.join(tmpDir, 'missing.log'), 999, 300);
        expect(result.status).toBe('memory_snapshot_unavailable');
    });

    it('returns memory_snapshot_unavailable when the block is truncated and never completes', async () => {
        const requestId = 5;
        fs.writeFileSync(logPath, startLine(requestId, '100', 100) + '\n', 'utf8');
        const result = await waitForChronicleMemoryBlock(logPath, requestId, 300);
        expect(result.status).toBe('memory_snapshot_unavailable');
    });

    it('completes when the end line is appended mid-poll after an incomplete first read', async () => {
        const requestId = 42;
        const startOnly = startLine(requestId, '100', 388738);
        const restOfBlock = '\n' + [
            memoryLine(requestId, 1, '1', 'A', 't', 'm', 90, '90.1.1', 'd', 10, 1),
            participantLine(requestId, 1, 2),
            endLine(requestId, 1)
        ].join('\n');

        fs.writeFileSync(logPath, startOnly + '\n', 'utf8');

        const pollPromise = waitForChronicleMemoryBlock(logPath, requestId, 2000);

        await new Promise<void>(resolve => setTimeout(resolve, 150));
        fs.appendFileSync(logPath, restOfBlock + '\n', 'utf8');

        const result = await pollPromise;
        expect(result.status).toBe('complete');
        if (result.status !== 'complete') return;
        expect(result.memories).toHaveLength(1);
        expect(result.memories[0].ownerId).toBe('1');
        expect(result.memories[0].participantIds).toEqual([2]);
    });
});

describe('blockRecordToObservationInputs - mapping to ChronicleMemoryObservationInput', () => {
    it('maps a parsed block to observation inputs with chronicle_tick source', () => {
        const block: ChronicleMemoryBlockRecord = {
            requestId: 777,
            playerId: '100',
            currentDateTotalDays: 388738,
            memories: [
                {
                    snapshotOrdinal: 1,
                    ownerId: '121441',
                    ownerName: '李某',
                    memoryTypeToken: '姑姨死亡',
                    memoryName: '姑姨死亡',
                    creationDate: { totalDays: 365859, year: 1000, month: 1, day: 1, display: '1000.1.1' },
                    creationDateDisplay: '1000.1.1',
                    description: '唐皇帝李某...',
                    relevanceWeight: 80,
                    participantIds: [99247]
                }
            ]
        };
        const inputs = blockRecordToObservationInputs(block, {
            observedAt: '2026-07-23T00:00:00Z',
            votcCheckpointEpoch: 7,
            votcTimelineNodeId: '1-1'
        });
        expect(inputs).toHaveLength(1);
        const input = inputs[0];
        expect(input.ownerId).toBe('121441');
        expect(input.ownerName).toBe('李某');
        expect(input.memoryTypeToken).toBe('姑姨死亡');
        expect(input.memoryTypeTokenSource).toBe('localized_name');
        expect(input.memoryName).toBe('姑姨死亡');
        expect(input.description).toBe('唐皇帝李某...');
        expect(input.creationDate?.totalDays).toBe(365859);
        expect(input.creationDateDisplay).toBe('1000.1.1');
        expect(input.relevanceWeight).toBe(80);
        expect(input.participantIds).toEqual([99247]);
        expect(input.snapshotOrdinal).toBe(1);
        expect(input.observationSource).toBe('chronicle_tick');
        expect(input.observedAt).toBe('2026-07-23T00:00:00Z');
        expect(input.votcCheckpointEpoch).toBe(7);
        expect(input.votcTimelineNodeId).toBe('1-1');
    });

    it('maps a zero-memory block to an empty inputs array', () => {
        const block: ChronicleMemoryBlockRecord = {
            requestId: 10,
            playerId: '100',
            currentDateTotalDays: 500,
            memories: []
        };
        const inputs = blockRecordToObservationInputs(block, {
            observedAt: '2026-07-23T00:00:00Z'
        });
        expect(inputs).toEqual([]);
    });
});
