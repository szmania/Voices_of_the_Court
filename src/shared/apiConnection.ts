import { Message, MessageChunk } from "../main/ts/conversation_interfaces";
import OpenAI from "openai";
const contextLimits = require("../../public/contextLimits.json");

import tiktoken from "js-tiktoken";

export interface apiConnectionTestResult{
    success: boolean,
    overwriteWarning?: boolean;
    errorMessage?: string,
}

export interface Connection{
    type: string; //openrouter, openai, ooba
    baseUrl: string;
    key: string;
    model: string;
    forceInstruct: boolean; // Weird: when true, forces text completions API; when false, uses chat completions API
    overwriteContext: boolean;
    customContext: number;
}

export interface Parameters{
    temperature: number,
	frequency_penalty: number,
	presence_penalty: number,
	top_p: number,
}

let encoder = tiktoken.getEncoding("cl100k_base");

export class ApiConnection{
    type: string; //openrouter, openai, ooba, custom
    client: any;
    model: string;
    forceInstruct: boolean; // Weird: when true, forces text completions API; when false, uses chat completions API
    parameters: Parameters;
    context: number;
    overwriteWarning: boolean;
    

    constructor(connection: Connection, parameters: Parameters){
        console.debug("--- API CONNECTION: Constructor ---");
        const redactedConnection = { ...connection, key: '[REDACTED]' };
        console.debug("Received connection:", redactedConnection);
        console.debug("Received parameters:", parameters);
        this.type = connection.type;
        if(this.type !== 'gemini'){
            this.client = new OpenAI({
                baseURL: connection.baseUrl,
                apiKey: connection.key,
                dangerouslyAllowBrowser: true,
                defaultHeaders: {
                    "HTTP-Referer": "https://github.com/szmania/Voices_of_the_Court", // Optional, for including your app on openrouter.ai rankings.
                    "X-Title": "Voices of the Court - Community Edition", // Optional. Shows in rankings on openrouter.ai.
                  }
            })
        }else{
            this.client = {
                apiKey: connection.key,
                baseURL: connection.baseUrl
            }
        }
        this.model = connection.model;
        this.forceInstruct = connection.forceInstruct;
        // Remove unsupported parameters for Gemini models
        if (this.model && this.model.toLowerCase().includes('gemini')) {
          const { presence_penalty, frequency_penalty, ...supportedParameters } = parameters;
          this.parameters = supportedParameters as Parameters;
        } else {
          this.parameters = parameters;
        }
        

        let modelName = this.model
        if(modelName && modelName.includes("/")){
            modelName = modelName.split("/").pop()!;
        }

        if(connection.overwriteContext){
            console.debug("Overwriting context size!");
            this.context = connection.customContext;
            this.overwriteWarning = false;
        }
        else if(contextLimits[modelName]){
            this.context = contextLimits[modelName];
            this.overwriteWarning = false;
        }
        else{
            console.debug(`Warning: couldn't find ${this.model}'s context limit. context overwrite value will be used!`);
            this.context = connection.customContext;
            this.overwriteWarning = true;
        }
        const loggableThis = {
            type: this.type,
            client: {
                baseURL: this.client.baseURL,
                apiKey: '[REDACTED]'
            },
            model: this.model,
            forceInstruct: this.forceInstruct,
            parameters: this.parameters,
            context: this.context,
            overwriteWarning: this.overwriteWarning,
        };
        console.debug("Constructed ApiConnection object:", loggableThis);
    }

    isChat(): boolean {
        console.debug(`--- API CONNECTION: isChat() check. Type: ${this.type}, forceInstruct: ${this.forceInstruct}`);
        if(this.type === "openai" || this.type === "gemini"){
            console.debug("isChat() is returning true");
            return true;
        }
        if((this.type === "openrouter" || this.type === "custom") && !this.forceInstruct){
            console.debug("isChat() is returning true (forceInstruct is false)");
            return true;
        }
        console.debug("isChat() is returning false");
        return false;
    }

    async complete(
        prompt: string | Message[],
        stream: boolean,
        otherArgs: object,
        streamRelay?: (arg1: MessageChunk) => void,
        timeout?: number // Add this parameter
    ): Promise<string> {
        console.debug("--- API CONNECTION: complete() ---");
        console.debug("Prompt:", prompt);
        console.debug(`Stream: ${stream}, otherArgs:`, otherArgs);
        console.debug(`Timeout: ${timeout}ms`); // Log the timeout
        const MAX_RETRIES = 5; // Maximum number of retries
        const RETRY_DELAY = 750; // Initial delay in milliseconds (will increase)
        
        // Helper function for delaying execution
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
        let retries = 0;
    
        while (retries < MAX_RETRIES) {
            console.debug(`Attempt ${retries + 1} of ${MAX_RETRIES}`);
            
            const controller = new AbortController();
            let timeoutId: NodeJS.Timeout | null = null;

            if (timeout && timeout > 0) {
                timeoutId = setTimeout(() => {
                    console.error(`API request timed out after ${timeout}ms.`);
                    controller.abort();
                }, timeout);
            }

            try {
                if (this.type === 'gemini') {
                    const url = stream 
                        ? `${this.client.baseURL}/models/${this.model}:streamGenerateContent?key=${this.client.apiKey}&alt=sse`
                        : `${this.client.baseURL}/models/${this.model}:generateContent?key=${this.client.apiKey}`;

                    // Gemini expects a different message format
                    const contents = (prompt as Message[]).map(msg => {
                        // Gemini roles are 'user' and 'model'
                        const role = msg.role === 'assistant' ? 'model' : 'user';
                        return {
                            role: role,
                            parts: [{ text: msg.content }]
                        };
                    });

                    // Gemini API has some constraints on conversation history.
                    // It must alternate between 'user' and 'model'.
                    // Let's fix it if it doesn't.
                    for (let i = 0; i < contents.length - 1; i++) {
                        if (contents[i].role === contents[i+1].role) {
                            // A bit of a hack: merge consecutive messages from the same role.
                            contents[i+1].parts[0].text = contents[i].parts[0].text + "\n" + contents[i+1].parts[0].text;
                            contents.splice(i, 1);
                            i--; // re-check from the same index
                        }
                    }
                    // The first message must be from a 'user'.
                    if (contents.length > 0 && contents[0].role === 'model') {
                        contents.shift();
                    }


                    const requestBody = {
                        contents: contents,
                        generationConfig: {
                            // map parameters
                            temperature: this.parameters.temperature,
                            topP: this.parameters.top_p,
                            // Gemini doesn't have frequency_penalty or presence_penalty
                            // maxOutputTokens: ??? - not available in otherArgs
                        }
                    };
                    console.debug("Making Gemini request with body:", JSON.stringify(requestBody, null, 2));

                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(requestBody),
                        signal: controller.signal // Pass the signal
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        console.error("Gemini API Error:", errorText);
                        throw new Error(`Gemini API error: ${res.status} ${errorText}`);
                    }

                    if (stream) {
                        const reader = res.body!.getReader();
                        const decoder = new TextDecoder();
                        let responseText = "";
                        let buffer = "";

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || ""; // Keep the last partial line in buffer

                            for (const line of lines) {
                                if (line.startsWith('data: ')) {
                                    try {
                                        const jsonStr = line.substring(6);
                                        const parsed = JSON.parse(jsonStr);
                                        if (parsed.candidates && parsed.candidates[0].content.parts[0].text) {
                                            const textChunk = parsed.candidates[0].content.parts[0].text;
                                            streamRelay!({ content: textChunk });
                                            responseText += textChunk;
                                        }
                                    } catch (e) {
                                        console.error("Error parsing Gemini stream chunk:", e, line);
                                    }
                                }
                            }
                        }
                        return responseText;
                    } else {
                        const data = await res.json();
                        console.debug("Received Gemini non-stream response:", data);
                        if (data.candidates && data.candidates[0].content.parts[0].text) {
                            return data.candidates[0].content.parts[0].text;
                        } else if (data.candidates && data.candidates[0].finishReason === "SAFETY") {
                            throw new Error("Response blocked by Gemini's safety filters.");
                        }
                        else {
                            console.error("Invalid Gemini response:", data);
                            throw new Error("Invalid response from Gemini API");
                        }
                    }
                }
                //OPENAI DOESN'T ALLOW spaces inside message.name so we have to put them inside the Message content.
                if (this.type === "openai") {
                    for (let i = 0; i < prompt.length; i++) {
                        //@ts-ignore
                        if (prompt[i].name) {
                            //@ts-ignore
                            prompt[i].content = prompt[i].name + ": " + prompt[i].content;
    
                            //@ts-ignore
                            delete prompt[i].name;
                        }
                    }
                }
                console.debug("Prompt before sending to API:", prompt);
    
                if (this.isChat()) {
                    const requestBody = {
                        model: this.model,
                        messages: prompt as Message[],
                        stream: stream,
                        ...this.parameters,
                        ...otherArgs
                    };
                    console.debug("Making chat completion request with body:", requestBody);
                    // Pass signal in the options
                    let completion = await this.client.chat.completions.create(requestBody as any, { signal: controller.signal });
    
                    console.debug("Received API response (completion object):", completion);
                    let response: string = "";
    
                    //@ts-ignore
                    if (completion["error"]) {
                        //@ts-ignore
                        throw new Error(completion.error.message);
                    }
    
                    if (stream) {
                        // @ts-ignore
                        for await (const chunk of completion) {
                            let msgChunk: MessageChunk = chunk.choices[0].delta;
                            if (msgChunk.content) {
                                streamRelay!(msgChunk);
                                response += msgChunk.content;
                            }
                        }
                    } else {
                        // @ts-ignore
                        response = completion.choices[0].message.content;
                    }
    
                    console.debug("Parsed response:", response);
                    return response;
                } else {
                    let completion;
        
                    if (this.type === "openrouter") {
                        // Backcompat: use legacy 'prompt' key for OpenRouter sentiment engines
                        const requestBody = {
                            model: this.model,
                            prompt: prompt as string,  // legacy OpenRouter format
                            stream: stream,
                            ...this.parameters,
                            ...otherArgs
                        };
                        console.debug("Making OpenRouter legacy completion request with body:", requestBody);
                        // Pass signal in the options
                        //@ts-ignore
                        completion = await this.client.chat.completions.create(requestBody as any, { signal: controller.signal });
                    } else {
                        // Standard non-chat API
                        const requestBody = {
                            model: this.model,
                            prompt: prompt as string,
                            stream: stream,
                            ...this.parameters,
                            ...otherArgs
                        };
                        console.debug("Making standard completion request with body:", requestBody);
                        completion = await this.client.completions.create(requestBody as any, { signal: controller.signal });
                    }

                    console.debug("Received API response (completion object):", completion);
                    let response: string = "";

                    //@ts-ignore
                    if (completion["error"]) {
                        //@ts-ignore
                        throw new Error(completion.error.message);
                    }

                    if (stream) {
                        // @ts-ignore
                        for await (const chunk of completion) {
                            let msgChunk: MessageChunk = {
                                // @ts-ignore
                                content: chunk.choices[0].text
                            };
                            streamRelay!(msgChunk);

                            response += msgChunk.content;
                        }
                    } else {
                        // Notice: OpenRouter returns response in completion.choices[0].text trough chat endpoint with legacy format
                        if (this.type === "openrouter") {
                            // @ts-ignore
                            response = completion.choices[0].text;
                        } else {
                            // @ts-ignore
                            response = completion.choices[0].text;
                        }
                    }

                    console.debug("Parsed response:", response);
                    if (response === "" || response === undefined || response === null || response === " ") {
                        throw new Error("{code: 599, error: {message: 'No response'}}");
                    }
                    return response;
                }
            } catch (error) {
                console.debug(`--- API CONNECTION: complete() caught an error on attempt ${retries + 1} ---`);
                console.error(error);

                // Handle our custom timeout first and do not retry
                if (error instanceof Error && error.name === 'AbortError') {
                    throw new Error(`API request timed out after ${timeout}ms.`);
                }

                // Narrow down the error type
                if (typeof error === "object" && error !== null && "code" in error && "error" in error) {
                    const typedError = error as {
                        code: number;
                        error?: { message: string };
                    };
            
                    if (
                        typedError.code === 429 &&
                        typedError.error?.message.includes("Provider returned error")
                    ) {
                        retries++;
                        console.debug(
                            `Retry ${retries}/${MAX_RETRIES} after error: ${typedError.error?.message}, delaying for ${
                                RETRY_DELAY * retries
                            }ms`
                        );
                        await delay(RETRY_DELAY * retries); // Exponential backoff
                    } else if (
                        typedError.code === 599 &&
                        typedError.error?.message.includes("No response")
                    ) {
                        retries++;
                        console.debug(
                            `Retry ${retries}/${MAX_RETRIES} after error: ${typedError.error?.message}, delaying for ${
                                RETRY_DELAY * retries
                            }ms`
                        );
                        await delay(RETRY_DELAY * retries); // Exponential backoff
                    } else {
                        console.debug("Unrecoverable error:", error);
                        throw error; // Propagate unrecoverable errors
                    }
                } else {
                    console.debug("Unknown error type:", error);
                    throw error; // If it's not an object or doesn't have the expected properties
                }
            } finally {
                // Always clear the timeout timer
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            }
            
        }
    
        console.debug(`Failed after ${MAX_RETRIES} retries.`);
        //throw new Error(`Unable to complete request after ${MAX_RETRIES} retries.`);
        return ""
    }
    
    async testConnection(): Promise<apiConnectionTestResult>{
        console.debug("--- API CONNECTION: testConnection() ---");
        if (this.type === 'gemini') {
            const url = `${this.client.baseURL}/models/${this.model}:generateContent?key=${this.client.apiKey}`;
            const body = {
                contents: [{ role: "user", parts: [{ text: "ping" }] }]
            };
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const data = await response.json();
                if (data.candidates && data.candidates.length > 0) {
                    return { success: true, overwriteWarning: this.overwriteWarning };
                } else {
                    return { success: false, overwriteWarning: false, errorMessage: data.error?.message || "Invalid response from Gemini" };
                }
            } catch (err) {
                if (err instanceof Error) {
                    return { success: false, overwriteWarning: false, errorMessage: err.message };
                }
                return { success: false, overwriteWarning: false, errorMessage: String(err) };
            }
        }
        let prompt: string | Message[];
        if(this.isChat()){
            prompt = [
                {
                    role: "user",
                    content: "ping"
                }
            ]
        }else{
            prompt = "ping";
        }
        console.debug("Test prompt:", prompt);

        return this.complete(prompt, false, {max_tokens: 1}).then( (resp) =>{
            console.debug("testConnection received response from complete():", resp);
            if(resp){
                return {success: true, overwriteWarning: this.overwriteWarning };
            }
            else{
                return {success: false, overwriteWarning: false, errorMessage: "no response, something went wrong..."};
            }
        }).catch( (err) =>{
            console.debug("testConnection caught an error from complete():", err);
            if (err instanceof Error) {
                return {success: false, overwriteWarning: false, errorMessage: err.message};
            }
            return {success: false, overwriteWarning: false, errorMessage: String(err)};
        });
    }

    calculateTokensFromText(text: string): number{
          return encoder.encode(text).length;
    }

    calculateTokensFromMessage(msg: Message): number{
        let sum = encoder.encode(msg.role).length + encoder.encode(msg.content).length

        if(msg.name){
            sum += encoder.encode(msg.name).length;
        }

        return sum;
    }

    calculateTokensFromChat(chat: Message[]): number{        
        let sum=0;
        for(let msg of chat){
           sum += this.calculateTokensFromMessage(msg);
        }

        return sum;
    }

   
}
