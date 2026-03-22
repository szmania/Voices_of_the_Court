import { GameData, Memory, Trait, OpinionModifier, Secret, Relative} from "./GameData";
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

    const deferredRelations: { charAID: number, charBID: number, relationship: string }[] = [];

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

                // --- log_relatives: parents ---
                case "parents":
                    if (!gameData) continue;
                    upsertRelative(rootID, Number(data[1]), data[2], 'Parent', { birthDate: data[4] });
                    break;
                case "parent_death": {
                    if (!gameData) continue;
                    const pd = findRelative(rootID, Number(data[1]));
                    if (pd) { pd.isDeceased = true; pd.deathDate = data[3]; pd.deathReason = data[4]; }
                    break;
                }

                // --- log_relatives: kids ---
                case "kids":
                    if (!gameData) continue;
                    upsertRelative(rootID, Number(data[1]), data[2], 'Child', { sheHe: data[3], birthDate: data[5] });
                    break;
                case "kid_other_parent": {
                    if (!gameData) continue;
                    const kop = findRelative(rootID, Number(data[1]));
                    if (kop) { kop.otherParentId = Number(data[2]); kop.otherParentName = data[3]; }
                    break;
                }
                case "kid_death": {
                    if (!gameData) continue;
                    const kd = findRelative(rootID, Number(data[1]));
                    if (kd) { kd.isDeceased = true; kd.deathDate = data[3]; kd.deathReason = data[4]; }
                    break;
                }
                case "kid_trait": {
                    if (!gameData) continue;
                    const kt = findRelative(rootID, Number(data[1]));
                    if (kt) kt.traits.push({ category: data[2], name: data[3], desc: data[4] });
                    break;
                }
                case "kid_is_concubine": {
                    if (!gameData) continue;
                    const kic = findRelative(rootID, Number(data[1]));
                    if (kic) { kic.maritalStatus = 'is_concubine'; kic.partners.push({ id: Number(data[2]), name: data[3], type: 'spouse' }); }
                    break;
                }
                case "kid_concubine": {
                    if (!gameData) continue;
                    const kcon = findRelative(rootID, Number(data[1]));
                    if (kcon) { kcon.maritalStatus = 'married'; kcon.partners.push({ id: Number(data[2]), name: data[3], type: 'concubine' }); }
                    break;
                }
                case "kid_spouse": {
                    if (!gameData) continue;
                    const ks = findRelative(rootID, Number(data[1]));
                    if (ks) { ks.maritalStatus = 'married'; ks.partners.push({ id: Number(data[2]), name: data[3], type: 'spouse' }); }
                    break;
                }
                case "kid_betrothed": {
                    if (!gameData) continue;
                    const kb = findRelative(rootID, Number(data[1]));
                    if (kb) { kb.maritalStatus = 'betrothed'; kb.partners.push({ id: Number(data[2]), name: data[3], type: 'betrothed' }); }
                    break;
                }
                case "kid_unmarried": {
                    if (!gameData) continue;
                    const ku = findRelative(rootID, Number(data[1]));
                    if (ku) ku.maritalStatus = 'unmarried';
                    break;
                }
                case "kid_eob":
                    break;

                // --- log_relatives: siblings ---
                case "siblings":
                    if (!gameData) continue;
                    upsertRelative(rootID, Number(data[1]), data[2], 'Sibling', { sheHe: data[3], birthDate: data[5] });
                    break;
                case "sibling_other_parent": {
                    if (!gameData) continue;
                    const sop = findRelative(rootID, Number(data[1]));
                    if (sop) { sop.otherParentId = Number(data[2]); sop.otherParentName = data[3]; }
                    break;
                }
                case "sibling_death": {
                    if (!gameData) continue;
                    const sd = findRelative(rootID, Number(data[1]));
                    if (sd) { sd.isDeceased = true; sd.deathDate = data[3]; sd.deathReason = data[4]; }
                    break;
                }
                case "sibling_trait": {
                    if (!gameData) continue;
                    const st = findRelative(rootID, Number(data[1]));
                    if (st) st.traits.push({ category: data[2], name: data[3], desc: data[4] });
                    break;
                }
                case "sibling_is_concubine": {
                    if (!gameData) continue;
                    const sic = findRelative(rootID, Number(data[1]));
                    if (sic) { sic.maritalStatus = 'is_concubine'; sic.partners.push({ id: Number(data[2]), name: data[3], type: 'spouse' }); }
                    break;
                }
                case "sibling_concubine": {
                    if (!gameData) continue;
                    const scon = findRelative(rootID, Number(data[1]));
                    if (scon) { scon.maritalStatus = 'married'; scon.partners.push({ id: Number(data[2]), name: data[3], type: 'concubine' }); }
                    break;
                }
                case "sibling_spouse": {
                    if (!gameData) continue;
                    const ss = findRelative(rootID, Number(data[1]));
                    if (ss) { ss.maritalStatus = 'married'; ss.partners.push({ id: Number(data[2]), name: data[3], type: 'spouse' }); }
                    break;
                }
                case "sibling_betrothed": {
                    if (!gameData) continue;
                    const sbet = findRelative(rootID, Number(data[1]));
                    if (sbet) { sbet.maritalStatus = 'betrothed'; sbet.partners.push({ id: Number(data[2]), name: data[3], type: 'betrothed' }); }
                    break;
                }
                case "sibling_unmarried": {
                    if (!gameData) continue;
                    const su = findRelative(rootID, Number(data[1]));
                    if (su) su.maritalStatus = 'unmarried';
                    break;
                }
                case "sibling_eob":
                    break;
            }
        } else {
            if (line.trim() !== "") {
                console.debug(`Skipping line (no VOTC:IN): ${line}`);
            }
        }
    }

    for (const entry of deferredRelations) {
        const charA = gameData?.characters.get(entry.charAID);
        const charB = gameData?.characters.get(entry.charBID);
        if (!charA || !charB) {
            if (!charA) console.warn(`Character with ID ${entry.charAID} not found after full parse (new_relations)`);
            if (!charB) console.warn(`Character with ID ${entry.charBID} not found after full parse (new_relations)`);
            continue;
        }
        commitNewRelation(entry.charAID, entry.charBID, entry.relationship);
    }

    console.debug("Finished parsing log file. Game data loaded from last block.");

    function findRelative(rootID: number, relativeID: number): Relative | undefined {
        return gameData?.characters.get(rootID)?.relatives.find(r => r.id === relativeID);
    }

    function upsertRelative(rootID: number, id: number, name: string, relationship: string, extras?: Partial<Relative>): void {
        if (!gameData) return;
        const char = gameData.characters.get(rootID);
        if (!char) return;
        let rel = char.relatives.find(r => r.id === id);
        if (!rel) {
            rel = { id, name, relationship, isDeceased: false, traits: [], partners: [] };
            char.relatives.push(rel);
        } else {
            if (name) rel.name = name;
            if (relationship) rel.relationship = relationship;
        }
        if (extras) Object.assign(rel, extras);
    }

    function commitNewRelation(charAID: number, charBID: number, relationship: string): void {
        if (!gameData || !relationship) return;
        const charA = gameData.characters.get(charAID);
        const charB = gameData.characters.get(charBID);
        if (!charA || !charB) {
            deferredRelations.push({ charAID, charBID, relationship });
            return;
        }
        if (!charA.relatives.some(m => m.id === charBID)) {
            charA.relatives.push({ id: charBID, name: charB.fullName, relationship, isDeceased: false, traits: [], partners: [] });
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
