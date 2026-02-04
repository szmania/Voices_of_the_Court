import fs from 'fs';
import path from 'path';

export class RunFileManager{
    path: string;

    constructor(userFolderPath: string){
        this.path = path.join(userFolderPath, "run", "votc.txt");
        console.log(`RunFileManager initialized. File path: ${this.path}`);

        this.createRunFolder(userFolderPath);
    }

    write(text: string): void{
        fs.writeFileSync(this.path, text);
    
        console.log("Wrote to run file: "+text)
    }

    append(text: string): void{
        fs.appendFileSync(this.path, text)
        console.log("Appended to run file: "+text)
    }
    
    clear(): void{
        fs.writeFileSync(this.path, "");
        console.log("Run File cleared")
    }
    
    createRunFolder(userFolderPath: string){
        const runFolderPath = path.join(userFolderPath, "run");
        if(userFolderPath && !fs.existsSync(runFolderPath)){
            try{
                fs.mkdirSync(runFolderPath);
                console.log(`Created run folder at: ${runFolderPath}`);
            }
            catch(err){
                console.error("RunFileManager error creating run folder: "+err)
            }
            
        }
    }
}
