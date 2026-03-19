import fs from 'fs';
import path from 'path';

export class RunFileManager {
    private path: string;

    constructor(userFolderPath: string) {
        if (!userFolderPath) {
            console.error("RunFileManager error: userFolderPath is not provided. Run file operations will be disabled.");
            this.path = ''; 
            return;
        }
        this.path = path.join(userFolderPath, "run", "votc.txt");
        console.log(`RunFileManager initialized. File path: ${this.path}`);
        this.createRunFolder(userFolderPath);
    }

    write(text: string): void {
        if (!this.path) {
            console.warn('RunFileManager: Cannot write - path is not configured.');
            return;
        }
        try {
            let currentText = '';
            if (fs.existsSync(this.path)) {
                currentText = fs.readFileSync(this.path, 'utf-8');
            }

            if (currentText.trim() === '') {
                console.log(`RunFileManager: Run file is empty - writing new effect.`);
                fs.writeFileSync(this.path, `${text}\n          
            trigger_event = mcc_event_v2.9003`, 'utf-8');
            } else {
                console.log(`RunFileManager: Run file is not empty - prepending new effect.`);
                fs.writeFileSync(this.path, `${text}\n${currentText}`, 'utf-8');
            }
            console.log(`RunFileManager: Wrote to run file: ${text}`);
        } catch (error) {
            console.error(`RunFileManager: Failed to write to file ${this.path}:`, error);
        }
    }

    append(text: string): void {
        if (!this.path) {
            console.warn('RunFileManager: Cannot append - path is not configured.');
            return;
        }
        try {
            fs.appendFileSync(this.path, `\n${text}`, 'utf-8');
            console.log(`RunFileManager: Appended to run file: ${text}`);
        } catch (error) {
            console.error(`RunFileManager: Failed to append to file ${this.path}:`, error);
        }
    }

    clear(): void {
        if (!this.path) {
            console.warn('RunFileManager: Cannot clear - path is not configured.');
            return;
        }
        try {
            fs.writeFileSync(this.path, "", 'utf-8');
            console.log("RunFileManager: Run file cleared.");
        } catch (error) {
            console.error(`RunFileManager: Failed to clear file ${this.path}:`, error);
        }
    }

    private createRunFolder(userFolderPath: string): void {
        const runFolderPath = path.join(userFolderPath, "run");
        if (!fs.existsSync(runFolderPath)) {
            try {
                fs.mkdirSync(runFolderPath, { recursive: true });
                console.log(`Created run folder at: ${runFolderPath}`);
            } catch (err) {
                console.error("RunFileManager error creating run folder: " + err);
            }
        }
    }
}
