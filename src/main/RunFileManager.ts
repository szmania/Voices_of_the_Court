import fs from 'fs';
import path from 'path';

// CK3 requires run files to be in UTF-8 BOM encoding, otherwise the script
// lexer may fail to parse effects that contain non-ASCII (e.g. Chinese)
// characters, resulting in actions never being executed.
const UTF8_BOM = '\uFEFF';

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

    // Reads the current content of the run file, stripping any leading BOM.
    private readCurrent(): string {
        if (!fs.existsSync(this.path)) {
            return '';
        }
        let text = fs.readFileSync(this.path, 'utf-8');
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.substring(1);
        }
        return text;
    }

    // Always writes content as UTF-8 with a BOM prefix (single BOM at the start).
    private writeUtf8Bom(content: string): void {
        fs.writeFileSync(this.path, UTF8_BOM + content, 'utf-8');
    }

    write(text: string): void {
        if (!this.path) {
            console.warn('RunFileManager: Cannot write - path is not configured.');
            return;
        }
        try {
            this.writeUtf8Bom(text);
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
            const currentText = this.readCurrent();
            const separator = currentText.trim() === '' ? '' : '\n';
            this.writeUtf8Bom(`${currentText}${separator}${text}`);
            console.log(`RunFileManager: Appended to run file ${this.path}: ${text}`);
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
