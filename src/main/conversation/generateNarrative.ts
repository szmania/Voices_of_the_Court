import { Conversation } from "./Conversation";
import { Config } from "../../shared/Config";
import { convertMessagesToString } from "./promptBuilder";
import { Message, ActionResponse } from "../ts/conversation_interfaces";
import { parseVariables } from "../parseVariables";
import { convertChatToTextPrompt } from "./checkActions";

/**
 * 生成AI旁白，基于最后一轮对话和action的return结果
 * @param conv - 当前对话对象
 * @param actionResponses - 已触发的action响应列表
 * @returns 生成的旁白文本
 */
export async function generateNarrative(conv: Conversation, actionResponses: ActionResponse[]): Promise<string> {
    // 如果没有触发的action，返回空字符串
    if (actionResponses.length === 0) {
        return "";
    }

    console.log('Generating AI narrative for triggered actions.');

    // 构建旁白提示
    const prompt = buildNarrativePrompt(conv, actionResponses);

    let response;
    if (conv.actionsApiConnection.isChat()) {
        response = await conv.actionsApiConnection.complete(prompt, false, {});
    } else {
        response = await conv.actionsApiConnection.complete(
            convertChatToTextPrompt(prompt, conv.config),
            false,
            { stop: [conv.config.inputSequence, conv.config.outputSequence] }
        );
    }

    console.log(`Raw LLM response for narrative: ${response}`);
    
    // 清理响应，移除可能的格式标记
    response = response.replace(/(\r\n|\n|\r)/gm, "");
    response = response.replace(/<narrative>(.*?)<\/?narrative>/, "$1").trim();

    return response;
}

/**
 * 构建用于生成旁白的提示
 * @param conv - 当前对话对象
 * @param actionResponses - 已触发的action响应列表
 * @returns 构建的消息列表
 */
function buildNarrativePrompt(conv: Conversation, actionResponses: ActionResponse[]): Message[] {
    // 获取最后一轮对话（最近的两条消息）
    const lastMessages = conv.messages.slice(-2);
    
    // 构建action结果文本
    const actionResults = actionResponses.map(action => action.chatMessage).join("\n");
    
    // 使用配置中的narrativePrompt，并替换变量
    const promptTemplate = conv.config.narrativePrompt || "请根据以下对话内容生成一段简短的旁白，描述场景氛围或角色的内心感受。旁白应该简洁、生动，长度控制在50-100字之间。使用中文。";
    const promptContent = parseVariables(promptTemplate, conv.gameData);
    
    const output: Message[] = [
        {
            role: "system",
            content: promptContent
        },
        {
            role: "user",
            content: `最后一轮对话：
${convertMessagesToString(lastMessages, "", "")}

事件结果：
${actionResults}

请为以上事件生成一段旁白描述：`
        }
    ];

    return output;
}