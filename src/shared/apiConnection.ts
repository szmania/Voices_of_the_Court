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
    forceInstruct: boolean ;//only used by openrouter
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
    client: OpenAI;
    model: string;
    forceInstruct: boolean ;//only used by openrouter
    parameters: Parameters;
    context: number;
    overwriteWarning: boolean;
    

    constructor(connection: Connection, parameters: Parameters){
        console.debug("--- API CONNECTION: Constructor ---");
        const redactedConnection = { ...connection, key: '[REDACTED]' };
        console.debug("Received connection:", redactedConnection);
        console.debug("Received parameters:", parameters);
        this.type = connection.type;
        this.client = new OpenAI({
            baseURL: connection.baseUrl,
            apiKey: connection.key,
            dangerouslyAllowBrowser: true,
            defaultHeaders: {
                "HTTP-Referer": "https://github.com/Demeter29/Voices_of_the_Court", // Optional, for including your app on openrouter.ai rankings.
                "X-Title": "Voices of the Court", // Optional. Shows in rankings on openrouter.ai.
              }
        })
        this.model = connection.model;
        this.forceInstruct = connection.forceInstruct;
        this.parameters = parameters;
        

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
        if(this.type === "openai" || (this.type === "openrouter" && !this.forceInstruct ) || this.type === "other"){
            console.debug("isChat() is returning true");
            return true;
        }
        else{
            console.debug("isChat() is returning false");
            return false;
        }
    
    }

    async complete(
        prompt: string | Message[],
        stream: boolean,
        otherArgs: object,
        streamRelay?: (arg1: MessageChunk) => void
    ): Promise<string> {
        console.debug("--- API CONNECTION: complete() ---");
        console.debug("Prompt:", prompt);
        console.debug(`Stream: ${stream}, otherArgs:`, otherArgs);
        const MAX_RETRIES = 5; // Maximum number of retries
        const RETRY_DELAY = 750; // Initial delay in milliseconds (will increase)
        
        // Helper function for delaying execution
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
        let retries = 0;
    
        while (retries < MAX_RETRIES) {
            console.debug(`Attempt ${retries + 1} of ${MAX_RETRIES}`);
            try {
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
                    let completion = await this.client.chat.completions.create(requestBody as any);
    
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
                        //@ts-ignore
                        completion = await this.client.chat.completions.create(requestBody as any);
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
                        completion = await this.client.completions.create(requestBody as any);
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
            }
            
        }
    
        console.debug(`Failed after ${MAX_RETRIES} retries.`);
        //throw new Error(`Unable to complete request after ${MAX_RETRIES} retries.`);
        return ""
    }
    
    async testConnection(): Promise<apiConnectionTestResult>{
        console.debug("--- API CONNECTION: testConnection() ---");
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
            return {success: false, overwriteWarning: false, errorMessage: err}
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
