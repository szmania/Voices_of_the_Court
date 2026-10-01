import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

// diaryManager (transitively imported for createMemoryString) resolves the
// user-data dir at module load, so the mock must answer getPath immediately.
jest.mock('electron', () => ({
    app: {
        getPath: jest.fn(() => os.tmpdir())
    }
}));

import { IncomingLetterGenerator, normalizeCk3String } from '../../../src/main/letter/IncomingLetterGenerator';

// The generator validates its inputs, locates the latest matching
// VOTC:INCOMING_LETTER/;/context line (which must trail a VOTC:IN/;/init
// marker) and falls back to a stub run file when anything fails closed.
// These tests exercise that pre-LLM pipeline; the LLM call itself is only
// reached with a fully consistent snapshot plus timeline state, which the
// BusinessWire suites already cover at the transition layer.

const INIT_LINE = [
    'VOTC:IN/;/init',
    '12345',                    // player id
    'PlayerName',
    '999',                      // sender id (deliberately != context sender 4242)
    'SenderName',
    '1100.1.1',
    'council',
    'Some Province',
    'Some Controller',
    '7'                         // epoch@8 per protocol v2
].join('/;/');

function buildLog(variant: 'mismatch' | 'noInit'): string {
    const lines = ['noise line'];
    if (variant === 'noInit') {
        lines.push('VOTC:INCOMING_LETTER/;/context/;/incoming_letter_2/;/vassal_memorial/;/1100.2.1/;/4242/;/11/sender_location=Paris');
    } else {
        lines.push(INIT_LINE);
        lines.push('VOTC:INCOMING_LETTER/;/context/;/incoming_letter_2/;/vassal_memorial/;/1100.2.1/;/4242/;/11/sender_location=Paris');
    }
    return lines.join('\n') + '\n';
}

describe('normalizeCk3String', () => {
    it('strips CK3-hostile characters and collapses whitespace', () => {
        // 1.x semantics kept verbatim: both double quotes map to U+201C.
        expect(normalizeCk3String('  a "b" [c] {d} \n e\tf  '))
            .toBe('a “b“ c d e f');
    });

    it('falls back to the mod loc key when nothing remains', () => {
        expect(normalizeCk3String('\n\t')).toBe('votc_incoming_letter_fallback_desc');
        expect(normalizeCk3String('#[@$%&\\]')).toBe('votc_incoming_letter_fallback_desc');
    });
});

describe('IncomingLetterGenerator fallback pipeline', () => {
    const tmpDirs: string[] = [];

    afterEach(() => {
        for (const dir of tmpDirs.splice(0)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    function makeTempRoot(): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-incoming-'));
        tmpDirs.push(dir);
        return dir;
    }

    async function runGenerator(logContent: string): Promise<string> {
        const tmpDir = makeTempRoot();
        const logPath = path.join(tmpDir, 'debug.log');
        const userRunDir = path.join(tmpDir, 'user_run');
        fs.mkdirSync(userRunDir, { recursive: true });
        fs.writeFileSync(logPath, logContent, 'utf8');

        const config: any = {
            language: 'zh',
            maxTokens: 1000,
            textGenerationApiConnectionConfig: {
                connection: { type: 'gemini', key: 'test-key', baseUrl: '' },
                parameters: { temperature: 0.5 }
            }
        };
        const generator = new IncomingLetterGenerator(config, path.join(tmpDir, 'votc_data'), null);
        // The generator writes to <userFolderPath>/run/incomingletter_v2_N.txt.
        const userFolderPath = path.join(tmpDir, 'user_home');
        await generator.generateIncomingLetter(
            logPath,
            userFolderPath,
            'incoming_letter_2',
            'vassal_memorial',
            11
        );
        return path.join(userFolderPath, 'run');
    }

    function expectGuardedFallback(runDir: string): void {
        const runFile = path.join(runDir, 'incomingletter_v2_2.txt');
        expect(fs.existsSync(runFile)).toBe(true);
        const content = fs.readFileSync(runFile, 'utf8');
        // CK3's run-file lexer requires UTF-8 BOM (both fallback and final writes).
        expect(content.charCodeAt(0)).toBe(0xFEFF);
        expect(content).toContain('exists = global_var:votc_incoming_letter_2');
        expect(content).toContain('var:votc_incoming_letter_2_delivery_id = 11');
        expect(content).toContain('global_var:votc_incoming_letter_type_2 = flag:vassal_memorial');
        expect(content).toContain('votc_incoming_letter_fallback_desc');
        expect(content).toContain('VOTC:INCOMING_LETTER/;/run_skipped/;/incoming_letter_2/;/11');
    }

    it('writes the guarded fallback run file when no matching context exists', async () => {
        const runDir = await runGenerator(buildLog('noInit'));
        expectGuardedFallback(runDir);
    }, 15000);

    it('writes the guarded fallback run file when the snapshot sender mismatches', async () => {
        const runDir = await runGenerator(buildLog('mismatch'));
        expectGuardedFallback(runDir);
    }, 15000);

    it('rejects invalid slot ids before touching the log', async () => {
        const tmpDir = makeTempRoot();
        const logPath = path.join(tmpDir, 'debug.log');
        fs.writeFileSync(logPath, buildLog('mismatch'), 'utf8');
        const config: any = {
            language: 'zh',
            maxTokens: 1000,
            textGenerationApiConnectionConfig: { connection: { type: 'gemini', key: 'test-key', baseUrl: '' }, parameters: {} }
        };
        const generator = new IncomingLetterGenerator(config, path.join(tmpDir, 'votc_data'), null);
        const userFolderPath = path.join(tmpDir, 'user_home');
        await generator.generateIncomingLetter(logPath, userFolderPath, 'incoming_letter_9', 'vassal_memorial', 11);
        expect(fs.existsSync(path.join(userFolderPath))).toBe(false);
    });
});
