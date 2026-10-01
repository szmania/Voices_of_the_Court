import { ClipboardListener } from '../../src/main/ClipboardListener';

const readText = jest.fn();
const writeText = jest.fn();

jest.mock('electron', () => ({
    clipboard: {
        get readText() { return readText; },
        get writeText() { return writeText; }
    }
}));

function clipboardPayload(command: string, ...payloads: string[]): void {
    readText.mockReturnValue(['VOTC:' + command, ...payloads].join('/;/'));
}

describe('ClipboardListener INCOMING_LETTER command', () => {
    beforeEach(() => {
        readText.mockReset();
        writeText.mockReset();
        readText.mockReturnValue('');
    });

    it('emits slotId, type and deliveryId in the frozen payload order', () => {
        const listener = new ClipboardListener();
        const handler = jest.fn();
        listener.on('VOTC:INCOMING_LETTER', handler);

        clipboardPayload('');
        listener.readClipboard();
        clipboardPayload('INCOMING_LETTER', 'incoming_letter_3', 'rival_taunt', '42');
        listener.readClipboard();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith('incoming_letter_3', 'rival_taunt', '42');
    });

    it('does not emit for unrelated commands', () => {
        const listener = new ClipboardListener();
        const handler = jest.fn();
        listener.on('VOTC:INCOMING_LETTER', handler);

        clipboardPayload('');
        listener.readClipboard();
        clipboardPayload('LETTER');
        listener.readClipboard();

        expect(handler).not.toHaveBeenCalled();
    });
});
