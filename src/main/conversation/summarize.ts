import { Conversation } from "./Conversation";
import { buildSummarizeChatPrompt, convertChatToTextNoNames} from "./promptBuilder";


export async function summarize(conv: Conversation): Promise<string>{
    console.log('Starting summarization...');
    let summarization: string;
    if(conv.summarizationApiConnection.isChat()){
        console.log('Using chat API for summarization.');
        summarization = await conv.summarizationApiConnection.complete(buildSummarizeChatPrompt(conv), false, {
        })
    }
    else{
        console.log('Using completion API for summarization.');
        summarization = await conv.summarizationApiConnection.complete(convertChatToTextNoNames(buildSummarizeChatPrompt(conv), conv.config), false, {
        })
    }
    console.log(`Summarization complete. Length: ${summarization.length}`);
    return summarization;
}
