import { GameData, Memory, Trait, OpinionModifier, Secret} from "./GameData";
import { Character } from "./Character";
const fs = require('fs');
const readline = require('readline');

export async function parseLog(debugLogPath: string): Promise<GameData | undefined>{
    console.log(`Starting to parse log file at: ${debugLogPath}`);
    if (!fs.existsSync(debugLogPath)) {
        console.log(`Error: Log file not found at ${debugLogPath}`);
        return undefined;
    }

    let gameData: GameData | undefined = undefined;
    let foundVotcIn = false;

    //some data are passed through multiple lines
    let multiLineTempStorage: any[] = [];
    let isWaitingForMultiLine: boolean = false;
    let multiLineType: string = ""; //relation or opinionModifier

    const fileStream = fs.createReadStream(debugLogPath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    console.log(`Starting to parse log file: ${debugLogPath}`);

    for await (const line of rl) {
        if(isWaitingForMultiLine){
            if (!gameData) continue; // Should not happen if logic is correct, but good for safety
            console.log(`Parsing multi-line data of type "${multiLineType}": ${line}`);
            let value = line.split('#')[0]
            switch (multiLineType){
                case "new_relations":
                    value = removeTooltip(value)
                    // if (value.includes("your")) {

                    //     value = value.replace("your", gameData.playerName+"'s");
                    // }
                    multiLineTempStorage.push(value)
                break;
                case "relations":
                    multiLineTempStorage.push(removeTooltip(value))
                break;
                case "opinionBreakdown":
                        multiLineTempStorage.push(parseOpinionModifier(value));
                break;
            }

            if(line.includes('#ENDMULTILINE')){         
                console.log(`Finished parsing multi-line data of type "${multiLineType}".`);
                isWaitingForMultiLine = false;
            }
           continue;
        }

        if(line.includes("VOTC:IN")){
            if (!foundVotcIn) {
                console.log(`Found VOTC:IN line: ${line}`);
                foundVotcIn = true;
            }
            //0: VOTC:IN, 1: dataType, 3: rootID 4...: data
            let data = line.split("/;/")

            const dataType = data[1];
            console.log(`Parsing data type: ${dataType}`);

            data.splice(0,2)

            const rootID = Number(data[0]);

            console.log(`Processing data for rootID: ${rootID}`);

            for(let i=0;i<data.length;i++){
                data[i] = removeTooltip(data[i])
            }

            switch (dataType){
                case "init":
                    gameData = new GameData(data);
                    console.log('Initialized GameData.');
                break;
                case "character": 
                    if (!gameData) continue;
                    let char = new Character(data);
                    gameData!.characters.set(char.id, char);
                    console.log(`Parsed character: ID=${char.id}, Name=${char.fullName}`);
                break;
                case "memory": 
                    if (!gameData) continue;
                    let memory = parseMemory(data)
                    gameData!.characters.get(rootID)!.memories.push(memory);
                    console.log(`Parsed memory for character ID ${rootID}: ${memory.desc}`);
                break;
                case "secret": 
                    if (!gameData) continue;
                    let secret = parseSecret(data)
                    gameData!.characters.get(rootID)!.secrets.push(secret);
                    console.log(`Parsed secret for character ID ${rootID}: ${secret.name}`);
                break;
                case "trait":
                    if (!gameData) continue;
                    gameData.characters.get(rootID)!.traits.push(parseTrait(data));
                break;
                case "opinions":
                    if (!gameData) continue;
                    gameData!.characters.get(rootID)!.opinions.push({id: Number(data[1]), opinon: Number(data[2])});
                    console.log(`Parsed opinion for character ID ${rootID}: targetID=${data[1]}, value=${data[2]}`);
                break;
                case "relations":
                    if (!gameData) continue;
                    if(line.split('#')[1] !== ''){
                        gameData!.characters.get(rootID)!.relationsToPlayer = [removeTooltip(line.split('#')[1])]
                    }
                    
                    if(!line.includes("#ENDMULTILINE")){
                        multiLineTempStorage = gameData!.characters.get(rootID)!.relationsToPlayer
                        isWaitingForMultiLine = true;
                        multiLineType = "relations";
                        console.log(`Starting multi-line parse for "relations" for character ID ${rootID}.`);
                    }
                break;
                case "new_relations":
                    if (!gameData) continue;
                    var tmpTargetId = Number(data[1])
                    if(line.split('#')[1] !== ''){

                        gameData!.characters.get(rootID)!.relationsToCharacters.push({id: tmpTargetId, relations: [removeTooltip(line.split('#')[1])]})
                        //gameData!.characters.get(rootID)!.relationsToPlayer = [removeTooltip(line.split('#')[1])]
                    }

                    if(!line.includes("#ENDMULTILINE")){
                        multiLineTempStorage = gameData!.characters.get(rootID)!.relationsToCharacters.find(x => x.id == tmpTargetId)!.relations
                        isWaitingForMultiLine = true;
                        multiLineType = "new_relations";
                        console.log(`Starting multi-line parse for "new_relations" for character ID ${rootID} to target ID ${tmpTargetId}.`);
                    }
                    break;

                case "opinionBreakdown":
                    if(line.split('#')[1] !== ''){
                        gameData!.characters.get(rootID)!.opinionBreakdownToPlayer = [parseOpinionModifier(line.split('#')[1])]
                    }
                    
                    if(!line.includes("#ENDMULTILINE")){
                        multiLineTempStorage = gameData!.characters.get(rootID)!.opinionBreakdownToPlayer
                        isWaitingForMultiLine = true;
                        multiLineType = "opinionBreakdown";
                        console.log(`Starting multi-line parse for "opinionBreakdown" for character ID ${rootID}.`);
                    }
            }
        } else {
            if (line.trim() !== "") {
                console.log(`Skipping line (no VOTC:IN): ${line}`);
            }
        }
    }
    if (!foundVotcIn) {
        console.log("Finished parsing log file, but 'VOTC:IN' was not found. No game data will be loaded.");
    } else {
        console.log("Finished parsing log file. Game data loaded.");
    }
    
    function parseMemory(data: string[]): Memory{
        return {
            type: data[1],
            creationDate: data[2],
            desc: data[3],
            relevanceWeight: Number(data[4])
        }
    }

    function parseSecret(data: string[]): Secret{
        return {
            name: data[1],
            desc: data[2],
            category: data[3],
        }
    }

    
    function parseTrait(data: string[]): Trait{
        return {
            category: data[1],
            name: data[2],
            desc: data[3],
        }
    }

    function parseOpinionModifier(line: string): OpinionModifier{
        line = line.replace(/ *\([^)]*\) */g, "");

        let splits = line.split(": ");

        for(let i=0;i<splits.length;i++){
            splits[i] = removeTooltip(splits[i])
        }
  
        return {
            reason: splits[0],
            value: Number(splits[1])
        }
    }

    console.log("Finished parsing log. Final GameData object:", gameData!);
    return gameData!;
}


export function removeTooltip(str: string): string{
    let newWords: string[] = []
    str.split(" ").forEach( (word) =>{
        if(word.includes('')){
            newWords.push(word.split('')[0])
        }else{
            newWords.push(word)
        }
    })

    return newWords.join(' ').replace(/ +(?= )/g,'').trim();
}
