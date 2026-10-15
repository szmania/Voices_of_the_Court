import {clipboard} from "electron";
import {EventEmitter} from 'events';

export class ClipboardListener extends EventEmitter{
    previousClipboard: string;
    isListening: boolean;
    interval: any;

    constructor(){
        super();
        let clipboardText = clipboard.readText();
        if(clipboardText.startsWith('VOTC:')){
            clipboard.writeText('');
            this.previousClipboard = '';
        }
        else{
            this.previousClipboard = clipboardText;
        }

        this.isListening = false;
        console.log('ClipboardListener initialized.');
    }

    start(){
        if(this.isListening){
            throw new Error('ClipboardListener is already listening!');
        }
        this.interval = setInterval(this.readClipboard.bind(this), 100);
        this.isListening = true;
        console.log('ClipboardListener started.');
    }

    stop(){
        if(!this.isListening){
            throw new Error('ClipboardListener is not currently listening!');
        }

        clearInterval(this.interval);
        this.isListening = false;
        console.log('ClipboardListener stopped.');
    }

    // The upstream settings can stop clipboard polling. Route this bridge
    // through the same event handler while that transport is disabled.
    readIncomingLetterLogLine(line: string): void {
        if (this.isListening) return;
        const marker = 'VOTC:INCOMING_LETTER/;/clipboard/;/';
        const offset = line.indexOf(marker);
        if (offset === -1) return;
        const [slotId, type, deliveryId] = line.slice(offset + marker.length)
            .split('/;/').map(segment => segment.trim());
        if (!/^incoming_letter_[1-8]$/.test(slotId ?? '')
            || !/^[a-z_]+$/.test(type ?? '')
            || !/^\d+$/.test(deliveryId ?? '')
            || !Number.isSafeInteger(Number(deliveryId))) return;
        this.emit('VOTC:INCOMING_LETTER', slotId, type, deliveryId);
    }

    readChronicleLogLine(line: string): void {
        if (this.isListening) return;
        const match = /VOTC:(CHRONICLE_TICK|CHRONICLE_MANAGER)\/;\/(.*)/.exec(line.replace(/\r$/, ''));
        if (match) this.emit(`VOTC:${match[1]}`, match[2].split('/;/'));
    }

    readClipboard(){
        let currentClipboard = clipboard.readText();
        if(this.previousClipboard == currentClipboard) return;

        if(currentClipboard.startsWith('VOTC:')){
            // Mirror the 1.x listener: everything after "VOTC:<COMMAND>" is a
            // "/;/"-separated payload (manager window contexts, letter slots,
            // battle ids...). Handlers that do not need payloads simply ignore
            // the extra argument.
            const segments = currentClipboard.slice('VOTC:'.length).split('/;/');
            const command = segments[0].trim();
            const payloads = segments.slice(1).map(s => s.trim());
            console.log(`VOTC command detected: ${command}`);
            switch (command){
                case "IN":
                    this.emit('VOTC:IN');
                break;
                case "EFFECT_ACCEPTED":
                    this.emit('VOTC:EFFECT_ACCEPTED');
                break;
                case "BOOKMARK":
                    this.emit('VOTC:BOOKMARK');
                    break;
                case "SUMMARY_MANAGER":
                    this.emit('VOTC:SUMMARY_MANAGER', payloads);
                break;
                case "CONVERSATION_HISTORY":
                    this.emit('VOTC:CONVERSATION_HISTORY', payloads);
                break;
                case "CHRONICLE_TICK":
                case "CHRONICLE_MANAGER":
                    this.emit(`VOTC:${command}`, payloads);
                break;
                case "LETTER":
                    this.emit('VOTC:LETTER');
                break;
                case "LETTER_ACCEPTED":
                    this.emit('VOTC:LETTER_ACCEPTED');
                    break;
                case "LETTER_EFFECT_ACCEPTED":
                    this.emit('VOTC:LETTER_EFFECT_ACCEPTED');
                    break;
                case "INCOMING_LETTER":
                    // Payload order matches the mod-side clipboard_codes bridge
                    // keys: slotId, type, deliveryId. The trailing campaign
                    // identity segments of the wire payload are ignored here;
                    // the main.ts handler re-validates all three arguments.
                    this.emit(
                        'VOTC:INCOMING_LETTER',
                        payloads[0],
                        payloads[1],
                        payloads[2]
                    );
                break;
            }


            clipboard.writeText(this.previousClipboard);
        }
        else{
            this.previousClipboard = clipboard.readText();
        }
    }
}
