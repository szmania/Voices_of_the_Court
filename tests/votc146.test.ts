import { checkAndDeliverLetters, totalDaysToDateString, updateCurrentDate, processLogLine } from '../src/main/main';
import * as parseLog from '../src/shared/gameData/parseLog';
import { LetterManager } from '../src/main/letter/LetterManager';
import { GameData } from '../src/shared/gameData/GameData';
import * as gameDataCache from '../src/main/gameDataCache';
import { _private_setCurrentTotalDays, _private_getStoredLetters, _private_setLastLetterSentToGame, _private_setSessionPlayerId } from '../src/main/main';

jest.mock('../src/shared/gameData/parseLog');
jest.mock('../src/main/letter/LetterManager');

describe('VOTC-146: Game Data Parsing Fixes', () => {
    let consoleWarnSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        _private_getStoredLetters().clear();
        _private_setLastLetterSentToGame(null);
        gameDataCache.clearCachedGameData();
        jest.clearAllMocks();
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    describe('Task 10.2: Test currentTotalDays Fallback', () => {
        it('should log warnings and NOT call deliverLetter when parseLog fails and no cache', async () => {
            const mockedParseLog = jest.spyOn(parseLog, 'parseLog').mockResolvedValue(undefined);
            const letterManagerInstance = LetterManager.getInstance();

            _private_setCurrentTotalDays(1234);
            const storedLetter = {
                letter: { id: '1' } as any,
                originalLetter: { id: '1' } as any,
                expectedDeliveryDay: 1230,
            };
            _private_getStoredLetters().set('1', storedLetter);

            await checkAndDeliverLetters();

            expect(consoleWarnSpy).toHaveBeenCalledWith('Could not parse game data during letter delivery. Attempting to use cached data.');
            expect(consoleWarnSpy).toHaveBeenCalledWith('Could not parse game data during letter delivery. Using currentTotalDays fallback for date.');
            expect(letterManagerInstance.deliverLetter).not.toHaveBeenCalled();

            mockedParseLog.mockRestore();
        });
    });

    describe('Task 10.3: Test GameData Caching', () => {
        it('should log cache usage and use currentTotalDays for date when parseLog fails but cache exists', async () => {
            const gameData = new GameData(['', 'player', '1', 'AI', '2', '888.1.1', '100', 'Test Scene', 'Test Location']);
            gameDataCache.setCachedGameData(gameData);

            const mockedParseLog = jest.spyOn(parseLog, 'parseLog').mockResolvedValue(undefined);
            const letterManagerInstance = LetterManager.getInstance();

            _private_setCurrentTotalDays(100);
            const storedLetter = {
                letter: { id: '2' } as any,
                originalLetter: { id: '2' } as any,
                expectedDeliveryDay: 95,
            };
            _private_getStoredLetters().set('2', storedLetter);

            await checkAndDeliverLetters();

            expect(consoleWarnSpy).toHaveBeenCalledWith('Could not parse game data during letter delivery. Attempting to use cached data.');
            expect(consoleWarnSpy).toHaveBeenCalledWith('Could not parse game data during letter delivery. Using currentTotalDays fallback for date.');

            expect(letterManagerInstance.deliverLetter).toHaveBeenCalled();
            const deliveredLetter = (letterManagerInstance.deliverLetter as jest.Mock).mock.calls[0][0];
            expect(deliveredLetter.date).toBe(totalDaysToDateString(100));

            mockedParseLog.mockRestore();
        });
    });

    describe('Task 10.4: Test Cache Invalidation', () => {
        it('should clear cache when session player ID changes via updateCurrentDate', async () => {
            const gameData = new GameData(['', 'player', '1', 'AI', '2', '888.1.1', '100', 'Test Scene', 'Test Location']);
            gameDataCache.setCachedGameData(gameData);
            expect(gameDataCache.getCachedGameData()).not.toBeNull();

            _private_setSessionPlayerId('player1');
            _private_setSessionPlayerId('player2');

            const logLine = 'VOTC:DATE/;/2000';
            await processLogLine(logLine);

            expect(gameDataCache.getCachedGameData()).toBeNull();
            expect(consoleLogSpy).toHaveBeenCalledWith('Player session changed from player1 to player2. Clearing cache.');
        });
    });
});