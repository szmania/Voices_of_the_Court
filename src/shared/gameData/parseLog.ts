import { GameData, Memory, Trait, OpinionModifier, Secret} from "./GameData";
import { Character } from "./Character";
const fs = require('fs');

export async function parseLog(debugLogPath: string): Promise<GameData | undefined>{
async function readLastRelevantBlock(filePath: string): Promise<string | undefined> {
    const CHUNK_SIZE = 256 * 1024; // 256KB chunks
    const SEARCH_STRING = 'VOTC:IN/;/init';

    let handle;
    try {
        handle = await fs.promises.open(filePath, 'r');
        const { size } = await handle.stat();

        let position = Math.max(0, size - CHUNK_SIZE);
        let currentReadSize = size - position;

        while (true) {
            const buffer = Buffer.alloc(currentReadSize);
            await handle.read(buffer, 0, currentReadSize, position);
            const content = buffer.toString('utf8');

            const lastIndex = content.lastIndexOf(SEARCH_STRING);
            if (lastIndex !== -1) {
                const lineStartIndex = content.lastIndexOf('\n', lastIndex);
                const absoluteStart = position + (lineStartIndex === -1 ? 0 : Buffer.byteLength(content.substring(0, lineStartIndex + 1), 'utf8'));

                const resultSize = size - absoluteStart;
                const resultBuffer = Buffer.alloc(resultSize);
                await handle.read(resultBuffer, 0, resultSize, absoluteStart);
                return resultBuffer.toString('utf8');
            }

            if (position === 0) break;

            // Move back another chunk, with overlap to ensure we don't miss the search string
            const newPosition = Math.max(0, position - CHUNK_SIZE);
            currentReadSize = position - newPosition + SEARCH_STRING.length;
            position = newPosition;
        }
    } catch (err) {
        console.error(`Error reading log file efficiently: ${err}`);
    } finally {
        if (handle) await handle.close();
    }
    return undefined;
}
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

    // Efficiently find the last block by reading from the end of the file
    const relevantLogBlock = await readLastRelevantBlock(debugLogPath);

    if (!relevantLogBlock) {
        console.debug("Finished parsing log file, but 'VOTC:IN/;/init' was not found. No game data will be loaded.");
        return undefined;
    }

    const lines = relevantLogBlock.split(/\r?\n/);

    console.log(`Starting to parse last VOTC:IN block from log file: ${debugLogPath}`);
    console.log(`--- Relevant Log Block Start ---`);
    console.log(relevantLogBlock);
    console.log(`--- Relevant Log Block End ---`);

    for (const line of lines) {
        console.log(`[parseLog] Processing line: ${line}`);
        if(isWaitingForMultiLine){
            if (!gameData) continue; // Should not happen if logic is correct, but good for safety
            console.log(`Parsing multi-line data of type "${multiLineType}": ${line}`);
            let value = line.split('#')[0]
            switch (multiLineType){
                case "new_relations": {
                    const pending = multiLineTempStorage[0] as { charAID: number, charBID: number, relationship: string };
                    // Accumulate any relationship text that fell on a continuation line
                    const addition = removeTooltip(value);
                    if (addition) {
                        pending.relationship = pending.relationship
                            ? pending.relationship + ' ' + addition
                            : addition;
                    }
                    // Commit once the full relationship text is known
                    if (line.includes('#ENDMULTILINE')) {
                        commitNewRelation(pending.charAID, pending.charBID, pending.relationship);
                    }
                break; }
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
                    console.log(`Initialized GameData for conversation with AI: ${gameData.aiName} (ID: ${gameData.aiID})`); // Updated log
                    if (gameData) {
                        console.log(`[parseLog] GameData initialized with scene: '${gameData.scene}' and location: '${gameData.location}'`);
                    }
                break;
                case "character": 
                    if (!gameData) continue;
                    let char = new Character(data);
                    gameData!.addCharacter(char.id, char);
                    console.log(`[parseLog] ADDED character to map: ID=${char.id}, Name=${char.fullName}`);
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
                    const characterWithTrait = gameData.characters.get(rootID);
                    if (!characterWithTrait) {
                        console.warn(`Character with ID ${rootID} not found when trying to add trait. Skipping.`);
                        continue;
                    }
                    let trait = parseTrait(data);
                    characterWithTrait.traits.push(trait);
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
                    const characterA_ID = rootID;
                    const characterB_ID = Number(data[1]);

                    const initialRelationship = line.includes('#')
                        ? removeTooltip(line.split('#')[1])
                        : "";

                    if (line.includes('#ENDMULTILINE')) {
                        commitNewRelation(characterA_ID, characterB_ID, initialRelationship);
                    } else {
                        multiLineTempStorage = [{ charAID: characterA_ID, charBID: characterB_ID, relationship: initialRelationship }];
                        isWaitingForMultiLine = true;
                        multiLineType = "new_relations";
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
                    break;
            }
        } else {
            if (line.trim() !== "") {
                console.debug(`Skipping line (no VOTC:IN): ${line}`);
            }
        }
    }
    console.debug("Finished parsing log file. Game data loaded from last block.");

    function commitNewRelation(charAID: number, charBID: number, relationship: string): void {
        if (!gameData || !relationship) return;
        const charA = gameData.characters.get(charAID);
        const charB = gameData.characters.get(charBID);
        if (!charA || !charB) {
            if (!charA) console.warn(`Character with ID ${charAID} not found when parsing family data`);
            if (!charB) console.warn(`Character with ID ${charBID} not found when parsing family data`);
            return;
        }
        if (!charA.familyMembers.some(m => m.id === charBID && m.relationship === relationship)) {
            charA.familyMembers.push({ id: charBID, name: charB.fullName, relationship });
            console.log(`Parsed family for character ${charAID} (${charA.fullName}): ${relationship} ${charB.fullName} (ID: ${charBID})`);
        }
        if (charAID === gameData.playerID) {
            if (!charB.relationsToPlayer.includes(relationship)) {
                charB.relationsToPlayer.push(relationship);
                console.log(`Parsed relationsToPlayer for character ${charBID} (${charB.fullName}): "${relationship}"`);
            }
        } else if (charBID === gameData.playerID) {
            if (!charA.relationsToPlayer.includes(relationship)) {
                charA.relationsToPlayer.push(relationship);
                console.log(`Parsed relationsToPlayer for character ${charAID} (${charA.fullName}): "${relationship}"`);
            }
        }
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
        const reason = removeTooltip(splits[0]);
        
        // Join the rest back in case the reason contained a colon
        const valueStr = splits.slice(1).join(': ');

        // Use regex to find the number, handles positive/negative values
        const match = valueStr.match(/[+-]?\d+/);
        const value = match ? Number(match[0]) : 0;

        return {
            reason: reason,
            value: value
        }
    }

    console.debug("Finished parsing log. Final GameData object:", gameData!);
    if (gameData && gameData.characters) {
        console.log(`[parseLog] Final character map size: ${gameData.characters.size}`);
        console.log(`[parseLog] Final character map keys: ${Array.from(gameData.characters.keys()).join(', ')}`);
    } else {
        console.log(`[parseLog] Final gameData or characters map is null/undefined.`);
    }
    
    // 初始化角色名称属性，供parseVariables使用
    if (gameData) {
        gameData.setCharacterNames();
    }
    
    return gameData!;
}

export function removeTooltip(str: string): string {
    if (!str) return "";

    // Remove unwanted ASCII control characters and tooltip/onclick prefixes
    let cleanedStr = str.replace(/[\x15]/g, '')
                      .replace(/\^U[^\n]*/g, '')
                      .replace(/\b(?:ONCLICK|TOOLTIP):[A-Z_]+,[^\s)]+/g, '')
                      .replace(/^\s*([A-Z][;\s]\s*)+/, '')
                      .replace(/(?<![A-Za-z])L\s+/g, '')
                      .replace(/(?<![A-Za-z])[A-Z];\s*/g, '');

    // If a tooltip description marker ' L; ' exists, take the text after it
    const lSemicolonIndex = cleanedStr.indexOf(' L; ');
    if (lSemicolonIndex !== -1) {
        cleanedStr = cleanedStr.substring(lSemicolonIndex + 4);
    }

    // Final cleanup on the resulting string
    cleanedStr = cleanedStr.replace(/!+/g, '')
      .replace(/[\s:!']+$/, '')
      .trim();

    return cleanedStr;
}
