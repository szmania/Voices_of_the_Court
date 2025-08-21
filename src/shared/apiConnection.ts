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
        console.log("--- API CONNECTION: Constructor ---");
        console.log("Received connection:", connection);
        console.log("Received parameters:", parameters);
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
            console.log("Overwriting context size!");
            this.context = connection.customContext;
            this.overwriteWarning = false;
        }
        else if(contextLimits[modelName]){
            this.context = contextLimits[modelName];
            this.overwriteWarning = false;
        }
        else{
            console.log(`Warning: couldn't find ${this.model}'s context limit. context overwrite value will be used!`);
            this.context = connection.customContext;
            this.overwriteWarning = true;
        }
        console.log("Constructed ApiConnection object:", this);
    }

    isChat(): boolean {
        console.log(`--- API CONNECTION: isChat() check. Type: ${this.type}, forceInstruct: ${this.forceInstruct}`);
        if(this.type === "openai" || (this.type === "openrouter" && !this.forceInstruct ) || this.type === "custom"){
            console.log("isChat() is returning true");
            return true;
        }
        else{
            console.log("isChat() is returning false");
            return false;
        }
    
    }

    async complete(
        prompt: string | Message[],
        stream: boolean,
        otherArgs: object,
        streamRelay?: (arg1: MessageChunk) => void
    ): Promise<string> {
        console.log("--- API CONNECTION: complete() ---");
        console.log("Prompt:", prompt);
        console.log(`Stream: ${stream}, otherArgs:`, otherArgs);
        const MAX_RETRIES = 5; // Maximum number of retries
        const RETRY_DELAY = 750; // Initial delay in milliseconds (will increase)
        
        // Helper function for delaying execution
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
        let retries = 0;
    
        while (retries < MAX_RETRIES) {
            console.log(`Attempt ${retries + 1} of ${MAX_RETRIES}`);
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
                console.log("Prompt before sending to API:", prompt);
    
                if (this.isChat()) {
                    const requestBody = {
                        model: this.model,
                        messages: prompt as Message[],
                        stream: stream,
                        ...this.parameters,
                        ...otherArgs
                    };
                    console.log("Making chat completion request with body:", requestBody);
                    let completion = await this.client.chat.completions.create(requestBody as any);
    
                    console.log("Received API response (completion object):", completion);
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
    
                    console.log("Parsed response:", response);
                    return response;
                } else {
                    let completion;
    
                    if (this.type === "openrouter") {
                        const requestBody = {
                            model: this.model,
                            messages: [{role: 'user', content: prompt as string}],
                            stream: stream,
                            ...this.parameters,
                            ...otherArgs
                        };
                        console.log("Making legacy completion request (via chat endpoint for openrouter instruct) with body:", requestBody);
                        completion = await this.client.chat.completions.create(requestBody as any);
                    } else {
                        const requestBody = {
                            model: this.model,
                            prompt: prompt as string,
                            stream: stream,
                            ...this.parameters,
                            ...otherArgs
                        };
                        console.log("Making legacy completion request with body:", requestBody);
                        completion = await this.client.completions.create(requestBody as any);
                    }
    
                    console.log("Received API response (completion object):", completion);
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
                        // @ts-ignore
                        response = completion.choices[0].text;
                    }
    
                    console.log("Parsed response:", response);
                    if (response === "" || response === undefined || response === null || response === " ") {
                        throw new Error("{code: 599, error: {message: 'No response'}}");
                    }
                    return response;
                }
            } catch (error) {
                console.error(`--- API CONNECTION: complete() caught an error on attempt ${retries + 1} ---`);
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
                        console.warn(
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
                        console.warn(
                            `Retry ${retries}/${MAX_RETRIES} after error: ${typedError.error?.message}, delaying for ${
                                RETRY_DELAY * retries
                            }ms`
                        );
                        await delay(RETRY_DELAY * retries); // Exponential backoff
                    } else {
                        console.error("Unrecoverable error:", error);
                        throw error; // Propagate unrecoverable errors
                    }
                } else {
                    console.error("Unknown error type:", error);
                    throw error; // If it's not an object or doesn't have the expected properties
                }
            }
            
        }
    
        console.error(`Failed after ${MAX_RETRIES} retries.`);
        //throw new Error(`Unable to complete request after ${MAX_RETRIES} retries.`);
        return ""
    }
    
    async testConnection(): Promise<apiConnectionTestResult>{
        console.log("--- API CONNECTION: testConnection() ---");
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
        console.log("Test prompt:", prompt);

        return this.complete(prompt, false, {max_tokens: 1}).then( (resp) =>{
            console.log("testConnection received response from complete():", resp);
            if(resp){
                return {success: true, overwriteWarning: this.overwriteWarning };
            }
            else{
                return {success: false, overwriteWarning: false, errorMessage: "no response, something went wrong..."};
            }
        }).catch( (err) =>{
            console.error("testConnection caught an error from complete():", err);
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
