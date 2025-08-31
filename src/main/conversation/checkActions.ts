import { Conversation } from "./Conversation";
import { Config } from "../../shared/Config";
import { convertMessagesToString } from "./promptBuilder";
import { Message, Action, ActionResponse } from "../ts/conversation_interfaces";
import { parseVariables } from "../parseVariables";

export async function checkActions(conv: Conversation): Promise<ActionResponse[]>{
    console.log('Starting action check.');
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

    const actions = actionsString.split(',');

    //validations
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
                    matchedAction.run(conv.gameData, (text: string)=>{conv.runFileManager.append(text)}, []);
                }catch(e){
                    let errMsg =`Action error: failure in run function for action: ${matchedAction.signature}; details: `+e;
                    console.error(errMsg)
                    conv.chatWindow.window.webContents.send('error-message', errMsg);
                }

                if(matchedAction.chatMessageClass != null){
                    triggeredActions.push({
                        actionName: matchedAction.signature,
                        chatMessage: parseVariables(matchedAction.chatMessage([]), conv.gameData),
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
            matchedAction.run(conv.gameData, (text: string)=>{conv.runFileManager.append(text)}, args);
        }catch(e){
            let errMsg =`Action error: failure in run function for action: ${matchedAction.signature}; details: `+e;
            console.error(errMsg)
            conv.chatWindow.window.webContents.send('error-message', errMsg);
        }
        

        if(matchedAction.chatMessageClass != null){
            triggeredActions.push({
                actionName: matchedAction.signature,
                chatMessage: parseVariables(matchedAction.chatMessage(args), conv.gameData),
                chatMessageClass: matchedAction.chatMessageClass
            })
        }
        console.log(`Action "${matchedAction.signature}" successfully triggered.`);
        
    }

    conv.runFileManager.append(`
        global_var:talk_first_scope = {
            trigger_event = talk_event.9003
        }`
    );
    
    console.log(`Final triggered actions: ${triggeredActions.map(a => a.actionName).join(', ')}`);
    return triggeredActions;
}

function buildActionChatPrompt(conv: Conversation, actions: Action[]): Message[]{
    let output: Message[] = [];
    
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
            argString += `${arg.name} (${arg.type}): ${arg.desc}. `
        }

        
        listOfActions += `\n- ${signature}: ${parseVariables(action.description, conv.gameData)} ${parseVariables(argString, conv.gameData)}`;
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
${conv.description}
"Given these replies:\n${convertMessagesToString(conv.messages.slice(conv.messages.length-2), "", "")}
${listOfActions}`
})

output.push({
    role: "user",
    content: "Choose the most relevant actions. Response format: <rationale>Reasoning.</rationale><actions>actionName1(value), actionName2(value)</actions>"
})

    return output;
}

function convertChatToTextPrompt(messages: Message[], config: Config): string{
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
