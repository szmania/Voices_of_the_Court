/**
 * App plan §12.1.2 — write-back thread continuity (VOTC-194 / P1 incoming letters).
 *
 * A player's in-game "Write back" reply to an incoming letter reaches the app
 * as an ordinary VOTC:LETTER/;/<text>/;/letter_N line. parseLogForLetters must
 * link that reply to the incoming-letter projection (subject 'incoming_<topic>',
 * sender = NPC, recipient = player, no replyToId) so the Letters tab renders the
 * full chain (NPC notice -> player reply -> NPC reply) and the reply prompt
 * carries the notice as thread context.
 *
 * Cases:
 *   (a) positive — a player letter_1 to an NPC with an unlinked incoming_<topic>
 *       projection in the store gets replyToId === projection.id;
 *   (b) negative — a spontaneous player letter to an NPC with NO unlinked root
 *       stays unlinked (replyToId undefined).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// The factory is self-contained (no outer const) because jest hoists jest.mock
// above the imports, so an outer variable would still be in its TDZ when the
// module under test first requires 'electron'.
jest.mock('electron', () => ({
    app: { getPath: jest.fn(() => require('path').join(require('os').tmpdir(), 'votc-writeback-userdata')) }
}));

import { parseLettersFromLog } from '../../../src/main/letter/parseLogForLetters';
import { LetterManager } from '../../../src/main/letter/LetterManager';
import { Letter as LetterClass } from '../../../src/main/letter/Letter';
import { LetterType } from '../../../src/main/letter/letterInterfaces';
import { GameData } from '../../../src/shared/gameData/GameData';
import { Character } from '../../../src/shared/gameData/Character';
import type { Config } from '../../../src/shared/Config';

const PLAYER_ID = 1001;
const NPC_ID = 2002;
const TOPIC = 'family_letter';
// Same path the electron mock resolves, so the LetterManager singleton (which
// caches its store path on first use) and the test agree on one directory.
const USER_DATA_ROOT = path.join(os.tmpdir(), 'votc-writeback-userdata');

function makeCharacter(id: number, name: string): Character {
    const fields: string[] = new Array(27).fill('');
    fields[0] = String(id);
    fields[1] = name;
    fields[2] = `${name} FullName`;
    fields[4] = 'he';
    fields[5] = '30';
    return new Character(fields);
}

function makeGameData(): GameData {
    const gameData = new GameData([
        String(PLAYER_ID), 'Player', String(NPC_ID), 'NPC', '1066.1.1',
        'scene_talk_court', 'Paris', 'Controller', '1',
        '11', '22', '5', '6', '42', '0',
        '2', '1', '1', '2', '3', '4', '1', '1'
    ]);
    gameData.addCharacter(PLAYER_ID, makeCharacter(PLAYER_ID, 'Player'));
    gameData.addCharacter(NPC_ID, makeCharacter(NPC_ID, 'Sender'));
    gameData.totalDays = 430583;
    return gameData;
}

function writeBackLog(): string {
    return [
        'noise line',
        'VOTC:LETTER/;/I write back to your letter./;/letter_1/;/430583/;/0/;/'
    ].join('\r\n') + '\r\n';
}

function makeConfig(): Config {
    return { manualLetterActionApproval: true } as unknown as Config;
}

describe('incoming letter write-back thread linking (app plan §12.1)', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        // Fresh letter store per test: the singleton's path is stable, so wiping
        // the directory is what isolates the two cases from each other.
        fs.rmSync(path.join(USER_DATA_ROOT, 'votc_data'), { recursive: true, force: true });
        logSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    function seedProjection(): string {
        return seedProjectionWithId('projection-test-id');
    }

    async function parseWriteBack() {
        const logPath = path.join(USER_DATA_ROOT, 'debug.log');
        fs.writeFileSync(logPath, writeBackLog(), 'utf8');
        return parseLettersFromLog(
            logPath, makeGameData(), '1179.9.5', makeConfig(),
            String(PLAYER_ID), String(NPC_ID)
        );
    }

    it('links a player write-back reply to the unlinked incoming-letter projection', async () => {
        const projectionId = seedProjection();

        const letters = await parseWriteBack();

        expect(letters).toHaveLength(1);
        expect(letters[0].subject).toBe('letter_1');
        expect(letters[0].replyToId).toBe(projectionId);
    });

    it('keeps a spontaneous player letter unlinked when no unlinked root exists', async () => {
        // No projection seeded — the store has no NPC -> player root. Assert the
        // store really is empty so this case cannot pass for the wrong reason
        // (e.g. a leaked projection from the previous test).
        expect(LetterManager.getInstance().getAllLetters(String(PLAYER_ID))).toHaveLength(0);

        const letters = await parseWriteBack();

        expect(letters).toHaveLength(1);
        expect(letters[0].replyToId).toBeUndefined();
    });

    // §12.4.1a — deterministic reply-source marker. The mod appends
    // incoming_reply=<slot>|<type>|<deliveryId> to the VOTC:LETTER line; the
    // projection id built by IncomingLetterGenerator.saveHistory is
    // `${slotId}|${playerId}|${senderId}|${sentDate}|${type}|${deliveryId}`.
    function seedProjectionWithId(id: string, totalDays = 430583): string {
        const gameData = makeGameData();
        const player = gameData.characters.get(PLAYER_ID)!;
        const npc = gameData.characters.get(NPC_ID)!;
        // The base timestamp corresponds to totalDays 430583; shift it by the same
        // day-count so the stored letter's date stays consistent with its day.
        const timestamp = new Date(Date.UTC(1179, 8, 5, 12, 0, 0));
        timestamp.setUTCDate(timestamp.getUTCDate() + (totalDays - 430583));
        const projection = new LetterClass(
            id,
            npc,
            player,
            `incoming_${TOPIC}`,
            'A notice from the NPC.',
            LetterType.PERSONAL,
            timestamp,
            true,
            0,
            totalDays,
            undefined,
            'read',
            true
        );
        LetterManager.getInstance().saveLetter(projection, String(PLAYER_ID));
        return projection.id;
    }

    function writeBackLogWithMarker(marker: string): string {
        return [
            'noise line',
            `VOTC:LETTER/;/I write back to your letter./;/letter_1/;/430583/;/0/;/${marker}/;/`
        ].join('\r\n') + '\r\n';
    }

    async function parseLogContent(logContent: string) {
        const logPath = path.join(USER_DATA_ROOT, 'debug.log');
        fs.writeFileSync(logPath, logContent, 'utf8');
        return parseLettersFromLog(
            logPath, makeGameData(), '1179.9.5', makeConfig(),
            String(PLAYER_ID), String(NPC_ID)
        );
    }

    it('links via the reply marker to the OLDER projection when two unlinked roots share a sender', async () => {
        // Two unlinked incoming projections from the SAME sender, different
        // deliveryIds. The heuristic would pick the newest; the marker must
        // pick the exact (older) one — this proves determinism wins.
        const olderId = `incoming_letter_3|${PLAYER_ID}|${NPC_ID}|1100.2.1|${TOPIC}|7`;
        const newerId = `incoming_letter_3|${PLAYER_ID}|${NPC_ID}|1100.2.1|${TOPIC}|9`;
        seedProjectionWithId(olderId);
        seedProjectionWithId(newerId);

        const letters = await parseLogContent(writeBackLogWithMarker(`incoming_reply=3|${TOPIC}|7`));

        expect(letters).toHaveLength(1);
        expect(letters[0].replyToId).toBe(olderId);
    });

    it('falls back to the heuristic when the marker is malformed', async () => {
        const projectionId = seedProjectionWithId(`incoming_letter_3|${PLAYER_ID}|${NPC_ID}|1100.2.1|${TOPIC}|7`);

        const letters = await parseLogContent(writeBackLogWithMarker('incoming_reply=x|y'));

        expect(letters).toHaveLength(1);
        // Heuristic fallback: the only unlinked root is linked.
        expect(letters[0].replyToId).toBe(projectionId);
    });

    it('falls back to the heuristic when the marker matches no root', async () => {
        const projectionId = seedProjectionWithId(`incoming_letter_3|${PLAYER_ID}|${NPC_ID}|1100.2.1|${TOPIC}|7`);

        // Marker points at deliveryId 99 — no projection carries it.
        const letters = await parseLogContent(writeBackLogWithMarker(`incoming_reply=3|${TOPIC}|99`));

        expect(letters).toHaveLength(1);
        expect(letters[0].replyToId).toBe(projectionId);
    });

    it('leaves a spontaneous player letter unlinked when the only root is outside the reply window', async () => {
        // Regression (user report): an unlinked incoming root older than the
        // reply window must not absorb a brand-new spontaneous letter — the
        // player letter starts its own thread in the sidebar instead of
        // rendering as a reply. §15 Fix A floors the window at 30 days, so the
        // root must be older than 30 to fall outside it.
        seedProjectionWithId(`incoming_letter_3|${PLAYER_ID}|${NPC_ID}|1100.2.1|${TOPIC}|7`, 430583 - 45);

        const letters = await parseWriteBack();

        expect(letters).toHaveLength(1);
        expect(letters[0].replyToId).toBeUndefined();
    });

    it('still links a write-back sent exactly at the reply-window boundary', async () => {
        // Inclusive boundary: §15 Fix A floors the window at 30 days, so a
        // write-back exactly 30 days after the root is still inside it.
        const projectionId = seedProjectionWithId(`incoming_letter_3|${PLAYER_ID}|${NPC_ID}|1100.2.1|${TOPIC}|7`, 430583 - 30);

        const letters = await parseWriteBack();

        expect(letters).toHaveLength(1);
        expect(letters[0].replyToId).toBe(projectionId);
    });

    it('links via the reply marker even when the root is far outside the reply window', async () => {
        // The marker is authoritative: a matching root links regardless of age, so
        // the heuristic window must never gate the deterministic path.
        const olderId = `incoming_letter_3|${PLAYER_ID}|${NPC_ID}|1100.2.1|${TOPIC}|7`;
        seedProjectionWithId(olderId, 430583 - 60);

        const letters = await parseLogContent(writeBackLogWithMarker(`incoming_reply=3|${TOPIC}|7`));

        expect(letters).toHaveLength(1);
        expect(letters[0].replyToId).toBe(olderId);
    });
});
