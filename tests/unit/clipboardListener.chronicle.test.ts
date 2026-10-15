jest.mock('electron', () => ({ clipboard: { readText: jest.fn(), writeText: jest.fn() } }));
import { clipboard } from 'electron';
import { ClipboardListener } from '../../src/main/ClipboardListener';
import { parseChronicleClipboardPayload } from '../../src/main/chronicle/chronicleClipboardPayload';

const payload = ['1001', '2', 'Player', '11', '22', '0', '0', '42', '0', '2', '1', '1', '2', '3', '4', '1', '1', 'manual', '388798', '1066', '1', '1', '1', 'Duchy', '123'];

describe('chronicle clipboard and debug-log transports', () => {
    beforeEach(() => { jest.clearAllMocks(); (clipboard.readText as jest.Mock).mockReturnValue('personal clipboard'); });
    test('reads all payload fields behind an engine prefix and CRLF when polling is stopped', () => {
        const listener = new ClipboardListener();
        const receive = jest.fn();
        listener.on('VOTC:CHRONICLE_MANAGER', receive);
        listener.readChronicleLogLine(`[12:34:56][D][effect.cpp:1]: VOTC:CHRONICLE_MANAGER/;/${payload.join('/;/')}\r`);
        expect(receive).toHaveBeenCalledWith(payload);
        expect(parseChronicleClipboardPayload(receive.mock.calls[0][0]).status).toBe('valid');
        expect(clipboard.writeText).not.toHaveBeenCalled();
        listener.readChronicleLogLine('VOTC:CHRONICLE_MEMORY/;/start/;/123');
        expect(receive).toHaveBeenCalledTimes(1);
    });
    test('handles the log while clipboard polling is enabled and deduplicates the clipboard copy', () => {
        const listener = new ClipboardListener();
        listener.isListening = true;
        const receive = jest.fn();
        listener.on('VOTC:CHRONICLE_TICK', receive);
        const wire = `VOTC:CHRONICLE_TICK/;/${payload.join('/;/')}`;
        listener.readChronicleLogLine(wire);
        expect(receive).toHaveBeenCalledTimes(1);
        (clipboard.readText as jest.Mock).mockReturnValue(wire);
        listener.readClipboard();
        expect(receive).toHaveBeenCalledTimes(1);
        expect(receive).toHaveBeenCalledWith(payload);
        expect(clipboard.writeText).toHaveBeenCalledWith('personal clipboard');
    });

    test('deduplicates a log copy that arrives after the clipboard', () => {
        const listener = new ClipboardListener();
        const receive = jest.fn();
        listener.on('VOTC:CHRONICLE_MANAGER', receive);
        const wire = `VOTC:CHRONICLE_MANAGER/;/${payload.join('/;/')}`;
        (clipboard.readText as jest.Mock).mockReturnValue(wire);
        listener.readClipboard();
        listener.readChronicleLogLine(`[12:34:56][D][effect.cpp:1]: ${wire}\r`);
        expect(receive).toHaveBeenCalledTimes(1);
    });

    test('does not let a malformed event copy suppress a repaired request', () => {
        const listener = new ClipboardListener();
        const receive = jest.fn();
        listener.on('VOTC:CHRONICLE_MANAGER', receive);
        const broken = [...payload];
        broken[17] = '';
        broken[22] = '';
        broken[24] = '';
        listener.readChronicleLogLine(`VOTC:CHRONICLE_MANAGER/;/${broken.join('/;/')}`);
        listener.readChronicleLogLine(`VOTC:CHRONICLE_MANAGER/;/${payload.join('/;/')}`);
        expect(receive).toHaveBeenCalledTimes(2);
        expect(parseChronicleClipboardPayload(receive.mock.calls[0][0])).toMatchObject({ status: 'invalid', reason: 'missing signal kind' });
        expect(parseChronicleClipboardPayload(receive.mock.calls[1][0]).status).toBe('valid');
    });

    test('keeps different campaigns and pulse kinds distinct even if request ids coincide', () => {
        const listener = new ClipboardListener();
        const receive = jest.fn();
        listener.on('VOTC:CHRONICLE_TICK', receive);
        const first = [...payload];
        first[17] = 'quarterly';
        const yearly = [...first];
        yearly[17] = 'yearly';
        const otherCampaign = [...first];
        otherCampaign[11] = '999';
        for (const fields of [first, yearly, otherCampaign, first]) {
            listener.readChronicleLogLine(`VOTC:CHRONICLE_TICK/;/${fields.join('/;/')}`);
        }
        expect(receive).toHaveBeenCalledTimes(3);
    });

    test('keeps timeline contexts distinct while ignoring display-text differences', () => {
        const listener = new ClipboardListener();
        const receive = jest.fn();
        listener.on('VOTC:CHRONICLE_MANAGER', receive);
        const renamed = [...payload];
        renamed[2] = 'A different display name';
        renamed[23] = 'A different title';
        const otherNode = [...payload];
        otherNode[3] = '333';
        for (const fields of [payload, renamed, otherNode]) {
            listener.readChronicleLogLine(`VOTC:CHRONICLE_MANAGER/;/${fields.join('/;/')}`);
        }
        expect(receive).toHaveBeenCalledTimes(2);
    });

    test('expires transport deduplication so an old request can be used after reloading a save', () => {
        const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
        try {
            const listener = new ClipboardListener();
            const receive = jest.fn();
            listener.on('VOTC:CHRONICLE_MANAGER', receive);
            const wire = `VOTC:CHRONICLE_MANAGER/;/${payload.join('/;/')}`;
            listener.readChronicleLogLine(wire);
            listener.readChronicleLogLine(wire);
            now.mockReturnValue(31000);
            listener.readChronicleLogLine(wire);
            expect(receive).toHaveBeenCalledTimes(2);
        } finally {
            now.mockRestore();
        }
    });
});
