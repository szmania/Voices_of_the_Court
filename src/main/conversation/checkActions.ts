import { Conversation } from "./Conversation";
import { Config } from "../../shared/Config";
import { convertMessagesToString } from "./promptBuilder";
import path from 'path';
import { Message, Action, ActionResponse } from "../ts/conversation_interfaces";
import { parseVariables } from "../parseVariables";
import { generateNarrative } from "./generateNarrative";
import { ActionEffectWriter } from "./ActionEffectWriter.js";

export async function checkActions(conv: Conversation): Promise<ActionResponse[]>{
    console.log('Starting action check.');
    const character = conv.gameData.getPlayer();
    conv.chatWindow.window.webContents.send('status-update', 'chat.status_checking_actions', { characterName: character.shortName });

    // Check minimum messages before any action can trigger
    const totalMessages = conv.messages.length;
    if (totalMessages < 1) {
        console.log(`Skipping action check: conversation has ${totalMessages} messages, minimum required is 1`);
        return [];
    }


    let availableActions: Action[] = [];

    for(let action of conv.actions){
        try{
            if(action.check(conv.gameData)){
                availableActions.push(action)
            }
        }catch(e){
            let errMsg =`Action error: failure in check function. action: ${action.signature}; details: `+e;
            console.error(errMsg)
            conv.chatWindow.window.webContents.send('error-message', errMsg);
        }

    }
    console.log(`Available actions for current context: ${availableActions.map(a => a.signature).join(', ')}`);

    // If no actions are available, return early
    if (availableActions.length === 0) {
        console.log('No actions available for current context.');
        return [];
    }

    let triggeredActions: ActionResponse[] = [];

    let response;
    if(conv.actionsApiConnection.isChat()){
        let prompt = buildActionChatPrompt(conv, availableActions);
        response = await conv.actionsApiConnection.complete(prompt, false, {} );
    }
    else{
        let prompt = convertChatToTextPrompt(buildActionChatPrompt(conv, availableActions), conv.config );
        response = await conv.actionsApiConnection.complete(prompt, false, {stop: [conv.config.inputSequence, conv.config.outputSequence]} );
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


    if(actionsString === "noop()"){
        console.log('LLM returned "noop()", no actions triggered.');
        return [];
    }

    const actions = actionsString.split(',').filter(a => a.trim() !== 'noop()');

    //validations
    for(const actionInResponse of actions){
        //validate name
        const foundActionName = actionInResponse.match(/([a-zA-Z_{1}][a-zA-Z0-9_]+)(?=\()/g);

        if(!foundActionName){
            console.warn(`Action warning: Could not extract action name from "${actionInResponse}". Skipping.`);
            continue;
        }

    //validations
    if (conv.config.manualActionApproval) {
        const proposedActions: ActionResponse[] = [];
        for (const actionInResponse of actions) {
            const foundActionName = actionInResponse.match(/([a-zA-Z_{1}][a-zA-Z0-9_]+)(?=\()/g);
            if (!foundActionName) continue;

            const matchedAction = availableActions.find(a => a.signature === foundActionName[0]);
            if (!matchedAction) continue;

            const argsString = /\(([^)]+)\)/.exec(actionInResponse);
            const args = argsString ? argsString[1].split(",") : [];

            if (args.length !== matchedAction.args.length) continue;

            let chatMessage = matchedAction.chatMessage(args);
            if (typeof chatMessage === 'object') {
                chatMessage = chatMessage[conv.config.language] || chatMessage['en'] || Object.values(chatMessage)[0];
            }

            proposedActions.push({
                actionName: matchedAction.signature,
                chatMessage: parseVariables(chatMessage, conv.gameData),
                chatMessageClass: matchedAction.chatMessageClass
            });
        }

        if (proposedActions.length > 0) {
            const messageIndex = conv.messages.length - 1;
            conv.chatWindow.window.webContents.send('action-approval-request', messageIndex, proposedActions);
            console.log(`Sent ${proposedActions.length} actions for user approval.`);
        }
        return [];
    }


    for(const actionInResponse of actions){
        //validate name
        const foundActionName = actionInResponse.match(/([a-zA-Z_{1}][a-zA-Z0-9_]+)(?=\()/g);

        if(!foundActionName){
            console.warn(`Action warning: Could not extract action name from "${actionInResponse}". Skipping.`);
            continue;
        }

        let matchedActions: Action[] = availableActions.filter( validAction =>{
            return validAction.signature == foundActionName[0];
        })


        if(matchedActions.length == 0){
            console.warn(`Action warning: The returned action "${foundActionName[0]}" from LLM matched none of the listed available actions. Skipping.`);
            continue;
        }

        const matchedAction: Action = matchedActions[0];

        //validate args
        const argsString = /\(([^)]+)\)/.exec(actionInResponse);
        if(argsString == null){
            if(matchedAction.args.length === 0){
                console.log(`Executing action: ${matchedAction.signature} with no arguments.`);
                try{
                    let effectBody = "";
                    matchedAction.run(conv.gameData, (text: string) => { effectBody += text; }, []);
                    ActionEffectWriter.appendEffect(
                        conv.runFileManager,
                        conv.gameData,
                        conv.gameData.playerID,
                        conv.gameData.aiID,
                        effectBody
                    );
                }catch(e){
                    let errMsg =`Action error: failure in run function for action: ${matchedAction.signature}; details: `+e;
                    console.error(errMsg)
                    conv.chatWindow.window.webContents.send('error-message', errMsg);
                }

                if(matchedAction.chatMessageClass != null){
                    let chatMessage = matchedAction.chatMessage([]);
                    if (typeof chatMessage === 'object') {
                        chatMessage = chatMessage[conv.config.language] || chatMessage['en'] || Object.values(chatMessage)[0];
                    }
                    triggeredActions.push({
                        actionName: matchedAction.signature,
                        chatMessage: parseVariables(chatMessage, conv.gameData),
                        chatMessageClass: matchedAction.chatMessageClass
                    })
                }

                console.log(`Action "${matchedAction.signature}" successfully triggered.`);
                continue;
            }

            console.warn(`Action warning: Response action "${actionInResponse}" had no arguments, but matched action "${matchedAction.signature}" requires arguments. Skipping.`);
            continue;
        }

        const args = argsString![1].split(",");

        if(args.length !== matchedAction.args.length){
            console.warn(`Action warning: The matched action "${matchedAction.signature}" has a different number of arguments (${matchedAction.args.length}) than the one from the LLM response (${args.length}). Skipping.`);
            continue;
        }

        let isValidAction = true;
        for(let i =0; i<args.length;i++){

            if(matchedAction.args[0].type === "number"){
                if(isNaN(Number(args[0]))){
                    console.warn(`Action warning: Argument "${args[0]}" for action "${matchedAction.signature}" was not a valid number. Expected type: ${matchedAction.args[0].type}. Skipping.`);
                    isValidAction = false;
                    break;
                }

            }
            else if(matchedAction.args[0].type === "string"){
                //TODO
            }
        }
        if(!isValidAction){
            continue;
        }

        console.log(`Executing action: ${matchedAction.signature} with args: [${args.join(', ')}]`);
        try{
            let effectBody = "";
            matchedAction.run(conv.gameData, (text: string) => { effectBody += text; }, args);
            ActionEffectWriter.appendEffect(
                conv.runFileManager,
                conv.gameData,
                conv.gameData.playerID,
                conv.gameData.aiID,
                effectBody
            );
        }catch(e){
            let errMsg =`Action error: failure in run function for action: ${matchedAction.signature}; details: `+e;
            console.error(errMsg)
            conv.chatWindow.window.webContents.send('error-message', errMsg);
        }


        if(matchedAction.chatMessageClass != null){
            let chatMessage = matchedAction.chatMessage(args);
            if (typeof chatMessage === 'object') {
                chatMessage = chatMessage[conv.config.language] || chatMessage['en'] || Object.values(chatMessage)[0];
            }
            triggeredActions.push({
                actionName: matchedAction.signature,
                chatMessage: parseVariables(chatMessage, conv.gameData),
                chatMessageClass: matchedAction.chatMessageClass
            })
        }
        console.log(`Action "${matchedAction.signature}" successfully triggered.`);

    }

    if (triggeredActions.length > 0) {
        conv.runFileManager.append(`
            global_var:talk_first_scope = {
                trigger_event = mcc_event_v2.9003
            }`
        );
    }

    console.log(`Final triggered actions: ${triggeredActions.map(a => a.actionName).join(', ')}`);

    // Log action frequency statistics
    if (triggeredActions.length > 0) {
        console.log(`Action frequency stats: totalMessages=${totalMessages}, consecutiveActionsCount=${conv.consecutiveActionsCount}, lastActionMessageIndex=${conv.lastActionMessageIndex}`);
    }

    // 生成AI旁白
    let narrative = "";
    if (triggeredActions.length > 0 && conv.config.narrativeEnable) {
        try {
            narrative = await generateNarrative(conv, triggeredActions);
            console.log(`Generated narrative: ${narrative}`);
        } catch (e) {
            console.error(`Error generating narrative: ${e}`);
            narrative = "";
        }
    }

    return { actions: triggeredActions, narrative: narrative };
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

    let listOfActions = `List of actions:`;

    for(const action of actions){

        let argNames: string[] = [];
        action.args.forEach( arg => { argNames.push(arg.name)})

        let signature = action.signature+'('+argNames.join(', ')+')';

        let argString = "";
        if(action.args.length == 0){
            argString = "Takes no arguments."
        }
        else{
            argString = `Takes ${action.args.length} arguments: `
        }

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
    listOfActions += `\nExplain why and which actions you would trigger (rationale), then write the most appropriate actions (actions). If you think multiple actions should be triggered, then seperate them with commas (,) inside the <actions> tags.`
    listOfActions+= `\nResponse format: <rationale>Reasoning.</rationale><actions>actionName1(value), actionName2(value)</actions>`

    output.push({
        role: "system",
        content: `Your task is to select the actions you think happened in the last replies. The actions MUST exist in the provided list. You can select multiple actions, seperate them with commas. If a function takes a value, then put it inside the brackets after the function, a function can take either 0 or 1 values. 'Response format: <rationale>Reasoning.</rationale><actions>actionName1(value), actionName2(value)</actions>'`
    })

    output.push({
        role: "user",
        content: `Choose the most relevant actions that you think happened in the provided dialogue based on the last messages.
"Prior dialogue:\n"+ ${convertMessagesToString(conv.messages.slice(conv.messages.length-8, conv.messages.length-2), "", "")}
${description}
"Given these replies:\n${convertMessagesToString(conv.messages.slice(conv.messages.length-2), "", "")}
${listOfActions}`
})

output.push({
    role: "user",
    content: "Choose the most relevant actions. Response format: <rationale>Reasoning.</rationale><actions>actionName1(value), actionName2(value)</actions>"
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
