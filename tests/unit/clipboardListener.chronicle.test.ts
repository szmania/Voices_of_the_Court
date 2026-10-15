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
    test('uses the existing clipboard dispatcher while polling and restores the previous clipboard', () => {
        const listener = new ClipboardListener();
        listener.isListening = true;
        const receive = jest.fn();
        listener.on('VOTC:CHRONICLE_TICK', receive);
        const wire = `VOTC:CHRONICLE_TICK/;/${payload.join('/;/')}`;
        listener.readChronicleLogLine(wire);
        expect(receive).not.toHaveBeenCalled();
        (clipboard.readText as jest.Mock).mockReturnValue(wire);
        listener.readClipboard();
        expect(receive).toHaveBeenCalledTimes(1);
        expect(receive).toHaveBeenCalledWith(payload);
        expect(clipboard.writeText).toHaveBeenCalledWith('personal clipboard');
    });
});
