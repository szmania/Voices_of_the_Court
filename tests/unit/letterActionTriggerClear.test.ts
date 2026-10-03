/**
 * Unit tests for LetterActionTrigger.clearLetterRunFile — the app-side handler for
 * VOTC:LETTER_EFFECT_ACCEPTED. The game fires that keyword (message_event.363) after
 * executing run/votc_letter_actions.txt; the handler must empty the file so a stale
 * effect cannot re-fire on the next write-letter interaction.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LetterActionTrigger } from '../../src/main/letter/LetterActionTrigger';
import type { Config } from '../../src/shared/Config';

describe('LetterActionTrigger.clearLetterRunFile', () => {
    let tmpDir: string;
    let runFilePath: string;

    const makeConfig = (): Config => ({ userFolderPath: tmpDir } as unknown as Config);

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-letter-clear-'));
        runFilePath = path.join(tmpDir, 'run', 'votc_letter_actions.txt');
        // Reset the lazily-created static manager so each test exercises the
        // "no letter action ran yet this session" state the keyword can arrive in.
        (LetterActionTrigger as any).letterRunFileManager = null;
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('empties an existing run file', () => {
        fs.mkdirSync(path.dirname(runFilePath), { recursive: true });
        fs.writeFileSync(runFilePath, '\uFEFFroot = { trigger_event = message_event.363 }', 'utf-8');

        LetterActionTrigger.clearLetterRunFile(makeConfig());

        expect(fs.readFileSync(runFilePath, 'utf-8')).toBe('');
    });

    test('is safe to call before any letter action ran (no exception)', () => {
        expect(() => LetterActionTrigger.clearLetterRunFile(makeConfig())).not.toThrow();
        // clear() writes an empty file even when none existed before.
        expect(fs.existsSync(runFilePath)).toBe(true);
        expect(fs.readFileSync(runFilePath, 'utf-8')).toBe('');
    });

    test('reuses the run file manager on subsequent calls', () => {
        fs.mkdirSync(path.dirname(runFilePath), { recursive: true });
        fs.writeFileSync(runFilePath, 'stale effect', 'utf-8');

        LetterActionTrigger.clearLetterRunFile(makeConfig()); // creates the manager
        fs.writeFileSync(runFilePath, 'stale effect again', 'utf-8');
        LetterActionTrigger.clearLetterRunFile(makeConfig()); // reuses the manager

        expect(fs.readFileSync(runFilePath, 'utf-8')).toBe('');
    });
});