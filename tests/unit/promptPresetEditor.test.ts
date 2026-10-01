import { spawnSync } from 'child_process';
import path from 'path';

it('loads, edits, saves and reloads prompt presets without the retired config.prompts schema', () => {
    // jsdom 29 requires Node's ESM loader for some dependencies.
    const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', path.join(__dirname, '../fixtures/promptPresetEditor.cjs')], {
        encoding: 'utf8', timeout: 30000
    });
    if (result.status !== 0) throw new Error(result.stdout + result.stderr + (result.error?.message || ''));
    expect(result.stdout).toContain('# pass 4');
}, 35000);
