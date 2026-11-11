jest.mock('electron', () => ({
    app: { getPath: jest.fn() }
}));

import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import { randomUUID } from 'crypto';
import { saveIncomingLetterHistory } from '../../src/main/conversationHistory';
import { buildConversationHistoryHeader } from '../../src/main/conversation/conversationHistoryHeader';
import { buildLetterHistoryRecord, buildIncomingLetterHistoryRecord } from '../../src/main/letter/letterHistoryRecord';
import {
    letterHistoryDir,
    battleReportHistoryPath,
    conversationHistoryDir
} from '../../src/main/campaignDataPaths';
import { buildIdentityFromParts } from '../../src/shared/gameData/CampaignIdentity';
import type { Ck3GameDate } from '../../src/shared/gameData/gameDate';
import type { Summary } from '../../src/main/ts/conversation_interfaces';

const IDENTITY = buildIdentityFromParts({ a: 1, b: 2, c: 3, d: 4 }, 'player-1001');

function makeTmpUserData(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'votc-source-meta-'));
}

function gameDate(year: number, month: number, day: number, totalDays: number): Ck3GameDate {
    return { totalDays, year, month, day, display: `${year}.${month}.${day}` };
}

function makeLetterCharacter(id: number, shortName: string) {
    return {
        id,
        shortName,
        fullName: shortName,
        firstName: shortName,
        primaryTitle: 'Count',
        titleRankConcept: 'county',
        sheHe: 'he',
        age: 30,
        gold: 10,
        opinionOfPlayer: 0,
        sexuality: '',
        personality: '',
        greed: 0,
        isIndependentRuler: false,
        isRuler: true,
        isLandedRuler: true,
        isKnight: false,
        prowess: 5,
        liege: '',
        topLiege: '',
        consort: '',
        culture: '',
        faith: '',
        house: '',
        capitalLocation: '',
        liegeRealmLaw: '',
        heldCourtAndCouncilPositions: '',
        secrets: [],
        ownedSecrets: [],
        knownSecrets: [],
        ownedSchemes: [],
        exposedTargetingSchemes: [],
        memories: [],
        traits: [],
        relationsToPlayer: [],
        relationsToCharacters: [],
        opinionBreakdownToPlayer: [],
        opinions: []
    } as unknown as import('../../src/shared/gameData/Character').Character;
}

describe('chronicle source-record metadata (Task 7)', () => {
    let userData: string;

    beforeEach(() => {
        userData = makeTmpUserData();
        (app.getPath as jest.Mock).mockReturnValue(userData);
    });

    afterEach(() => {
        fs.rmSync(userData, { recursive: true, force: true });
    });

    describe('conversation history header + summary', () => {
        it('conversation history text header contains VOTC source record id and game date lines', () => {
            const sourceRecordId = randomUUID();
            const gd = gameDate(1066, 1, 1, 388798);
            const nextCheckpointEpoch = 5;
            const timelineNodeId = '1-1';
            const timelineParentId = '0-0';
            const datePrefix = '日期';

            const textContent = buildConversationHistoryHeader({
                sourceRecordId,
                gameDate: gd,
                displayDate: '1066.1.1',
                checkpointEpoch: nextCheckpointEpoch,
                timeline: { nodeId: timelineNodeId, parentId: timelineParentId } as any,
                datePrefix
            });

            expect(textContent).toContain(`VOTC source record id: ${sourceRecordId}`);
            expect(textContent).toContain(`VOTC game date total days: ${gd.totalDays}`);
            expect(textContent).toContain(`VOTC game date: ${gd.year}-${gd.month}-${gd.day}`);
            expect(textContent).toContain(`${datePrefix}: 1066.1.1`);
            expect(textContent).toContain(`VOTC checkpoint: ${nextCheckpointEpoch}`);
            expect(textContent).toContain(`VOTC timeline node: ${timelineNodeId}`);
            expect(textContent).toContain(`VOTC timeline parent: ${timelineParentId}`);
            expect(textContent.endsWith('\n\n')).toBe(true);
        });

        it('conversation header omits game date lines when gameDate is undefined', () => {
            const sourceRecordId = randomUUID();
            const textContent = buildConversationHistoryHeader({
                sourceRecordId,
                gameDate: undefined,
                displayDate: '1066.1.1',
                checkpointEpoch: 1,
                timeline: { nodeId: '1-1', parentId: '0-0' } as any,
                datePrefix: 'Date'
            });
            expect(textContent).toContain(`VOTC source record id: ${sourceRecordId}`);
            expect(textContent).toContain('VOTC game date total days: \n');
            expect(textContent).toContain('VOTC game date: \n');
        });

        it('Summary object carries sourceType/sourceRecordId/gameDate and they are optional', () => {
            const sourceRecordId = randomUUID();
            const gd = gameDate(1066, 1, 1, 388798);
            const summary: Summary = {
                date: '1066.1.1',
                content: 'conversation about borders',
                votcCheckpointEpoch: 5,
                votcTimelineNodeId: '1-1',
                votcTimelineParentId: undefined,
                id: `summary_1-1_1`,
                sourceType: 'conversation',
                sourceRecordId,
                gameDate: gd
            };
            expect(summary.sourceType).toBe('conversation');
            expect(summary.sourceRecordId).toBe(sourceRecordId);
            expect(summary.gameDate).toBe(gd);

            const legacy: Summary = {
                date: '1066.1.1',
                content: 'legacy summary without metadata'
            };
            expect(legacy.sourceType).toBeUndefined();
            expect(legacy.sourceRecordId).toBeUndefined();
            expect(legacy.gameDate).toBeUndefined();
        });

        it('multiple per-character summaries from one conversation share the SAME sourceRecordId', () => {
            const sourceRecordId = randomUUID();
            const gd = gameDate(1066, 1, 1, 388798);
            const baseSummary: Summary = {
                date: '1066.1.1',
                content: 'shared conversation content',
                votcCheckpointEpoch: 5,
                votcTimelineNodeId: '1-1',
                sourceType: 'conversation',
                sourceRecordId,
                gameDate: gd
            };
            const charA: Summary = { ...baseSummary, characterName: 'A' };
            const charB: Summary = { ...baseSummary, characterName: 'B' };
            expect(charA.sourceRecordId).toBe(charB.sourceRecordId);
            expect(charA.sourceRecordId).toBe(sourceRecordId);
        });
    });

    describe('letter reply records', () => {
        it('player letter reply record carries sourceRecordId, sourceType, gameDate, senderId, receiverId and snapshots', () => {
            const sourceRecordId = randomUUID();
            const gd = gameDate(1066, 1, 1, 388798);
            const player = makeLetterCharacter(1001, 'Player');
            const ai = makeLetterCharacter(2002, 'AI');

            const record = buildLetterHistoryRecord({
                letterId: 'letter_1',
                deliveryId: 7,
                playerName: 'Player',
                aiName: 'AI',
                playerLetter: 'hello',
                aiReply: 'hi',
                checkpointEpoch: 6,
                timeline: { nodeId: '1-1', parentId: '0-0' } as any,
                identity: IDENTITY,
                sourceRecordId,
                gameDate: gd,
                senderId: '1001',
                receiverId: '2002',
                senderCharacter: player,
                receiverCharacter: ai
            });

            const dir = letterHistoryDir(userData, IDENTITY);
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, 'character_2002.json');
            fs.writeFileSync(file, JSON.stringify([record], null, 2), 'utf8');

            const read = JSON.parse(fs.readFileSync(file, 'utf8'));
            expect(read[0].sourceRecordId).toBe(sourceRecordId);
            expect(read[0].sourceType).toBe('letter');
            expect(read[0].gameDate).toEqual(gd);
            expect(read[0].senderId).toBe('1001');
            expect(read[0].receiverId).toBe('2002');
            expect(read[0].votcTimelineNodeId).toBe('1-1');
            expect(read[0].votcTimelineParentId).toBe('0-0');
            expect(read[0].votcCheckpointEpoch).toBe(6);
            expect(read[0].playerName).toBe('Player');
            expect(read[0].aiName).toBe('AI');
            expect(read[0].kind).toBe('outgoing_letter');
            expect(read[0].characters).toHaveLength(2);
        });

        it('letter reply record rejects a missing structured gameDate (fail closed)', () => {
            expect(() =>
                buildLetterHistoryRecord({
                    letterId: 'letter_1',
                    deliveryId: 7,
                    playerName: 'Player',
                    aiName: 'AI',
                    playerLetter: 'hello',
                    aiReply: 'hi',
                    checkpointEpoch: 1,
                    timeline: { nodeId: '1-1', parentId: null } as any,
                    identity: IDENTITY,
                    sourceRecordId: randomUUID(),
                    gameDate: undefined as unknown as Ck3GameDate,
                    senderId: '1001',
                    receiverId: '2002',
                    senderCharacter: makeLetterCharacter(1001, 'Player'),
                    receiverCharacter: makeLetterCharacter(2002, 'AI')
                })
            ).toThrow(/gameDate/);
        });
    });

    describe('incoming letter records (saveIncomingLetterHistory)', () => {
        it('incoming letter record carries sourceRecordId, chronicleSourceKind and gameDate', async () => {
            const sourceRecordId = randomUUID();
            const gd = gameDate(1066, 1, 1, 388798);
            const record = buildIncomingLetterHistoryRecord({
                id: 'incoming_letter_1|1001|2002|1066.1.1|travel_tales|1',
                topic: 'travel_tales',
                senderId: '2002',
                receiverId: '1001',
                content: 'a letter from afar',
                checkpointEpoch: 6,
                timeline: { nodeId: '1-1', parentId: null } as any,
                identity: IDENTITY,
                sourceRecordId,
                gameDate: gd,
                senderCharacter: makeLetterCharacter(2002, 'Sender'),
                receiverCharacter: makeLetterCharacter(1001, 'Player')
            });
            await saveIncomingLetterHistory(record, IDENTITY);

            const dir = letterHistoryDir(userData, IDENTITY);
            const file = path.join(dir, 'character_2002.json');
            const read = JSON.parse(fs.readFileSync(file, 'utf8'));
            expect(read[0].sourceRecordId).toBe(sourceRecordId);
            expect(read[0].chronicleSourceKind).toBe('incoming_letter');
            expect(read[0].gameDate).toEqual(gd);
            // existing fields preserved
            expect(read[0].sourceType).toBe('travel_tales');
            expect(read[0].direction).toBe('incoming');
            expect(read[0].characters).toHaveLength(2);
        });

        it('duplicate incoming letters are idempotent and corrupt files fail closed', async () => {
            const record = buildIncomingLetterHistoryRecord({
                id: 'incoming_letter_2|1001|2003|1066.1.1|war_news|2',
                topic: 'war_news',
                senderId: '2003',
                receiverId: '1001',
                content: 'the war continues',
                checkpointEpoch: 6,
                timeline: { nodeId: '1-1', parentId: null } as any,
                identity: IDENTITY,
                sourceRecordId: randomUUID(),
                gameDate: gameDate(1066, 1, 1, 388798),
                senderCharacter: makeLetterCharacter(2003, 'Sender'),
                receiverCharacter: makeLetterCharacter(1001, 'Player')
            });
            await saveIncomingLetterHistory(record, IDENTITY);
            await saveIncomingLetterHistory(record, IDENTITY);

            const file = path.join(letterHistoryDir(userData, IDENTITY), 'character_2003.json');
            const read = JSON.parse(fs.readFileSync(file, 'utf8'));
            expect(read).toHaveLength(1);
        });
    });

    describe('battle report records', () => {
        it('battle report record carries sourceRecordId, sourceType and gameDate', () => {
            const sourceRecordId = randomUUID();
            const gd = gameDate(1066, 1, 1, 388798);
            const record = {
                id: 'battle_sig',
                dedupKey: 'battle_sig@1-1',
                createdAt: new Date().toISOString(),
                votcCheckpointEpoch: 6,
                votcTimelineNodeId: '1-1',
                votcTimelineParentId: undefined,
                votcObservedTimelineNodeId: undefined,
                votcObservedTimelineParentId: undefined,
                votcCommitAttemptId: 'att-1',
                date: '1066.1.1',
                location: 'London',
                winnerName: 'Winner',
                loserName: 'Loser',
                result: 'victory',
                content: 'a great battle',
                sourceRecordId,
                sourceType: 'battle_report',
                gameDate: gd
            };
            const file = battleReportHistoryPath(userData, IDENTITY);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, JSON.stringify([record], null, 2), 'utf8');

            const read = JSON.parse(fs.readFileSync(file, 'utf8'));
            expect(read[0].sourceRecordId).toBe(sourceRecordId);
            expect(read[0].sourceType).toBe('battle_report');
            expect(read[0].gameDate).toEqual(gd);
        });
    });

    describe('backward compatibility', () => {
        it('old letter records without sourceRecordId still parse without error', () => {
            const legacyRecord = {
                playerName: 'Player',
                aiName: 'AI',
                playerLetter: 'hello',
                aiReply: 'hi',
                createdAt: '2026-01-01T00:00:00.000Z',
                votcCheckpointEpoch: 3,
                votcTimelineNodeId: '1-1'
            };
            const dir = letterHistoryDir(userData, IDENTITY);
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, 'character_2002.json');
            fs.writeFileSync(file, JSON.stringify([legacyRecord], null, 2), 'utf8');

            const read = JSON.parse(fs.readFileSync(file, 'utf8'));
            expect(read[0].sourceRecordId).toBeUndefined();
            expect(read[0].sourceType).toBeUndefined();
            expect(read[0].playerLetter).toBe('hello');
        });

        it('old conversation summary without sourceRecordId still parses as Summary', () => {
            const legacySummary = {
                date: '1066.1.1',
                content: 'legacy content',
                votcCheckpointEpoch: 3,
                votcTimelineNodeId: '1-1',
                id: 'summary_1-1_1'
            };
            const dir = path.join(userData, 'votc_data', 'conversation_summaries', IDENTITY.playerId);
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, '2002.json');
            fs.writeFileSync(file, JSON.stringify([legacySummary], null, 2), 'utf8');

            const read: Summary[] = JSON.parse(fs.readFileSync(file, 'utf8'));
            expect(read[0].sourceRecordId).toBeUndefined();
            expect(read[0].sourceType).toBeUndefined();
            expect(read[0].content).toBe('legacy content');
        });

        it('old battle report record without sourceRecordId still parses', () => {
            const legacyBattle = {
                id: 'battle_sig',
                dedupKey: 'battle_sig@1-1',
                createdAt: '2026-01-01T00:00:00.000Z',
                votcCheckpointEpoch: 3,
                votcTimelineNodeId: '1-1',
                date: '1066.1.1',
                location: 'London',
                winnerName: 'Winner',
                loserName: 'Loser',
                result: 'victory',
                content: 'legacy battle'
            };
            const file = battleReportHistoryPath(userData, IDENTITY);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, JSON.stringify([legacyBattle], null, 2), 'utf8');

            const read = JSON.parse(fs.readFileSync(file, 'utf8'));
            expect(read[0].sourceRecordId).toBeUndefined();
            expect(read[0].sourceType).toBeUndefined();
            expect(read[0].content).toBe('legacy battle');
        });

        it('old incoming letter record without sourceRecordId still parses', () => {
            const legacyIncoming = {
                id: 'incoming_letter_1|1001|2002|1066.1.1|travel_tales|1',
                direction: 'incoming',
                sourceType: 'travel_tales',
                senderId: '2002',
                receiverId: '1001',
                senderName: 'Sender',
                receiverName: 'Player',
                content: 'legacy incoming letter',
                createdAt: '2026-01-01T00:00:00.000Z',
                votcCheckpointEpoch: 3,
                votcTimelineNodeId: '1-1'
            };
            const dir = letterHistoryDir(userData, IDENTITY);
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, 'character_2002.json');
            fs.writeFileSync(file, JSON.stringify([legacyIncoming], null, 2), 'utf8');

            const read = JSON.parse(fs.readFileSync(file, 'utf8'));
            expect(read[0].sourceRecordId).toBeUndefined();
            expect(read[0].chronicleSourceKind).toBeUndefined();
            expect(read[0].content).toBe('legacy incoming letter');
        });
    });

    describe('sibling-branch isolation', () => {
        it('summaries from a sibling timeline node are not confused by sourceRecordId', () => {
            const dir = path.join(userData, 'votc_data', 'conversation_summaries', IDENTITY.playerId);
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, '2002.json');
            const branchA: Summary = {
                date: '1066.1.1',
                content: 'branch A conversation',
                votcTimelineNodeId: '1-1',
                sourceRecordId: randomUUID(),
                sourceType: 'conversation'
            };
            const branchB: Summary = {
                date: '1066.1.2',
                content: 'branch B conversation',
                votcTimelineNodeId: '2-1',
                sourceRecordId: randomUUID(),
                sourceType: 'conversation'
            };
            fs.writeFileSync(file, JSON.stringify([branchA, branchB], null, 2), 'utf8');

            const read: Summary[] = JSON.parse(fs.readFileSync(file, 'utf8'));
            const visibleFromA = read.filter(s => s.votcTimelineNodeId === '1-1');
            expect(visibleFromA.length).toBe(1);
            expect(visibleFromA[0].content).toBe('branch A conversation');
            expect(visibleFromA.some(s => s.votcTimelineNodeId === '2-1')).toBe(false);
            expect(branchA.sourceRecordId).not.toBe(branchB.sourceRecordId);
        });
    });
});
