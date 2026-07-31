
import { checkAndDeliverLetters, _private_setCurrentTotalDays, _private_getStoredLetters, _private_setLastLetterSentToGame, totalDaysToDateString } from '../src/main/main';
import * as parseLog from '../src/shared/gameData/parseLog';
import { LetterManager } from '../src/main/letter/LetterManager';
import { StoredLetter } from '../src/main/letter/letterInterfaces';

jest.mock('../src/shared/gameData/parseLog');
jest.mock('../src/main/letter/LetterManager');

describe('checkAndDeliverLetters', () => {
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        _private_getStoredLetters().clear();
        _private_setLastLetterSentToGame(null);
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
    });

    it('should log a warning and use currentTotalDays when parseLog fails', async () => {
        // Arrange
        const mockedParseLog = jest.spyOn(parseLog, 'parseLog').mockResolvedValue(undefined);
        const letterManagerInstance = LetterManager.getInstance();
        
        _private_setCurrentTotalDays(100);

        const storedLetter: StoredLetter = {
            letter: { id: '1' } as any,
            expectedDeliveryDay: 90,
        };
        _private_getStoredLetters().set('1', storedLetter);

        // Act
        await checkAndDeliverLetters();

        // Assert
        expect(consoleWarnSpy).toHaveBeenCalledWith('Could not parse game data during letter delivery. Using currentTotalDays fallback for date.');
        expect(letterManagerInstance.deliverLetter).toHaveBeenCalled();
        
        mockedParseLog.mockRestore();
    });
});