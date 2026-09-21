/**
 * PR #15 legacy data compatibility regression suite.
 *
 * Every fixture below is written in the shape the pre-campaign code actually
 * produced (flat directories under `votc_data/`, records without campaign
 * lineage, summaries without epoch/node labels). The assertions pin the promise
 * the maintainer asked for: upgrading users keep seeing their existing data —
 * conversations, summaries, memories, diaries, letters and battle reports —
 * while records that belong to another campaign stay out of this one.
 *
 * Nothing here reads the real userData directory. `app.getPath` is pointed at a
 * temporary root, and because some modules resolve their paths at import time
 * (diaryManager, compactedMemoryStore), the modules under test are required
 * AFTER that mock is in place — which also means the electron mock instance has
 * to be re-required after `jest.resetModules` clears the registry.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { app } from 'electron';
import { buildIdentityFromParts } from '../../../src/shared/gameData/CampaignIdentity';
import { TimelineRegistry } from '../../../src/main/timelineManager';

const PLAYER_ID = '1001';
const AI_ID = '1002';
const SECOND_AI_ID = '1003';
const IDENTITY = buildIdentityFromParts({a: 7, b: 8, c: 9, d: 10}, PLAYER_ID);

function writeJson(filePath: string, value: unknown): void {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, JSON.stringify(value, null, '\t'), 'utf8');
}

function writeText(filePath: string, value: string): void {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, value, 'utf8');
}

// Pre-upgrade user data: one player, no campaign-scoped store anywhere, all data
// in the legacy flat layout.
function writeLegacyUserData(root: string): void {
    const votcData = path.join(root, 'votc_data');

    // Transcripts, in the shape Conversation._saveHistoryToFile writes them.
    writeText(
        path.join(votcData, 'conversation_history', PLAYER_ID, `${PLAYER_ID}_${AI_ID}_1770000000000.txt`),
        `Date: 1066.1.1\nLocation: Paris\n\nPlayer: Did you hear about the siege?\n\n${AI_ID}: I did.\n`
    );
    writeText(
        path.join(votcData, 'conversation_history', PLAYER_ID, `${PLAYER_ID}_${AI_ID}_ckpt2_1770000300000.txt`),
        `Date: 1066.3.1\n\nPlayer: A later talk.\n\n${AI_ID}: Indeed.\n`
    );
    writeText(
        path.join(votcData, 'conversation_history', PLAYER_ID, `${PLAYER_ID}_${SECOND_AI_ID}_tl_10-20_1770000600000.txt`),
        `Date: 1066.5.1\n\nPlayer: Node tagged talk.\n\n${SECOND_AI_ID}: Noted.\n`
    );

    // Summaries: no votcCheckpointEpoch / votcTimelineNodeId at all.
    writeJson(path.join(votcData, 'conversation_summaries', PLAYER_ID, `${AI_ID}.json`), [
        {date: '1066.1.1', content: 'They discussed the siege.'},
        {date: '1065.1.1', content: 'An older, unlabelled summary.'}
    ]);
    writeJson(path.join(votcData, 'conversation_summaries', PLAYER_ID, '_character_map.json'), {[AI_ID]: 'Test Char'});

    // Letter history: per-character files, records with no campaign lineage and
    // no stable id — only the business fields the archive view projects.
    writeJson(path.join(votcData, 'letter_history', `player_${PLAYER_ID}`, `character_${AI_ID}.json`), [
        {
            playerName: 'Player',
            aiName: 'Test Char',
            playerLetter: 'Legacy outgoing letter',
            aiReply: 'Legacy reply',
            createdAt: '2026-07-01T00:00:00.000Z',
            votcCheckpointEpoch: 1
        },
        {
            playerName: 'Player',
            aiName: 'Test Char',
            playerLetter: 'Legacy letter without any checkpoint label',
            aiReply: 'Reply without label',
            createdAt: '2026-06-01T00:00:00.000Z'
        }
    ]);
    writeJson(path.join(votcData, 'letter_history', `player_${PLAYER_ID}`, `character_${SECOND_AI_ID}.json`), [
        {
            id: 'incoming-legacy-1',
            direction: 'incoming',
            senderName: 'Test Char',
            sourceType: 'deathbed',
            content: 'A legacy incoming letter.',
            createdAt: '2026-05-01T00:00:00.000Z'
        }
    ]);

    // Battle reports: one flat file for the player.
    writeJson(path.join(votcData, 'battle_report_history', `player_${PLAYER_ID}.json`), [
        {
            id: 'battle-legacy-1',
            location: 'Legacy battlefield',
            winnerName: 'Player',
            loserName: 'Test Char',
            content: 'A legacy battle report.',
            createdAt: '2026-04-01T00:00:00.000Z'
        }
    ]);

    // Diaries and their summaries (`date` only, no timeline labels).
    writeJson(path.join(votcData, 'diary_history', PLAYER_ID, `${AI_ID}.json`), {
        diary_entries: [
            {id: 'diary-legacy-1', date: '1066.1.1', content: 'A legacy diary entry.'}
        ]
    });
    writeJson(path.join(votcData, 'diary_summaries', PLAYER_ID, `${AI_ID}.json`), [
        {id: 'diary-summary-legacy-1', diaryEntryId: 'diary-legacy-1', date: '1066.1.1', summary: 'A legacy diary summary.'}
    ]);
}

/**
 * Loads the modules under test against a fixture root. `jest.resetModules` is
 * what makes the import-time path constants pick up the temp directory, and it
 * also throws away the previously loaded electron mock, so the mock is
 * re-required and re-pointed before the modules that depend on it.
 */
function loadModulesUnderTest(root: string) {
    jest.resetModules();
    const electronMock = require('electron') as unknown as {app: {getPath: jest.Mock}};
    electronMock.app.getPath.mockReturnValue(root);
    return {
        history: require('../../../src/main/conversationHistory') as typeof import('../../../src/main/conversationHistory'),
        summaryManager: require('../../../src/main/summaryManager') as typeof import('../../../src/main/summaryManager'),
        diaryManager: require('../../../src/main/diaryManager') as typeof import('../../../src/main/diaryManager'),
        compactedMemoryStore: (require('../../../src/main/compactedMemoryStore') as typeof import('../../../src/main/compactedMemoryStore')).compactedMemoryStore
    };
}

describe('legacy user data stays readable after the timeline upgrade', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'votc-legacy-compat-'));
        writeLegacyUserData(root);
        (app.getPath as jest.Mock).mockReturnValue(root);
    });

    afterEach(() => {
        const target = path.resolve(root);
        if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(target).startsWith('votc-legacy-compat-')) {
            throw new Error('unsafe cleanup');
        }
        fs.rmSync(target, {recursive: true, force: true});
        jest.restoreAllMocks();
    });

    it('lists legacy transcripts for the player, with and without a campaign identity', async () => {
        const {history} = loadModulesUnderTest(root);

        const withoutIdentity = await history.getConversationHistoryFiles(PLAYER_ID);
        expect(withoutIdentity.map(file => file.fileName)).toEqual(expect.arrayContaining([
            `${PLAYER_ID}_${AI_ID}_1770000000000.txt`,
            `${PLAYER_ID}_${AI_ID}_ckpt2_1770000300000.txt`
        ]));

        const withIdentity = await history.getConversationHistoryFiles(PLAYER_ID, 2, undefined, undefined, IDENTITY);
        expect(withIdentity.map(file => file.fileName)).toEqual(expect.arrayContaining([
            `${PLAYER_ID}_${AI_ID}_1770000000000.txt`,
            `${PLAYER_ID}_${AI_ID}_ckpt2_1770000300000.txt`
        ]));
    });

    it('still applies the checkpoint filter to legacy transcripts', async () => {
        const {history} = loadModulesUnderTest(root);

        const atEpochOne = await history.getConversationHistoryFiles(PLAYER_ID, 1, undefined, undefined, IDENTITY);
        expect(atEpochOne.map(file => file.fileName)).not.toContain(`${PLAYER_ID}_${AI_ID}_ckpt2_1770000300000.txt`);
        expect(atEpochOne.map(file => file.fileName)).toContain(`${PLAYER_ID}_${AI_ID}_1770000000000.txt`);
    });

    it('reads a legacy transcript written before the campaign layout existed', async () => {
        const {history} = loadModulesUnderTest(root);

        const content = await history.readConversationHistoryFile(
            PLAYER_ID,
            `${PLAYER_ID}_${AI_ID}_1770000000000.txt`,
            undefined,
            undefined,
            undefined,
            IDENTITY
        );
        expect(content).toContain('Did you hear about the siege?');
    });

    it('keeps summaries without epoch or node labels visible under a campaign identity', async () => {
        const {summaryManager} = loadModulesUnderTest(root);

        const summaries = await summaryManager.readSummaryFile(path.join(root, 'votc_data'), PLAYER_ID, 5, undefined, undefined, IDENTITY);
        expect(summaries.map(summary => summary.content)).toEqual(expect.arrayContaining([
            'They discussed the siege.',
            'An older, unlabelled summary.'
        ]));
    });

    it('hides a summary written after the loaded checkpoint while keeping older ones', async () => {
        const {summaryManager} = loadModulesUnderTest(root);
        writeJson(path.join(root, 'votc_data', 'conversation_summaries', PLAYER_ID, `${SECOND_AI_ID}.json`), [
            {date: '1067.1.1', content: 'Written after the loaded save.', votcCheckpointEpoch: 9}
        ]);

        const summaries = await summaryManager.readSummaryFile(path.join(root, 'votc_data'), PLAYER_ID, 5, undefined, undefined, IDENTITY);
        expect(summaries.map(summary => summary.content)).not.toContain('Written after the loaded save.');
        expect(summaries.map(summary => summary.content)).toContain('They discussed the siege.');
    });

    it('does not repeat a summary that exists in both layouts', async () => {
        const {summaryManager} = loadModulesUnderTest(root);
        const campaignSummaryDir = path.join(
            root, 'votc_data', 'campaigns', IDENTITY.campaignId, 'players', PLAYER_ID, 'conversation_summaries'
        );
        writeJson(path.join(campaignSummaryDir, `${AI_ID}.json`), [
            {date: '1066.1.1', content: 'They discussed the siege.'},
            {date: '1066.2.1', content: 'A campaign-only summary.'}
        ]);

        const summaries = await summaryManager.readSummaryFile(path.join(root, 'votc_data'), PLAYER_ID, 5, undefined, undefined, IDENTITY);
        expect(summaries.filter(summary => summary.content === 'They discussed the siege.')).toHaveLength(1);
        expect(summaries.map(summary => summary.content)).toContain('A campaign-only summary.');
    });

    it('lists legacy letters in the archive view when a campaign identity is known', async () => {
        const {history} = loadModulesUnderTest(root);

        const entries = await history.getLetterHistoryEntries(PLAYER_ID, 5, undefined, undefined, IDENTITY);
        const contents = entries.map(entry => entry.content).join('\n');
        expect(contents).toContain('Legacy letter without any checkpoint label');
        expect(contents).toContain('Legacy outgoing letter');
        expect(contents).toContain('A legacy incoming letter.');
    });

    it('merges the campaign and legacy letter layouts instead of dropping the legacy records', async () => {
        const campaignDir = path.join(
            root, 'votc_data', 'campaigns', IDENTITY.campaignId, 'players', PLAYER_ID, 'letter_history'
        );
        writeJson(path.join(campaignDir, `character_${AI_ID}.json`), [
            {
                playerName: 'Player',
                aiName: 'Test Char',
                playerLetter: 'New campaign letter',
                aiReply: 'New campaign reply',
                createdAt: '2026-09-01T00:00:00.000Z',
                votcCheckpointEpoch: 4
            }
        ]);
        const {history} = loadModulesUnderTest(root);

        const entries = await history.getLetterHistoryEntries(PLAYER_ID, 5, undefined, undefined, IDENTITY);
        const contents = entries.map(entry => entry.content).join('\n');
        expect(contents).toContain('New campaign letter');
        expect(contents).toContain('Legacy letter without any checkpoint label');
    });

    it('does not duplicate a letter that exists in both layouts', async () => {
        const legacyRecords = JSON.parse(fs.readFileSync(
            path.join(root, 'votc_data', 'letter_history', `player_${PLAYER_ID}`, `character_${AI_ID}.json`),
            'utf8'
        ));
        const campaignDir = path.join(
            root, 'votc_data', 'campaigns', IDENTITY.campaignId, 'players', PLAYER_ID, 'letter_history'
        );
        writeJson(path.join(campaignDir, `character_${AI_ID}.json`), legacyRecords);
        const {history} = loadModulesUnderTest(root);

        const entries = await history.getLetterHistoryEntries(PLAYER_ID, 5, undefined, undefined, IDENTITY);
        expect(entries.filter(entry => entry.content.includes('Legacy outgoing letter'))).toHaveLength(1);
    });

    it('keeps a legacy letter another campaign already holds out of this campaign, without hiding its neighbours', async () => {
        const legacyRecords = JSON.parse(fs.readFileSync(
            path.join(root, 'votc_data', 'letter_history', `player_${PLAYER_ID}`, `character_${AI_ID}.json`),
            'utf8'
        ));
        // The other campaign owns the first legacy record (same record, same
        // character file) but not the second one.
        const otherCampaignDir = path.join(
            root, 'votc_data', 'campaigns', '999-999-999-999', 'players', PLAYER_ID, 'letter_history'
        );
        writeJson(path.join(otherCampaignDir, `character_${AI_ID}.json`), [legacyRecords[0]]);
        const {history} = loadModulesUnderTest(root);

        const entries = await history.getLetterHistoryEntries(PLAYER_ID, 5, undefined, undefined, IDENTITY);
        const contents = entries.map(entry => entry.content).join('\n');
        expect(contents).not.toContain('Legacy outgoing letter');
        expect(contents).toContain('Legacy letter without any checkpoint label');
    });

    it('applies branch visibility to a node-tagged legacy letter', async () => {
        writeJson(path.join(root, 'votc_data', 'letter_history', `player_${PLAYER_ID}`, `character_${AI_ID}.json`), [
            {
                playerName: 'Player', aiName: 'Test Char',
                playerLetter: 'Ancestor branch letter', aiReply: 'reply',
                createdAt: '2026-03-01T00:00:00.000Z', votcTimelineNodeId: '10-20'
            }
        ]);
        const {history} = loadModulesUnderTest(root);
        const registry = new TimelineRegistry(PLAYER_ID, {
            version: 1,
            playerId: PLAYER_ID,
            nodes: {
                '10-20': {parentId: null, epoch: 1, source: 'conversation', eventKey: 'root', createdAt: '2026-03-01T00:00:00.000Z'},
                '10-21': {parentId: '10-20', epoch: 2, source: 'conversation', eventKey: 'child', createdAt: '2026-03-02T00:00:00.000Z'},
                // A separate save branch: nothing on it descends from 10-20.
                '10-30': {parentId: null, epoch: 3, source: 'conversation', eventKey: 'other-root', createdAt: '2026-03-03T00:00:00.000Z'}
            }
        });

        const onChild = await history.getLetterHistoryEntries(PLAYER_ID, 5, registry, '10-21', IDENTITY);
        expect(onChild.map(entry => entry.content).join('\n')).toContain('Ancestor branch letter');

        const onOtherBranch = await history.getLetterHistoryEntries(PLAYER_ID, 5, registry, '10-30', IDENTITY);
        expect(onOtherBranch.map(entry => entry.content).join('\n')).not.toContain('Ancestor branch letter');
    });

    it('lists legacy battle reports, merged with the campaign file', async () => {
        const {history} = loadModulesUnderTest(root);

        const onlyLegacy = await history.getBattleReportHistoryEntries(PLAYER_ID, 5, undefined, undefined, IDENTITY);
        expect(onlyLegacy.map(entry => entry.content)).toContain('A legacy battle report.');

        writeJson(
            path.join(root, 'votc_data', 'campaigns', IDENTITY.campaignId, 'players', PLAYER_ID, 'battle_report_history.json'),
            [{id: 'battle-new-1', location: 'New battlefield', content: 'A new battle report.', createdAt: '2026-09-01T00:00:00.000Z'}]
        );

        const {history: reloaded} = loadModulesUnderTest(root);
        const merged = await reloaded.getBattleReportHistoryEntries(PLAYER_ID, 5, undefined, undefined, IDENTITY);
        expect(merged.map(entry => entry.content)).toEqual(expect.arrayContaining([
            'A legacy battle report.',
            'A new battle report.'
        ]));
    });

    it('archives a future legacy record into the legacy archive, not the campaign one', async () => {
        writeJson(path.join(root, 'votc_data', 'letter_history', `player_${PLAYER_ID}`, `character_${AI_ID}.json`), [
            {
                playerName: 'Player', aiName: 'Test Char',
                playerLetter: 'From the future', aiReply: 'x',
                createdAt: '2026-09-01T00:00:00.000Z', votcCheckpointEpoch: 9
            }
        ]);
        const {history} = loadModulesUnderTest(root);

        const archived = await history.archiveFutureLetterHistoryForPlayer(PLAYER_ID, 1, 'older_save_checkpoint', IDENTITY);
        expect(archived).toBe(1);

        const remaining = JSON.parse(fs.readFileSync(
            path.join(root, 'votc_data', 'letter_history', `player_${PLAYER_ID}`, `character_${AI_ID}.json`),
            'utf8'
        ));
        expect(remaining).toEqual([]);
        const archiveFile = path.join(root, 'votc_data', 'letter_history_archived', `player_${PLAYER_ID}`, `character_${AI_ID}.json`);
        expect(JSON.parse(fs.readFileSync(archiveFile, 'utf8'))[0].playerLetter).toBe('From the future');
    });

    it('reads legacy diaries and diary summaries', async () => {
        const {diaryManager} = loadModulesUnderTest(root);

        const diary = await diaryManager.readDiaryFile(PLAYER_ID, AI_ID);
        expect(diary.diary_entries.map(entry => entry.content)).toContain('A legacy diary entry.');

        const summaries = await diaryManager.readDiarySummaries(PLAYER_ID, AI_ID);
        expect(summaries.map(summary => summary.summary)).toContain('A legacy diary summary.');
    });

    it('reads compacted memories whose records carry no game date', async () => {
        const {compactedMemoryStore} = loadModulesUnderTest(root);
        // Pre-upgrade records have no gameDate: the read filter must let them
        // through instead of treating them as coming from the future.
        await compactedMemoryStore.saveCompactedMemory(PLAYER_ID, AI_ID, [
            {
                id: 'memory-legacy-1',
                date: '1066.1.1',
                content: 'A legacy compacted memory.',
                characterIds: [Number(AI_ID)],
                relevanceScore: 1,
                entityReferences: [],
                compactionLevel: 1,
                sourceMessageIds: [],
                creationTimestamp: 1750000000000
            }
        ] as never);

        const restored = await compactedMemoryStore.readCompactedMemory(PLAYER_ID, AI_ID, '1066.1.1');
        expect(restored.memories.map(memory => memory.content)).toContain('A legacy compacted memory.');
    });

    it('ignores a corrupt legacy file instead of failing the whole listing', async () => {
        writeText(path.join(root, 'votc_data', 'letter_history', `player_${PLAYER_ID}`, 'character_broken.json'), '{not json');
        const {history} = loadModulesUnderTest(root);

        const entries = await history.getLetterHistoryEntries(PLAYER_ID, 5, undefined, undefined, IDENTITY);
        expect(entries.map(entry => entry.content).join('\n')).toContain('Legacy outgoing letter');
    });

    describe('summaries stamped by a conversation close', () => {
        // The close path stamps new summaries with the node and epoch it
        // committed, so they surface on the branch that produced them and stay
        // out of an older save or a different branch.
        function writeStampedSummary(): void {
            writeJson(path.join(root, 'votc_data', 'conversation_summaries', PLAYER_ID, `${SECOND_AI_ID}.json`), [
                {
                    date: '1066.6.1',
                    content: 'A summary from the closed conversation.',
                    votcCheckpointEpoch: 2,
                    votcTimelineNodeId: '10-21'
                }
            ]);
        }

        function branchRegistry(): TimelineRegistry {
            return new TimelineRegistry(PLAYER_ID, {
                version: 1,
                playerId: PLAYER_ID,
                nodes: {
                    '10-20': {parentId: null, epoch: 1, source: 'conversation', eventKey: 'root', createdAt: '2026-03-01T00:00:00.000Z'},
                    '10-21': {parentId: '10-20', epoch: 2, source: 'conversation', eventKey: 'child', createdAt: '2026-03-02T00:00:00.000Z'},
                    '10-30': {parentId: null, epoch: 2, source: 'conversation', eventKey: 'other-root', createdAt: '2026-03-03T00:00:00.000Z'}
                }
            });
        }

        it('shows a stamped summary on the branch that produced it', async () => {
            writeStampedSummary();
            const {summaryManager} = loadModulesUnderTest(root);

            const summaries = await summaryManager.readSummaryFile(
                path.join(root, 'votc_data'), PLAYER_ID, 2, branchRegistry(), '10-21', IDENTITY
            );
            expect(summaries.map(summary => summary.content)).toContain('A summary from the closed conversation.');
        });

        it('hides a stamped summary from a different branch', async () => {
            writeStampedSummary();
            const {summaryManager} = loadModulesUnderTest(root);

            const summaries = await summaryManager.readSummaryFile(
                path.join(root, 'votc_data'), PLAYER_ID, 2, branchRegistry(), '10-30', IDENTITY
            );
            expect(summaries.map(summary => summary.content)).not.toContain('A summary from the closed conversation.');
        });

        it('hides a stamped summary from an earlier checkpoint', async () => {
            writeStampedSummary();
            const {summaryManager} = loadModulesUnderTest(root);

            const summaries = await summaryManager.readSummaryFile(path.join(root, 'votc_data'), PLAYER_ID, 1, undefined, undefined, IDENTITY);
            expect(summaries.map(summary => summary.content)).not.toContain('A summary from the closed conversation.');
        });

        it('still shows a stamped summary to a caller with no timeline context', async () => {
            // The history renderer can ask for summaries before a branch context
            // is resolvable; hiding every stamped summary in that case would read
            // as "my summaries are gone".
            writeStampedSummary();
            const {summaryManager} = loadModulesUnderTest(root);

            const summaries = await summaryManager.readSummaryFile(path.join(root, 'votc_data'), PLAYER_ID, 2, undefined, undefined, IDENTITY);
            expect(summaries.map(summary => summary.content)).toContain('A summary from the closed conversation.');
        });
    });
});
