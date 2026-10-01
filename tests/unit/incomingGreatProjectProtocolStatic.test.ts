import * as fs from 'fs';
import * as path from 'path';

// P1 port of the source-line Great Project protocol static test. The app
// upstream tests must not reach into the sibling mod working tree, so only
// the pure app-side (generator) assertions live here; the mod-side event /
// effect / trigger structure checks run against the mod repository's own
// tooling with explicit roots.
const APP_ROOT = path.resolve(__dirname, '../..');

function readAppFile(relativePath: string): string {
    return fs.readFileSync(path.join(APP_ROOT, relativePath), 'utf-8');
}

describe('native Great Project incoming-letter protocol (app side)', () => {
    const generator = readAppFile('src/main/letter/IncomingLetterGenerator.ts');

    it('registers the new type in the desktop app while preserving special-building notices', () => {
        expect(generator).toContain("| 'great_work_notice' | 'great_project_report'");
        expect(generator).toContain("great_work_notice: '特殊建筑通告'");
        expect(generator).toContain("great_project_report: '国家重大工程'");
        expect(generator).toContain("context.type === 'great_project_report'");
    });

    it('translates project milestones and project roles for the prompt', () => {
        for (const text of [
            "planned: '规划立项'",
            "started: '正式开工'",
            "halfway: '建设过半'",
            "completed: '竣工'",
            "minister_of_works: '工部尚书'",
            "contributor: '工程出资者'"
        ]) {
            expect(generator).toContain(text);
        }
        for (const factKey of [
            'project_name',
            'project_type',
            'project_stage',
            'project_location',
            'project_progress',
            'project_days_left',
            'project_required_funded',
            'project_required_total',
            'project_founder',
            'project_owner',
            'reporter_role',
            'player_project_role'
        ]) {
            expect(generator).toContain(`${factKey}:`);
        }
    });
});
