const { checkAndDeliverLetters, _private_setCurrentTotalDays, _private_getStoredLetters, _private_setLastLetterSentToGame, totalDaysToDateString, _private_setSessionPlayerId } = require('../src/main/main');
const parseLog = require('../src/shared/gameData/parseLog');
const { LetterManager } = require('../src/main/letter/LetterManager');
const { GameData } = require('../src/shared/gameData/GameData');
const gameDataCache = require('../src/main/gameDataCache');

jest.mock('../src/shared/gameData/parseLog');
jest.mock('../src/main/letter/LetterManager');

describe('VOTC-146: Game Data Parsing Fixes', () => {
    let consoleWarnSpy;
    let consoleLogSpy;

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

    // Test for Task 10.1 is implicit in the other tests

    describe('Task 10.2: Test currentTotalDays Fallback', () => {
        it('10.2.1, 10.2.2, 10.2.3: should use currentTotalDays and log warning when parseLog fails', async () => {
            const mockedParseLog = jest.spyOn(parseLog, 'parseLog').mockResolvedValue(undefined);
            const letterManagerInstance = LetterManager.getInstance();

            _private_setCurrentTotalDays(1234);
            const storedLetter = {
                letter: { id: '1', date: '' },
                expectedDeliveryDay: 1230,
            };
            _private_getStoredLetters().set('1', storedLetter);

            await checkAndDeliverLetters();

            expect(consoleWarnSpy).toHaveBeenCalledWith('Could not parse game data during letter delivery. Using currentTotalDays fallback for date.');
            expect(letterManagerInstance.deliverLetter).toHaveBeenCalled();
            const deliveredLetter = letterManagerInstance.deliverLetter.mock.calls[0][0];
            expect(deliveredLetter.date).toBe(totalDaysToDateString(1234));

            mockedParseLog.mockRestore();
        });
    });

    describe('Task 10.3: Test GameData Caching', () => {
        it('10.3.1, 10.3.2, 10.3.3: should use cached GameData when parseLog fails', async () => {
            // 10.3.1: Populate the cache
            const gameData = new GameData(['', 'player', '1', 'AI', '2', '888.1.1', '100', 'Test Scene', 'Test Location']);
            gameDataCache.setCachedGameData(gameData);

            // 10.3.2: Activate the parseLog mock
            const mockedParseLog = jest.spyOn(parseLog, 'parseLog').mockResolvedValue(undefined);
            const letterManagerInstance = LetterManager.getInstance();

            _private_setCurrentTotalDays(100);
            const storedLetter = {
                letter: { id: '2', date: '' },
                expectedDeliveryDay: 95,
            };
            _private_getStoredLetters().set('2', storedLetter);

            await checkAndDeliverLetters();

            expect(consoleLogSpy).toHaveBeenCalledWith('Using cached GameData due to parsing failure.');
            expect(letterManagerInstance.deliverLetter).toHaveBeenCalled();
            const deliveredLetter = letterManagerInstance.deliverLetter.mock.calls[0][0];
            expect(deliveredLetter.date).toBe('888.1.1');

            mockedParseLog.mockRestore();
        });
    });

    describe('Task 10.4: Test Cache Invalidation', () => {
        it('10.4.1, 10.4.2, 10.4.3: should clear cache when session player ID changes', async () => {
            // 10.4.1: Populate the cache
            const gameData = new GameData(['', 'player', '1', 'AI', '2', '888.1.1', '100', 'Test Scene', 'Test Location']);
            gameDataCache.setCachedGameData(gameData);
            expect(gameDataCache.getCachedGameData()).not.toBeNull();

            // 10.4.2: Simulate a change in currentSessionPlayerId
            _private_setSessionPlayerId('player2');

            // 10.4.3: Verify that the cache is cleared
            const mockedParseLog = jest.spyOn(parseLog, 'parseLog').mockResolvedValue(undefined);

            await checkAndDeliverLetters();

            expect(gameDataCache.getCachedGameData()).toBeNull();
            expect(consoleLogSpy).toHaveBeenCalledWith('GameData cache cleared due to session player change.');

            mockedParseLog.mockRestore();
        });
    });
});