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
            const payloads = segments.slice(1).map(s => s?.trim());
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
                case "LETTER_ACCEPTED":
                    this.emit('VOTC:LETTER_ACCEPTED');
                break;
            }


            clipboard.writeText(this.previousClipboard);
        }
        else{
            this.previousClipboard = clipboard.readText();
        }
    }
}

