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

    /**
     * Validates the three incoming-letter bridge fields shared by the clipboard
     * and log transports: slotId, type and deliveryId. Returns the trimmed
     * triple when every field is well-formed, undefined otherwise, so a
     * malformed or payload-less token never reaches the main.ts handler as
     * undefined arguments.
     */
    private parseIncomingLetterPayload(payloads: string[]): { slotId: string; type: string; deliveryId: string } | undefined {
        const [slotId, type, deliveryId] = payloads;
        if (!/^incoming_letter_[1-8]$/.test(slotId ?? '')
            || !/^[a-z_]+$/.test(type ?? '')
            || !/^\d+$/.test(deliveryId ?? '')
            || !Number.isSafeInteger(Number(deliveryId))) return undefined;
        return { slotId, type, deliveryId };
    }

    // The upstream settings can stop clipboard polling. Route this bridge
    // through the same event handler while that transport is disabled.
    readIncomingLetterLogLine(line: string): void {
        if (this.isListening) return;
        const marker = 'VOTC:INCOMING_LETTER/;/clipboard/;/';
        const offset = line.indexOf(marker);
        if (offset === -1) return;
        const payload = this.parseIncomingLetterPayload(
            line.slice(offset + marker.length).split('/;/').map(segment => segment.trim())
        );
        if (!payload) return;
        this.emit('VOTC:INCOMING_LETTER', payload.slotId, payload.type, payload.deliveryId);
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
                case "LETTER":
                    this.emit('VOTC:LETTER');
                    break;
                case "WHISPER":
                    // Whisper Ledger (VOTC-195, protocol v2): the mod's token
                    // window copies the literal 'VOTC:WHISPER' (loc key
                    // votc_whisper_token_letter) — a DEDICATED token, no longer
                    // the letter token. Routed to its own handler in main.ts.
                    this.emit('VOTC:WHISPER');
                    break;
                case "LETTER_ACCEPTED":
                    this.emit('VOTC:LETTER_ACCEPTED');
                    break;
                case "LETTER_EFFECT_ACCEPTED":
                    this.emit('VOTC:LETTER_EFFECT_ACCEPTED');
                    break;
                case "INCOMING_LETTER": {
                    // Payload order matches the mod-side clipboard_codes bridge
                    // keys: slotId, type, deliveryId. The trailing campaign
                    // identity segments of the wire payload are ignored here.
                    // A bare 'VOTC:INCOMING_LETTER' token carries no payload at
                    // all, so validate before emitting: undefined arguments
                    // would only surface as an error log in the main.ts handler.
                    const payload = this.parseIncomingLetterPayload(payloads);
                    if (!payload) {
                        console.warn(`Ignoring malformed VOTC:INCOMING_LETTER clipboard content: ${currentClipboard.replace(/[\r\n]+/g, ' ').slice(0, 200)}`);
                        break;
                    }
                    this.emit('VOTC:INCOMING_LETTER', payload.slotId, payload.type, payload.deliveryId);
                    break;
                }
            }


            clipboard.writeText(this.previousClipboard);
        }
        else{
            this.previousClipboard = clipboard.readText();
        }
    }
}
