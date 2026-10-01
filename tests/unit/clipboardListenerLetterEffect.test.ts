/**
 * Unit tests for the VOTC:LETTER_EFFECT_ACCEPTED clipboard keyword dispatch.
 *
 * The CK3 mod copies "VOTC:LETTER_EFFECT_ACCEPTED" to the clipboard (message_event.363)
 * after it executes run/votc_letter_actions.txt. ClipboardListener must recognize the
 * command and emit the event so main.ts can clear the run file deterministically
 * (mirroring VOTC:EFFECT_ACCEPTED for the conversation run file).
 */
jest.mock('electron', () => ({
    clipboard: {
        readText: jest.fn(),
        writeText: jest.fn(),
    },
}));

import { clipboard } from 'electron';
import { ClipboardListener } from '../../src/main/ClipboardListener';

const readTextMock = clipboard.readText as unknown as jest.Mock;
const writeTextMock = clipboard.writeText as unknown as jest.Mock;

describe('ClipboardListener: VOTC:LETTER_EFFECT_ACCEPTED dispatch', () => {
    beforeEach(() => {
        readTextMock.mockReset();
        writeTextMock.mockReset();
        // Default: empty clipboard. Individual tests queue values via mockReturnValueOnce.
        readTextMock.mockReturnValue('');
    });

    test('fires the emit exactly once when the keyword is on the clipboard', () => {
        readTextMock
            .mockReturnValueOnce('') // constructor read
            .mockReturnValueOnce('VOTC:LETTER_EFFECT_ACCEPTED'); // readClipboard read

        const listener = new ClipboardListener();
        const handler = jest.fn();
        listener.on('VOTC:LETTER_EFFECT_ACCEPTED', handler);

        listener.readClipboard();

        expect(handler).toHaveBeenCalledTimes(1);
        // Consuming a VOTC command restores the previous clipboard content.
        expect(writeTextMock).toHaveBeenCalledWith('');
    });

    test('does not fire for other VOTC commands', () => {
        readTextMock
            .mockReturnValueOnce('')
            .mockReturnValueOnce('VOTC:LETTER_ACCEPTED');

        const listener = new ClipboardListener();
        const handler = jest.fn();
        listener.on('VOTC:LETTER_EFFECT_ACCEPTED', handler);

        listener.readClipboard();

        expect(handler).not.toHaveBeenCalled();
    });
});