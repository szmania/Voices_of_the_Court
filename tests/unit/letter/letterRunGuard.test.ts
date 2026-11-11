import * as fs from 'fs';
import * as path from 'path';
import { LetterManager } from '../../../src/main/letter/LetterManager';
import { writeLetterReplyFallbackRunFile } from '../../../src/main/letter/LetterReplyGenerator';
import { guardLetterRunPayload, LETTER_DATE_HEARTBEAT } from '../../../src/main/letter/letterRunGuard';
import { buildIdentityFromParts } from '../../../src/shared/gameData/CampaignIdentity';
import type { Config } from '../../../src/shared/Config';
import type { StoredLetter } from '../../../src/main/letter/letterInterfaces';

const identity = buildIdentityFromParts({ a: 11, b: 22, c: 33, d: 44 }, '1001');

describe('game execution guards on actual letter run files', () => {
    let root: string;
    beforeEach(() => { root = fs.mkdtempSync(path.join(process.cwd(), '.letter-guard-test-')); });
    afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

    function reply(campaignId?: string): StoredLetter {
        return {
            originalLetter: { id: 'original', subject: 'letter_2', totalDays: 123 },
            letter: {
                id: 'reply', content: 'A reply with "quotes"', recipient: { id: 1001 },
                timelineCampaignId: campaignId, timelinePlayerId: '1001',
                timelineScript: 'set_variable = { name = test_timeline value = 9 }'
            }
        } as unknown as StoredLetter;
    }

    function checkOuterGuard(script: string): void {
        expect(script.replace(/^\uFEFF/, '').split('\n')[0]).toBe(LETTER_DATE_HEARTBEAT);
        expect(script).toContain('exists = global_var:votc_letter_2');
        expect(script).toContain('this = character:1001');
        for (const [key, value] of Object.entries(identity.campaignParts)) {
            expect(script).toContain(`global_var:votc_campaign_id_${key} = ${value}`);
        }
        // No game effect may escape the top-level guarded block. In particular
        // the timeline append and artifact metadata must be indented inside it.
        const topLevel = script.replace(/^\uFEFF/, '').split('\n').filter(line => /^\S/.test(line));
        expect(topLevel).toEqual([LETTER_DATE_HEARTBEAT, 'if = {', '}', 'else = {', '}']);
    }

    test('guards artifact creation, thread removal, event and appended timeline together', () => {
        LetterManager.getInstance().deliverLetter(reply(identity.campaignId), { userFolderPath: root } as Config, '1066.1.1');
        const bytes = fs.readFileSync(path.join(root, 'run/letters.txt'));
        expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
        const script = bytes.toString('utf8');
        checkOuterGuard(script);
        expect(script).toContain('\tcreate_artifact = {');
        expect(script).toContain('\tremove_global_variable ?= votc_letter_2');
        expect(script).toContain('\ttrigger_event = message_event.362');
        expect(script).toContain('\tset_variable = { name = test_timeline value = 9 }');
        expect(script).toContain('wealth = 0');
        expect(script).toContain('name = votc_letter_artifact value = yes');
        expect(script).toContain('VOTC:DELIVERY/;/skipped/;/letter_2/;/123');
    });

    test('retains the unstamped legacy exemption with player and thread guards', () => {
        LetterManager.getInstance().deliverLetter(reply(), { userFolderPath: root } as Config, '1066.1.1');
        const script = fs.readFileSync(path.join(root, 'run/letters.txt'), 'utf8');
        expect(script).toContain('this = character:1001');
        expect(script).toContain('exists = global_var:votc_letter_2');
        expect(script).not.toContain('votc_campaign_id_');
    });

    test('rejects a corrupt campaign stamp before overwriting the channel', () => {
        fs.mkdirSync(path.join(root, 'run'));
        const channel = path.join(root, 'run/letters.txt');
        fs.writeFileSync(channel, 'existing payload');
        expect(() => LetterManager.getInstance().deliverLetter(reply('11-22'), { userFolderPath: root } as Config, '1066.1.1')).toThrow();
        expect(fs.readFileSync(channel, 'utf8')).toBe('existing payload');
    });

    test('fallback captures its original campaign even if it is executed later', () => {
        writeLetterReplyFallbackRunFile(root, 'letter_2', 123, { script: 'set_variable = { name = test_timeline value = 9 }' }, identity);
        const payload = fs.readFileSync(path.join(root, 'run/letter2.txt'), 'utf8');
        checkOuterGuard(payload);
        expect(payload).toContain('VOTC:FALLBACK/;/skipped/;/letter_2/;/123');
        expect(payload).toContain('\t\tsend_interface_message = {');
        expect(payload).not.toContain('VOTC:LETTER/;/');
    });

    test.each(['0', '1001 } trigger_event = message_event.362'])('rejects unsafe player identity %s', playerId => {
        expect(() => guardLetterRunPayload(LETTER_DATE_HEARTBEAT, { slotId: 'letter_2', playerId, deliveryId: 123 })).toThrow();
    });
});
