import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('electron', () => ({ app: { getPath: jest.fn(() => os.tmpdir()) } }));
jest.mock('../../../src/shared/apiConnection', () => ({
    ApiConnection: jest.fn().mockImplementation(() => ({ complete: jest.fn() }))
}));
jest.mock('../../../src/main/timelineBusinessWire', () => ({
    runIncomingLetterTimelineTransition: jest.fn().mockResolvedValue({
        targetNodeId: '11-23',
        context: { timelineNodeId: '11-23', timelineParentId: '11-22', checkpointEpoch: 43 },
        script: 'debug_log = "VOTC:CHECKPOINT"',
        attemptId: 'test-attempt',
        reused: false
    })
}));

import { IncomingLetterGenerator } from '../../../src/main/letter/IncomingLetterGenerator';
import { parseLog } from '../../../src/shared/gameData/parseLog';
import type { Config } from '../../../src/shared/Config';

function snapshot(senderId: number, name: string): string[] {
    const init = [
        '1001', 'Player', String(senderId), name, '1066.1.1', 'scene_talk_court',
        'Paris', 'Controller', '1', '11', '22', '5', '6', '42', '0',
        '2', '1', '1', '2', '3', '4', '1', '1'
    ];
    return [`[12:34:56][D][effect.cpp:1]: VOTC:IN/;/init/;/${init.join('/;/')}`];
}

function letterLog(deliveryId: number): string {
    return [
        'earlier log with non-ASCII characters: 来信与人物',
        ...snapshot(2002, '来信人'),
        `[12:34:56][D][effect.cpp:1]: VOTC:INCOMING_LETTER/;/context/;/incoming_letter_1/;/vassal_memorial/;/1066.1.1/;/2002/;/${deliveryId}/;/sender_location=Paris`,
        ...snapshot(3003, 'Other conversation'),
        '[12:34:57][D][effect.cpp:1]: VOTC:IN/;/ai_speaks_first/;/3003'
    ].join('\r\n') + '\r\n';
}

describe('incoming letter delivery ownership', () => {
    let root: string;
    let generator: IncomingLetterGenerator;
    let complete: jest.Mock;
    let resolveReply: (text: string) => void;
    let requestStarted: Promise<void>;
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-incoming-delivery-'));
        logSpy = jest.spyOn(console, 'log').mockImplementation();
        generator = new IncomingLetterGenerator({
            maxTokens: 100,
            textGenerationApiConnectionConfig: { connection: {}, parameters: {} }
        } as Config, path.join(root, 'votc_data'), null);
        jest.spyOn(generator as any, 'buildMessages').mockResolvedValue([{ role: 'user', content: 'Write a letter.' }]);
        jest.spyOn(generator as any, 'saveHistory').mockResolvedValue(undefined);
        jest.spyOn(generator as any, 'saveSummary').mockResolvedValue(undefined);
        let markStarted!: () => void;
        requestStarted = new Promise(resolve => { markStarted = resolve; });
        const reply = new Promise<string>(resolve => { resolveReply = resolve; });
        complete = (generator as any).apiConnection.complete;
        complete.mockImplementation(() => { markStarted(); return reply; });
    });

    afterEach(() => {
        logSpy.mockRestore();
        fs.rmSync(root, { recursive: true, force: true });
    });

    function run(deliveryId: number): Promise<void> {
        return generator.generateIncomingLetter(path.join(root, 'debug.log'), root,
            'incoming_letter_1', 'vassal_memorial', deliveryId);
    }

    function readRunFile(): string {
        return fs.readFileSync(path.join(root, 'run', 'incomingletter_v2_1.txt'), 'utf8');
    }

    it('keeps the final reply when a notification repeats during generation', async () => {
        fs.writeFileSync(path.join(root, 'debug.log'), letterLog(10001), 'utf8');
        const first = run(10001);
        await requestStarted;
        await run(10001);
        resolveReply('The final incoming letter.');
        await first;
        expect(complete).toHaveBeenCalledTimes(1);
        const script = readRunFile();
        expect(script.charCodeAt(0)).toBe(0xFEFF);
        expect(script).toContain('The final incoming letter.');
        expect(script).toContain('var:votc_incoming_letter_1_delivery_id = 10001');
        expect(script).toContain('flag:vassal_memorial');
        await run(10001);
        expect(complete).toHaveBeenCalledTimes(1);
        expect(readRunFile()).toBe(script);
        expect((generator as any).saveHistory).toHaveBeenCalledTimes(1);
        expect((generator as any).saveSummary).toHaveBeenCalledTimes(1);
    });

    it('keeps a newer fallback when an older generation finishes late', async () => {
        fs.writeFileSync(path.join(root, 'debug.log'), letterLog(10002), 'utf8');
        const first = run(10002);
        await requestStarted;
        await run(10003); // This handoff has no matching snapshot.
        const fallback = readRunFile();
        expect(fallback).toContain('var:votc_incoming_letter_1_delivery_id = 10003');
        resolveReply('An obsolete reply.');
        await first;
        expect(readRunFile()).toBe(fallback);
        expect((generator as any).saveHistory).not.toHaveBeenCalled();
    });

    it('parses the selected CRLF snapshot before a newer AI-initiated conversation', async () => {
        const logPath = path.join(root, 'debug.log');
        fs.writeFileSync(logPath, letterLog(10004), 'utf8');
        const context = (generator as any).parseContext(logPath,
            'incoming_letter_1', 'vassal_memorial', 10004);
        const selected = await parseLog(logPath, {
            startOffset: context.snapshotStartOffset, endOffset: context.snapshotEndOffset
        });
        expect(selected!.aiID).toBe(2002);
        expect(selected!.aiName).toBe('来信人');
        expect(selected!.aiInitiatorId).toBeUndefined();
        expect(context.facts.sender_location).toBe('Paris');
        const latest = await parseLog(logPath);
        expect(latest!.aiID).toBe(3003);
        expect(latest!.aiInitiatorId).toBe(3003);
    });
});
