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
        return fs.readFileSync(path.join(root, 'run', 'votc_ce_incomingletter_v2_1.txt'), 'utf8');
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

    // §43: the pre-LLM write must be an INERT heartbeat placeholder, not the
    // executable guarded fallback. The mod's poller executes the run file every
    // ~1-2s while the slot globals are set, so an executable fallback would run
    // before the LLM responds, consume the slot globals and leave the player
    // reading fallback text instead of the AI body.
    it('writes an inert heartbeat placeholder before the LLM responds', async () => {
        fs.writeFileSync(path.join(root, 'debug.log'), letterLog(10005), 'utf8');
        const first = run(10005);
        await requestStarted;
        const placeholder = readRunFile();
        expect(placeholder.charCodeAt(0)).toBe(0xFEFF);
        expect(placeholder).toContain("debug_log = \"[Localize('talk_event.9999.desc')]\"");
        // The placeholder must not be able to create an artifact or consume the
        // slot globals - that is what makes it inert.
        expect(placeholder).not.toContain('create_artifact');
        expect(placeholder).not.toContain('remove_global_variable');
        expect(placeholder).not.toContain('votc_incoming_letter_fallback_desc');
        resolveReply('The real AI body.');
        await first;
    }, 15000);

    // §43: on success the final run file overwrites the placeholder and its
    // guard passes because nothing consumed the slot globals in between.
    it('overwrites the placeholder with the final run file on success', async () => {
        fs.writeFileSync(path.join(root, 'debug.log'), letterLog(10006), 'utf8');
        const first = run(10006);
        await requestStarted;
        expect(readRunFile()).not.toContain('create_artifact');
        resolveReply('The real AI body.');
        await first;
        const final = readRunFile();
        expect(final).toContain('The real AI body.');
        expect(final).toContain('var:votc_incoming_letter_1_delivery_id = 10006');
        expect(final).toContain('flag:vassal_memorial');
        expect(final).not.toContain('votc_incoming_letter_fallback_desc');
    }, 15000);

    // §43: an empty LLM response is a definitive failure - the inert
    // placeholder must be replaced by the real guarded fallback so the letter
    // still delivers (with fallback text) instead of never appearing.
    it('writes the guarded fallback when the LLM response is empty', async () => {
        fs.writeFileSync(path.join(root, 'debug.log'), letterLog(10007), 'utf8');
        const first = run(10007);
        await requestStarted;
        resolveReply('   ');
        await first;
        const fallback = readRunFile();
        expect(fallback).toContain('create_artifact');
        expect(fallback).toContain('votc_incoming_letter_fallback_desc');
        expect(fallback).toContain('var:votc_incoming_letter_1_delivery_id = 10007');
        expect(fallback).toContain('flag:vassal_memorial');
        expect(fallback).toContain('save_scope_as = votc_latest_letter');
    }, 15000);

    // §43: a failure AFTER the final run file landed must not clobber the good
    // final with the fallback (save errors are swallowed per-call; the
    // finalWritten flag additionally guards the outer catch).
    it('keeps the final run file when a history save fails', async () => {
        fs.writeFileSync(path.join(root, 'debug.log'), letterLog(10008), 'utf8');
        (generator as any).saveHistory.mockRejectedValue(new Error('history exploded'));
        const first = run(10008);
        await requestStarted;
        resolveReply('The real AI body.');
        await first;
        const final = readRunFile();
        expect(final).toContain('The real AI body.');
        expect(final).not.toContain('votc_incoming_letter_fallback_desc');
    }, 15000);

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
