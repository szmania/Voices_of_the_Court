import { parseLog } from '../../../src/shared/gameData/parseLog';
import { GameData } from '../../../src/shared/gameData/GameData';
import path from 'path';

const FIXTURE_MARKER = path.join(__dirname, '..', '..', 'fixtures', 'debuglog_ai_initiate.txt');
const FIXTURE_BAD = path.join(__dirname, '..', '..', 'fixtures', 'debuglog_ai_initiate_bad.txt');
const FIXTURE_NONE = path.join(__dirname, '..', '..', 'fixtures', 'debuglog_ai_initiate_none.txt');

// The parser logs a lot; keep the test output readable.
let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
});

afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
});

describe('ai_speaks_first marker parsing', () => {
    it('sets aiInitiatorId from the marker (T.1)', async () => {
        const gd = await parseLog(FIXTURE_MARKER);
        expect(gd).toBeDefined();
        expect(gd!.aiInitiatorId).toBe(2000);
    });

    it('leaves aiInitiatorId undefined without the marker (T.2)', async () => {
        const gd = await parseLog(FIXTURE_NONE);
        expect(gd).toBeDefined();
        expect(gd!.aiInitiatorId).toBeUndefined();
    });

    it('ignores a malformed (non-numeric) id (T.3)', async () => {
        const gd = await parseLog(FIXTURE_BAD);
        expect(gd).toBeDefined();
        expect(gd!.aiInitiatorId).toBeUndefined();
    });
});

describe('GameData.aiInitiatorId serialization', () => {
    it('survives the IPC round trip through fromPlainObject (T.4)', () => {
        const plain = { playerID: 1, aiID: 2, aiInitiatorId: 7 };
        const gd = GameData.fromPlainObject(plain);
        expect(gd.aiInitiatorId).toBe(7);
    });

    it('stays undefined for player-initiated conversations', () => {
        const gd = GameData.fromPlainObject({ playerID: 1, aiID: 2 });
        expect(gd.aiInitiatorId).toBeUndefined();
    });
});