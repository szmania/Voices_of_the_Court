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
            // Arrange
            const mockedParseLog = jest.spyOn(parseLog, 'parseLog').mockResolvedValue(undefined);
            const letterManagerInstance = LetterManager.getInstance();

            _private_setCurrentTotalDays(1234); // Set known value
            const storedLetter = {
                letter: { id: '1' } as any,
                originalLetter: { id: '1' } as any,
                expectedDeliveryDay: 1230,
            };
            _private_getStoredLetters().set('1', storedLetter);

            // Act
            await checkAndDeliverLetters();

            // Assert
            expect(consoleWarnSpy).toHaveBeenCalledWith('Could not parse game data during letter delivery. Attempting to use cached data.');
            expect(consoleWarnSpy).toHaveBeenCalledWith('Could not parse game data during letter delivery. Using currentTotalDays fallback for date.');
            expect(letterManagerInstance.deliverLetter).not.toHaveBeenCalled(); // Should NOT be called due to early return

            mockedParseLog.mockRestore();
        });
    });

    describe('Task 10.3: Test GameData Caching', () => {
        it('should log cache usage and use currentTotalDays for date when parseLog fails but cache exists', async () => {
            // Arrange: Populate cache with GameData having date '888.1.1'
            const gameData = new GameData(['', 'player', '1', 'AI', '2', '888.1.1', '100', 'Test Scene', 'Test Location']);
            gameDataCache.setCachedGameData(gameData);

            const mockedParseLog = jest.spyOn(parseLog, 'parseLog').mockResolvedValue(undefined);
            const letterManagerInstance = LetterManager.getInstance();

            _private_setCurrentTotalDays(100); // Set known current total days
            const storedLetter = {
                letter: { id: '2' } as any,
                originalLetter: { id: '2' } as any,
                expectedDeliveryDay: 95, // Should be ready for delivery
            };
            _private_getStoredLetters().set('2', storedLetter);

            // Act
            await checkAndDeliverLetters();

            // Assert
            expect(consoleWarnSpy).toHaveBeenCalledWith('Could not parse game data during letter delivery. Attempting to use cached data.');
            expect(consoleWarnSpy).toHaveBeenCalledWith('Could not parse game data during letter delivery. Using currentTotalDays fallback for date.');
            
            expect(letterManagerInstance.deliverLetter).toHaveBeenCalled();
            const deliveredLetter = (letterManagerInstance.deliverLetter as jest.Mock).mock.calls[0][0];
            // Date should be based on currentTotalDays (100) = "0.04.10", NOT cached date '888.1.1'
            expect(deliveredLetter.date).toBe(totalDaysToDateString(100)); // "0.04.10"

            mockedParseLog.mockRestore();
        });
    });

    describe('Task 10.4: Test Cache Invalidation', () => {
        it('should clear cache when session player ID changes via updateCurrentDate', async () => {
            // Arrange: Populate cache
            const gameData = new GameData(['', 'player', '1', 'AI', '2', '888.1.1', '100', 'Test Scene', 'Test Location']);
            gameDataCache.setCachedGameData(gameData);
            expect(gameDataCache.getCachedGameData()).not.toBeNull();

            // Set initial player ID
            _private_setSessionPlayerId('player1');
            
            // Change session player ID (simulate different player loading save)
            _private_setSessionPlayerId('player2');

            // Simulate log processing that would trigger updateCurrentDate and check for player change
            // Use a date that will trigger the update (any non-zero date will work)
            const logLine = 'VOTC:DATE/;/2000';
            
            // Act: Process a log line that advances the date (this will call updateCurrentDate internally)
            await processLogLine(logLine);

            // Assert
            expect(gameDataCache.getCachedGameData()).toBeNull();
            expect(consoleLogSpy).toHaveBeenCalledWith('Player session changed from player1 to player2. Clearing cache.');
        });
    });
});