import { spawnSync } from 'child_process';
import path from 'path';
it('exercises subscription settings in a DOM with real component code', () => {
    const result = spawnSync(process.execPath, ['--test-reporter=tap', path.join(__dirname, '../fixtures/chatgptSettings.cjs')],
        { encoding: 'utf8', timeout: 30000 });
    if (result.status !== 0) throw new Error(result.stdout + result.stderr + (result.error?.message || ''));
    expect(result.stdout).toContain('# pass 4');
}, 35000);
