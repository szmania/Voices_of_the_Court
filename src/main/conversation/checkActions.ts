import { Conversation } from "./Conversation";
import { Config } from "../../shared/Config";
import { convertMessagesToString } from "./promptBuilder";
import path from 'path';
import { Message, Action, ActionResponse, PendingAction } from "../ts/conversation_interfaces";
import { parseVariables } from "../parseVariables";
import { generateNarrative } from "./generateNarrative";
import { ActionEffectWriter } from "./ActionEffectWriter.js";

export async function checkActions(conv: Conversation, sourceId: number, targetId: number): Promise<ActionResponse[]>{
    console.log(`Starting action check for source: ${sourceId}, target: ${targetId}`);
    const character = conv.gameData.getCharacterById(sourceId) || conv.gameData.getPlayer();
    conv.chatWindow.window.webContents.send('status-update', 'chat.status_checking_actions', { characterName: character.shortName });

    let availableActions: Action[] = [];

    for(let action of conv.actions){
        try{
            // The check function now receives the initial context of who is talking to whom.
            if(action.check(conv.gameData, sourceId, targetId)){
                availableActions.push(action)
            }
        }catch(e){
            let errMsg =`Action error: failure in check function. action: ${action.signature}; details: `+e;
            console.error(errMsg)
            conv.chatWindow.window.webContents.send('error-message', errMsg);
        }
    }
    console.log(`Available actions for current context: ${availableActions.map(a => a.signature).join(', ')}`);

    if (availableActions.length === 0) {
        console.log('No actions available for current context.');
        return [];
    }

    let triggeredActions: ActionResponse[] = [];

    let response;
    const prompt = buildActionChatPrompt(conv, availableActions);
    if(conv.actionsApiConnection.isChat()){
        response = await conv.actionsApiConnection.complete(prompt, false, {} );
    } else {
        let textPrompt = convertChatToTextPrompt(prompt, conv.config );
        response = await conv.actionsApiConnection.complete(textPrompt, false, {stop: [conv.config.inputSequence, conv.config.outputSequence]} );
    }

    console.log(`Raw LLM response for actions: ${response}`);
    response = response.replace(/(\r\n|\n|\r)/gm, "");

    if(!response.match(/<rationale>(.*?)<\/?rationale>/) || !response.match(/<actions>(.*?)<\/?actions>/)){
        console.warn("Action warning: rationale or action couldn't be extracted from LLM response. Response: "+ response);
        return [];
    }

    const rationale = response.match(/<rationale>(.*?)<\/rationale>/)![1];
    const actionsString = response.match(/<actions>(.*?)<\/actions>/)![1];
    console.log(`Extracted rationale: ${rationale}`);
    console.log(`Extracted actions string: ${actionsString}`);

    if(actionsString.trim() === "noop()"){
        console.log('LLM returned "noop()", no actions triggered.');
        return [];
    }

    const actions = actionsString.split(/\s*,\s*(?=[a-zA-Z_])/).filter(a => a.trim() !== 'noop()');

    for(const actionInResponse of actions){
        const foundActionName = actionInResponse.match(/([a-zA-Z_{1}][a-zA-Z0-9_]+)(?=\()/g);
        if(!foundActionName){
            console.warn(`Action warning: Could not extract action name from "${actionInResponse}". Skipping.`);
            continue;
        }

        const matchedAction = availableActions.find(a => a.signature == foundActionName[0]);
        if(!matchedAction){
            console.warn(`Action warning: The returned action "${foundActionName[0]}" from LLM matched none of the listed available actions. Skipping.`);
            continue;
        }

        const argsString = /\(([^)]+)\)/.exec(actionInResponse);
        const allArgs = argsString ? argsString[1].split(",").map(arg => arg.trim()) : [];

        // NEW: Expect source and target IDs from the LLM
        if (allArgs.length < 2) {
            console.warn(`Action warning: Action "${actionInResponse}" did not include sourceId and targetId. Skipping.`);
            continue;
        }

        const newSourceId = parseInt(allArgs[0], 10);
        const newTargetId = parseInt(allArgs[1], 10);
        const actionArgs = allArgs.slice(2); // The rest are the actual action arguments

        if (isNaN(newSourceId) || isNaN(newTargetId)) {
            console.warn(`Action warning: Invalid sourceId or targetId in "${actionInResponse}". Skipping.`);
            continue;
        }

        if (actionArgs.length !== matchedAction.args.length) {
            console.warn(`Action warning: The matched action "${matchedAction.signature}" has a different number of arguments (${matchedAction.args.length}) than the one from the LLM response (${actionArgs.length}). Skipping.`);
            continue;
        }

        // Argument type validation (can be expanded)
        let isValidAction = true;
        for(let i = 0; i < actionArgs.length; i++){
            if(matchedAction.args[i].type === "number" && isNaN(Number(actionArgs[i]))){
                console.warn(`Action warning: Argument "${actionArgs[i]}" for action "${matchedAction.signature}" was not a valid number. Skipping.`);
                isValidAction = false;
                break;
            }
        }
        if(!isValidAction) continue;

        // NEW: Perform pre-check if available
        if (matchedAction.preCheck) {
            const preCheckResult = matchedAction.preCheck(conv.gameData, actionArgs, newSourceId, newTargetId);
            if (!preCheckResult.success) {
                console.warn(`Action pre-check failed for "${matchedAction.signature}": ${preCheckResult.message}`);
                if (preCheckResult.message) {
                    conv.chatWindow.window.webContents.send('error-message', `Action '${matchedAction.signature}' cannot be executed: ${preCheckResult.message}`);
                }
                continue; // Skip to the next action
            }
        }

        // NEW: Manual Action Approval Logic
        if (conv.config.manualActionApproval) {
            const lastMessage = conv.messages[conv.messages.length - 1];
            if (!lastMessage || !lastMessage.id) {
                console.error("Cannot request action approval, last message has no ID.");
                continue;
            }

            const pendingAction: PendingAction = {
                action: matchedAction,
                args: actionArgs,
                sourceId: newSourceId,
                targetId: newTargetId
            };

            if (!conv.pendingActions.has(lastMessage.id)) {
                conv.pendingActions.set(lastMessage.id, []);
            }
            conv.pendingActions.get(lastMessage.id)!.push(pendingAction);

            let chatMessage = matchedAction.chatMessage(actionArgs);
            if (typeof chatMessage === 'object') {
                chatMessage = chatMessage[conv.config.language] || chatMessage['en'] || Object.values(chatMessage)[0];
            }
            const sourceChar = conv.gameData.getCharacterById(newSourceId);
            const targetChar = conv.gameData.getCharacterById(newTargetId);
            conv.gameData.character1Name = sourceChar ? sourceChar.shortName : "someone";
            conv.gameData.character2Name = targetChar ? targetChar.shortName : "someone";

            const approvalResponse: ActionResponse = {
                actionName: matchedAction.signature,
                chatMessage: parseVariables(chatMessage, conv.gameData),
                chatMessageClass: matchedAction.chatMessageClass
            };
            
            conv.chatWindow.window.webContents.send('action-approval-request', lastMessage.id, [approvalResponse]);
            console.log(`Sent action "${matchedAction.signature}" for manual approval.`);

        } else { // Execute directly if manual approval is off
            console.log(`Executing action: ${matchedAction.signature} with source: ${newSourceId}, target: ${newTargetId}, args: [${actionArgs.join(', ')}]`);
            try {
                let effectBody = "";
                // Use the LLM-provided IDs
                matchedAction.run(conv.gameData, (text: string) => { effectBody += text; }, actionArgs, newSourceId, newTargetId);
                ActionEffectWriter.appendEffect(
                    conv.runFileManager,
                    conv.gameData,
                    newSourceId,
                    newTargetId,
                    effectBody
                );

                // Hardcoded effect for leaveConversation
                if (matchedAction.signature === 'leaveConversation') {
                    conv.removeCharacter(newTargetId);
                }

                // Regenerate scene description if location changes
                if (matchedAction.signature === 'changeLocation') {
                    conv.generateSceneDescription();
                }
            } catch(e) {
                let errMsg =`Action error: failure in run function for action: ${matchedAction.signature}; details: `+e;
                console.error(errMsg)
                conv.chatWindow.window.webContents.send('error-message', errMsg);
            }

            if(matchedAction.chatMessageClass != null){
                let chatMessage = matchedAction.chatMessage(actionArgs);
                if (typeof chatMessage === 'object') {
                    chatMessage = chatMessage[conv.config.language] || chatMessage['en'] || Object.values(chatMessage)[0];
                }
                // Use LLM-provided IDs to get correct names
                const sourceChar = conv.gameData.getCharacterById(newSourceId);
                const targetChar = conv.gameData.getCharacterById(newTargetId);
                conv.gameData.character1Name = sourceChar ? sourceChar.shortName : "someone";
                conv.gameData.character2Name = targetChar ? targetChar.shortName : "someone";
                triggeredActions.push({
                    actionName: matchedAction.signature,
                    chatMessage: parseVariables(chatMessage, conv.gameData),
                    chatMessageClass: matchedAction.chatMessageClass
                })
            }
            console.log(`Action "${matchedAction.signature}" successfully triggered.`);
        }
    }

    if (triggeredActions.length > 0) {
        conv.runFileManager.append(`
          root = {trigger_event = mcc_event_v2.9003}
            `
        );
    }

    console.log(`Final triggered actions: ${triggeredActions.map(a => a.actionName).join(', ')}`);
    return triggeredActions;
}

function buildActionChatPrompt(conv: Conversation, actions: Action[]): Message[]{
    let output: Message[] = [];

    const descriptionScriptFileName = conv.config.selectedDescScript;
    const descriptionPath = path.join(conv.userDataPath, 'scripts', 'prompts', 'description', descriptionScriptFileName);
    let description = "";
    try{
        delete require.cache[require.resolve(descriptionPath)];
        description = require(descriptionPath)(conv.gameData, conv.gameData.getPlayer());
    }catch(err){
        console.error(`Description script error for '${descriptionScriptFileName}': ${err}`);
        conv.chatWindow.window.webContents.send('error-message', `Error in description script '${descriptionScriptFileName}'.`);
    }

    let characterList = "Characters in conversation:";
    for (const char of conv.gameData.characters.values()) {
        characterList += `\n- ${char.fullName} (ID: ${char.id})`;
    }

    let listOfActions = `List of actions:`;
    for(const action of actions){
        let argNames: string[] = [];
        action.args.forEach( arg => { argNames.push(arg.name)})
        // The LLM will now provide source and target, so we don't include them in the signature shown to it.
        let signature = action.signature+'('+argNames.join(', ')+')';
        let argString = action.args.length > 0 ? `Takes ${action.args.length} arguments: ` : "Takes no arguments.";

        for(const arg of action.args){
            let argDesc = arg.desc;
            if (typeof argDesc === 'object') {
                argDesc = argDesc[conv.config.language] || argDesc['en'] || Object.values(argDesc)[0];
            }
            argString += `${arg.name} (${arg.type}): ${argDesc}. `
        }

        let description = action.description;
        if (typeof description === 'object') {
            description = description[conv.config.language] || description['en'] || Object.values(description)[0];
        }
        listOfActions += `\n- ${signature}: ${parseVariables(description, conv.gameData)} ${parseVariables(argString, conv.gameData)}`;
    }

    listOfActions += `\n- noop(): Execute when none of the previous actions are a good fit for the given replies.`
    listOfActions += `\nExplain why and which actions you would trigger (rationale), then write the most appropriate actions (actions). For each action, you MUST identify the source and the target by their ID from the character list. If you think multiple actions should be triggered, then seperate them with commas (,) inside the <actions> tags.`
    listOfActions+= `\nResponse format: <rationale>Reasoning.</rationale><actions>actionName1(sourceId, targetId, value), actionName2(sourceId, targetId, value)</actions>`

    output.push({
        role: "system",
        content: `Your task is to select actions from the list that happened in the last replies. For each action, you must provide the source's ID and the target's ID as the first two arguments. The 'source' is the character performing the action. The 'target' is the character being acted upon. Carefully read each action's description to understand who is the source and who is the target for that specific action. The IDs must come from the provided character list. The actions MUST exist in the provided list. Response format: <rationale>Reasoning.</rationale><actions>actionName1(sourceId, targetId, value), actionName2(sourceId, targetId, value)</actions>'`
    })

    output.push({
        role: "user",
        content: `Choose the most relevant actions that you think happened in the provided dialogue based on the last messages.
${characterList}
"Prior dialogue:\n"+ ${convertMessagesToString(conv.messages.slice(conv.messages.length-8, conv.messages.length-2), "", "")}
${description}
"Given these replies:\n${convertMessagesToString(conv.messages.slice(conv.messages.length-2), "", "")}
${listOfActions}`
})

    output.push({
        role: "user",
        content: "Choose the most relevant actions. Response format: <rationale>Reasoning.</rationale><actions>actionName1(sourceId, targetId, value), actionName2(sourceId, targetId, value)</actions>"
    })

    return output;
}

export function convertChatToTextPrompt(messages: Message[], config: Config): string{
    let output: string = "";
    for(let msg of messages){
        if(msg.role === "user"){
            output+=config.inputSequence+"\n";
        }
        output += msg.content+"\n";
    }

    output+=config.outputSequence+"\n";
    return output;
}
