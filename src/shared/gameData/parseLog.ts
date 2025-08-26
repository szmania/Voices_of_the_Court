import { GameData, Memory, Trait, OpinionModifier, Secret} from "./GameData";
import { Character } from "./Character";
const fs = require('fs');

export async function parseLog(debugLogPath: string): Promise<GameData | undefined>{
    console.log(`Starting to parse log file at: ${debugLogPath}`);
    if (!fs.existsSync(debugLogPath)) {
        console.error(`Error: Log file not found at ${debugLogPath}`);
        return undefined;
    }

    let gameData: GameData | undefined = undefined;

    //some data are passed through multiple lines
    let multiLineTempStorage: any[] = [];
    let isWaitingForMultiLine: boolean = false;
    let multiLineType: string = ""; //relation or opinionModifier

    const fileContent = await fs.promises.readFile(debugLogPath, 'utf8');
    const lastInitIndex = fileContent.lastIndexOf('VOTC:IN/;/init');

    if (lastInitIndex === -1) {
        console.debug("Finished parsing log file, but 'VOTC:IN/;/init' was not found. No game data will be loaded.");
        return undefined;
    }

    // Find the start of the line containing the last VOTC:IN to get the whole block
    const lastBlockStartIndex = fileContent.lastIndexOf('\n', lastInitIndex) + 1;
    const relevantLogBlock = fileContent.substring(lastBlockStartIndex);
    const lines = relevantLogBlock.split(/\r?\n/);

    console.log(`Starting to parse last VOTC:IN block from log file: ${debugLogPath}`);

    for (const line of lines) {
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
                    console.log(`Parsed multi-line new_relation: "${value}"`);
                break;
                case "relations":
                    const relation = removeTooltip(value);
                    multiLineTempStorage.push(relation);
                    console.log(`Parsed multi-line relation: "${relation}"`);
                break;
                case "opinionBreakdown":
                        const opinionModifier = parseOpinionModifier(value);
                        multiLineTempStorage.push(opinionModifier);
                        console.log(`Parsed multi-line opinion breakdown: ${opinionModifier.reason}: ${opinionModifier.value}`);
                break;
            }

            if(line.includes('#ENDMULTILINE')){         
                console.log(`Finished parsing multi-line data of type "${multiLineType}".`);
                isWaitingForMultiLine = false;
            }
           continue;
        }

        if(line.includes("VOTC:IN")){
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
                    let trait = parseTrait(data);
                    gameData!.characters.get(rootID)!.traits.push(trait);
                    console.log(`Parsed trait for character ID ${rootID}: ${trait.name}`);
                break;
                case "opinions":
                    if (!gameData) continue;
                    gameData!.characters.get(rootID)!.opinions.push({id: Number(data[1]), opinon: Number(data[2])});
                    console.log(`Parsed opinion for character ID ${rootID}: targetID=${data[1]}, value=${data[2]}`);
                break;
                case "relations":
                    if (!gameData) continue;
                    if(line.split('#')[1] !== ''){
                        const relation = removeTooltip(line.split('#')[1]);
                        gameData!.characters.get(rootID)!.relationsToPlayer = [relation];
                        console.debug(`Parsed relation for character ID ${rootID} to player: "${relation}"`);
                    }
                    
                    if(!line.includes("#ENDMULTILINE")){
                        multiLineTempStorage = gameData!.characters.get(rootID)!.relationsToPlayer
                        isWaitingForMultiLine = true;
                        multiLineType = "relations";
                        console.debug(`Starting multi-line parse for "relations" for character ID ${rootID}.`);
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
                        console.debug(`Starting multi-line parse for "new_relations" for character ID ${rootID} to target ID ${tmpTargetId}.`);
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
                        console.debug(`Starting multi-line parse for "opinionBreakdown" for character ID ${rootID}.`);
                    }
            }
        } else {
            if (line.trim() !== "") {
                console.debug(`Skipping line (no VOTC:IN): ${line}`);
            }
        }
    }
    console.debug("Finished parsing log file. Game data loaded from last block.");

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

    console.debug("Finished parsing log. Final GameData object:", gameData!);
    return gameData!;
}


export function removeTooltip(str: string): string{
    let cleanedStr = str;
    // Step 1: Remove UI Directives
    cleanedStr = cleanedStr.replace(/(ONCLICK|TOOLTIP):\S+\s*/g, '');

    // Step 2: Remove Prefixes
    cleanedStr = cleanedStr.replace(/^\s*([A-Z][\s;]\s*)+/, '');

    // Step 3: Remove Suffixes
    cleanedStr = cleanedStr.replace(/[\s!]+$/, '');

    // Step 4: Final Trim
    return cleanedStr.replace(/^\s+|\s+$/g, '');
}
