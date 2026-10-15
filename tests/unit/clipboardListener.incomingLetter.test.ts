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

describe('incoming-letter log transport', () => {
    beforeEach(() => {
        readText.mockReset();
        writeText.mockReset();
        readText.mockReturnValue('');
    });

    it('reads the engine prefix, identity tail and CRLF without touching the clipboard', () => {
        const listener = new ClipboardListener();
        const handler = jest.fn();
        listener.on('VOTC:INCOMING_LETTER', handler);
        listener.readIncomingLetterLogLine('[12:34:56][D][effect.cpp:1]: VOTC:INCOMING_LETTER/;/clipboard/;/incoming_letter_3/;/rival_taunt/;/42/;/1001/;/2/;/1/;/11/;/22/;/33/;/44/;/1/;/1\r\n');
        expect(handler).toHaveBeenCalledWith('incoming_letter_3', 'rival_taunt', '42');
        expect(writeText).not.toHaveBeenCalled();
    });

    it('uses the log transport only while clipboard polling is stopped', () => {
        const listener = new ClipboardListener();
        const handler = jest.fn();
        listener.on('VOTC:INCOMING_LETTER', handler);
        const line = 'VOTC:INCOMING_LETTER/;/clipboard/;/incoming_letter_1/;/family_letter/;/43';
        listener.start();
        try {
            listener.readIncomingLetterLogLine(line);
            expect(handler).not.toHaveBeenCalled();
        } finally {
            listener.stop();
        }
        listener.readIncomingLetterLogLine(line);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('dispatches distinct slots without a shared keyword cooldown', () => {
        const listener = new ClipboardListener();
        const handler = jest.fn();
        listener.on('VOTC:INCOMING_LETTER', handler);
        for (let slot = 1; slot <= 8; slot++) {
            listener.readIncomingLetterLogLine(`VOTC:INCOMING_LETTER/;/clipboard/;/incoming_letter_${slot}/;/vassal_memorial/;/${slot}`);
        }
        expect(handler).toHaveBeenCalledTimes(8);
    });

    it('ignores context, diagnostics and malformed bridge payloads', () => {
        const listener = new ClipboardListener();
        const handler = jest.fn();
        listener.on('VOTC:INCOMING_LETTER', handler);
        for (const line of [
            'VOTC:INCOMING_LETTER/;/context/;/incoming_letter_1/;/vassal_memorial/;/1066.1.1/;/2002/;/43',
            'VOTC:INCOMING_LETTER/;/quarterly',
            'VOTC:INCOMING_LETTER/;/clipboard/;/incoming_letter_9/;/vassal_memorial/;/43',
            'VOTC:INCOMING_LETTER/;/clipboard/;/incoming_letter_1/;/vassal_memorial/;/not-a-number',
            'VOTC:INCOMING_LETTER/;/clipboard/;/incoming_letter_1/;/vassal_memorial/;/9007199254740992'
        ]) listener.readIncomingLetterLogLine(line);
        expect(handler).not.toHaveBeenCalled();
    });
});
