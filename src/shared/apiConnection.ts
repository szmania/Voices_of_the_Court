import { Message, MessageChunk } from "../main/ts/conversation_interfaces";
import OpenAI from "openai";
import { CHATGPT_PROVIDER, getChatGPTAdapter, sanitizeSubscriptionConnection } from './chatgptSubscription';
const contextLimits = require("../../public/contextLimits.json");

export const player2GameKey = '019cb2bb-6704-7d22-89e5-41ce7c765942';
export const player2BaseUrl = 'http://127.0.0.1:4315/v1';

import { getEncoding, Tiktoken } from "js-tiktoken";

// The OpenAI SDK throws APIUserAbortError (not the DOM AbortError) when a request
// is cancelled, either by the user or by our AbortSignal.timeout. The SDK's error
// classes never assign `this.name`, so `error.name` stays 'Error' (inherited from
// Error.prototype); the real class name only exists on `error.constructor.name`.
// This helper checks both so aborts are treated as cancellations, not unexpected errors.
export function isAbortError(error: any): boolean {
    if (!error) return false;
    const name = error.name ?? '';
    const ctorName = error.constructor?.name ?? '';
    return name === 'AbortError' || name === 'APIUserAbortError' ||
        ctorName === 'AbortError' || ctorName === 'APIUserAbortError';
}

/** HTTP status codes that indicate a transient failure worth retrying. */
const RETRYABLE_HTTP_STATUSES: ReadonlySet<number> = new Set([429, 500, 502, 503, 504]);

/**
 * Classifies an embedding HTTP error as transient (retryable) or permanent.
 * Retryable: 429 (rate limit) and 5xx server errors (500/502/503/504).
 * Permanent client errors (400/401/403/404/410), e.g. a dead model ("410 Gone")
 * or a "dimensions must be one of 2048" rejection, return false so callers
 * fail fast instead of burning retries on actionable configuration problems.
 */
export function isRetryableHttpError(err: any): boolean {
    if (!err) return false;
    // Preferred: HTTP status attached by the embedding error paths (err.status).
    const status = (err as any).status ?? (err as any).statusCode;
    if (typeof status === 'number') {
        return RETRYABLE_HTTP_STATUSES.has(status);
    }
    // Fallback: parse the "API error (NNN)" pattern used in embedding error messages.
    const match = /API error \((\d{3})\)/.exec(String((err as any).message ?? ''));
    return !!match && RETRYABLE_HTTP_STATUSES.has(parseInt(match[1], 10));
}

export interface apiConnectionTestResult{
    success: boolean,
    overwriteWarning?: boolean;
    errorMessage?: string,
}

export interface Connection{
    type: string; //openrouter, openai, ooba, gemini, glm, grok
    baseUrl: string;
    key: string;
    model: string;
    forceInstruct: boolean ;//only used by openrouter
    overwriteContext: boolean;
    customContext: number;
    embeddingDimension?: number; // dimension of embedding vectors (default 1536)
    useCustomEmbeddingDimension?: boolean; // only honor embeddingDimension when true
    embeddingInputType?: string; // optional 'input_type' for asymmetric embedding models (e.g. NVIDIA NIM)
    apiKeys?: { [apiType: string]: any }; // 存储所有API类型的配置
}

/** Resolve the effective embedding dimension from a connection config.
 *  Only honors the custom overwrite when explicitly enabled; otherwise
 *  falls back to the standard default (1536). */
export function getEffectiveEmbeddingDimension(connection?: Connection): number {
    if (connection?.useCustomEmbeddingDimension && connection.embeddingDimension) {
        return connection.embeddingDimension;
    }
    return 1536;
}

export interface Parameters{
    temperature?: number,
	frequency_penalty?: number,
	presence_penalty?: number,
	top_p?: number,
}

// Tiktoken encoder is now initialized in main.ts and passed into the constructor.

export class ApiConnection{
    type: string; //openrouter, openai, ooba, custom
    client: any;
    model: string;
    forceInstruct: boolean ;//only used by openrouter
    parameters: Parameters;
    context: number;
    overwriteWarning: boolean;
    config: Connection; // 保存原始配置对象，包括apiKeys
    novelaiAccessToken: string | null = null;
    novelaiTokenExpiry: number | null = null;
    encoder: Tiktoken | null;


    constructor(connection: Connection, parameters: any, encoder: Tiktoken | null){
        sanitizeSubscriptionConnection(connection);
        this.encoder = encoder;
        console.debug("--- API CONNECTION: Constructor ---");

        // Create a deep copy for logging to ensure original object is not modified.
        const redactedConnection = JSON.parse(JSON.stringify(connection));
        redactedConnection.key = '[REDACTED]';
        if (redactedConnection.apiKeys) {
            for (const key in redactedConnection.apiKeys) {
                if (redactedConnection.apiKeys[key] && redactedConnection.apiKeys[key].key) {
                    redactedConnection.apiKeys[key].key = '[REDACTED]';
                }
            }
        }

        console.debug("Received connection:", redactedConnection);
        console.debug("Received parameters:", parameters);

        // 保存原始配置对象，包括apiKeys
        this.config = connection;

        // 如果apiKeys存在，确保所有API类型的配置都被加载
        if (connection.apiKeys) {
            console.log('Loading API keys from config:', Object.keys(connection.apiKeys));
        }

        this.type = connection.type;
        if (this.type === CHATGPT_PROVIDER) {
            this.client = { baseURL: 'https://api.openai.com/v1' };
        } else if (this.type === 'player2') {
            this.client = new OpenAI({
                baseURL: player2BaseUrl,
                apiKey: 'sk-dummy-key', // Player2 uses a dummy key
                dangerouslyAllowBrowser: true,
                defaultHeaders: {
                    'player2-game-key': player2GameKey,
                },
            });
        } else if(this.type !== 'gemini' && this.type !== 'glm'){
            let baseURL = connection.baseUrl;

            this.client = new OpenAI({
                baseURL: baseURL,
                apiKey: connection.key,
                dangerouslyAllowBrowser: true,
                defaultHeaders: {
                    "HTTP-Referer": "https://github.com/szmania/Voices_of_the_Court", // Optional, for including your app on openrouter.ai rankings.
                    "X-Title": "Voices of the Court 2.0 - Community Edition", // Optional. Shows in rankings on openrouter.ai.
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

        const apiParams: Parameters = {};
        if (parameters.enableTemperature) {
            apiParams.temperature = parameters.temperature;
        }
        if (parameters.enableFrequencyPenalty) {
            apiParams.frequency_penalty = parameters.frequency_penalty;
        }
        if (parameters.enablePresencePenalty) {
            apiParams.presence_penalty = parameters.presence_penalty;
        }
        if (parameters.enableTopP) {
            apiParams.top_p = parameters.top_p;
        }
        this.parameters = apiParams;


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
        if (this.type === CHATGPT_PROVIDER) return true;
        console.debug(`--- API CONNECTION: isChat() check. Type: ${this.type}, forceInstruct: ${this.forceInstruct}`);
        if(this.type === "openai" || (this.type === "openrouter" && !this.forceInstruct ) || this.type === "custom" || this.type === 'gemini' || this.type === 'glm' || this.type === 'deepseek' || this.type === 'grok' || this.type === 'player2' || this.type === 'nvidia' || this.type === 'novelai' || this.type === 'anthropic'){
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
        streamRelay?: (arg1: MessageChunk) => void,
        signal?: AbortSignal,
        timeoutMs?: number
    ): Promise<MessageChunk | string | void> {
        if (this.type === CHATGPT_PROVIDER) {
            return getChatGPTAdapter().complete(this.model, prompt, stream, streamRelay, signal, timeoutMs);
        }
        if (this.type === 'novelai') {
            const token = this.config.key;
            const baseHost = 'https://text.novelai.net/oa/v1/completions';

            // Convert VOTC message array into a single text prompt using System, User, and Assistant labels
            const promptString = Array.isArray(prompt)
                ? prompt.map((p: any) => {
                    if (typeof p === 'string') return p;
                    const role = p.role === 'assistant' ? 'Assistant' : p.role === 'system' ? 'System' : 'User';
                    return `${role}: ${p.content ?? ''}`;
                  }).join('\n')
                : (typeof prompt === 'string' ? prompt : '');

            const response = await fetch(baseHost, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    model: this.model,
                    prompt: promptString,
                    stream: false
                }),
                signal: signal
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => String(response.statusText));
                throw new Error(`NovelAI API error: ${response.status} ${errorText}`);
            }

            const data = await response.json();
            const choice = data.choices?.[0];
            const content = choice?.text ?? '';

            // If VOTC requested streaming, pass the completed response through streamRelay
            if (stream && streamRelay) {
                streamRelay({
                    content: content,
                    isFinal: true,
                    special: null
                });
            }

            return content;
        }

        const KNOWN_TYPES = ['openai', 'openrouter', 'custom', 'gemini', 'glm', 'deepseek', 'grok', 'player2', 'nvidia', 'novelai', 'ooba', 'anthropic'];
        if (!KNOWN_TYPES.includes(this.type)) {
            throw new Error(`Unsupported API type: '${this.type}'. Check your connection configuration.`);
        }

        console.debug("--- API CONNECTION: complete() ---");
        console.debug("Prompt:", prompt);
        console.debug(`Stream: ${stream}, otherArgs:`, otherArgs);

        // Apply a default request timeout so a hung provider can't stall initialization.
        // Merged with the caller's abort signal so either one can cancel the request.
        // Background fire-and-forget callers (e.g. post-conversation summarization)
        // can pass a larger timeoutMs so slow providers don't abort mid-request.
        const REQUEST_TIMEOUT_MS = timeoutMs ?? 120_000;
        const MAX_RETRIES = 5; // Maximum number of retries
        const RETRY_DELAY = 750; // Initial delay in milliseconds (will increase)

        // Helper function for delaying execution
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        let retries = 0;

        while (retries < MAX_RETRIES) {
            // Build a FRESH timeout signal per attempt: AbortSignal.timeout stays
            // aborted forever once it fires, so reusing it would make every retry
            // fail instantly instead of getting its own timeout window.
            const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
            const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
            console.debug(`Attempt ${retries + 1} of ${MAX_RETRIES}`);
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
                    if (contents.length > 1) {
                        let i = 0;
                        while (i < contents.length - 1) {
                            if (contents[i].role === contents[i+1].role) {
                                // A bit of a hack: merge consecutive messages from the same role.
                                contents[i+1].parts[0].text = contents[i].parts[0].text + "\n" + contents[i+1].parts[0].text;
                                contents.splice(i, 1);
                                // do not increment i, re-check from the same index
                            } else {
                                i++;
                            }
                        }
                    }
                    // The first message must be from a 'user'.
                    if (contents.length > 0 && contents[0].role === 'model') {
                        contents.shift();
                    }


                    const requestBody: any = {
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
                        signal: requestSignal
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

                if (this.type === 'glm') {
                    // GLM API uses OpenAI-compatible format but requires custom headers
                    const url = stream
                        ? `${this.client.baseURL}/chat/completions`
                        : `${this.client.baseURL}/chat/completions`;

                    // GLM expects standard OpenAI message format but doesn't support system role
                    // Convert system messages to user messages only if there are no user messages
                    const hasUserMessage = (prompt as Message[]).some(msg => msg.role === 'user');
                    const messages = (prompt as Message[]).map(msg => {
                        if (msg.role === 'system' && !hasUserMessage) {
                            return {
                                role: 'user',
                                content: msg.content
                            };
                        }
                        return {
                            role: msg.role,
                            name: msg.name,
                            content: msg.content
                        };
                    });

                    const requestBody = {
                        model: this.model,
                        messages: messages,
                        stream: stream,
                        temperature: this.parameters.temperature,
                        top_p: this.parameters.top_p,
                        frequency_penalty: this.parameters.frequency_penalty,
                        presence_penalty: this.parameters.presence_penalty,
                        thinking: {
                            type: "disabled"
                        },
                        ...otherArgs
                    };
                    console.debug("Making GLM request with body:", JSON.stringify(requestBody, null, 2));

                    const res = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${this.client.apiKey}`
                        },
                        body: JSON.stringify(requestBody),
                        signal: requestSignal
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        console.error("GLM API Error:", errorText);
                        throw new Error(`GLM API error: ${res.status} ${errorText}`);
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
                                        if (jsonStr === '[DONE]') {
                                            continue;
                                        }
                                        const parsed = JSON.parse(jsonStr);
                                        if (parsed.choices && parsed.choices[0].delta.content) {
                                            const textChunk = parsed.choices[0].delta.content;
                                            streamRelay!({ content: textChunk });
                                            responseText += textChunk;
                                        }
                                    } catch (e) {
                                        console.error("Error parsing GLM stream chunk:", e, line);
                                    }
                                }
                            }
                        }
                        return responseText;
                    } else {
                        const data = await res.json();
                        console.debug("Received GLM non-stream response:", data);
                        if (data.choices && data.choices[0].message.content) {
                            return data.choices[0].message.content;
                        } else {
                            console.error("Invalid GLM response:", data);
                            throw new Error("Invalid response from GLM API");
                        }
                    }
                }
                //OPENAI DOESN'T ALLOW spaces inside message.name so we have to put them inside the Message content.
                if (this.type === "openai" || this.type === "player2") {
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
                    // Sanitize messages to include only standard fields (role, content, name)
                    // This prevents 400 errors from strict providers like Cloudflare/glm-5.2
                    // that reject non-standard fields like 'id' or 'type'.
                    const sanitizedMessages = (prompt as Message[]).map(msg => {
                        const cleanMsg: any = {
                            role: msg.role,
                            content: msg.content
                        };
                        if (msg.name && msg.name.trim() !== "") {
                            cleanMsg.name = msg.name;
                        }
                        return cleanMsg;
                    });

                    const requestBody = {
                        model: this.model,
                        messages: sanitizedMessages,
                        stream: stream,
                        ...this.parameters,
                        ...otherArgs
                    };
                    console.debug("Making chat completion request with body:", requestBody);
                    let completion = await this.client.chat.completions.create(requestBody as any, { signal: requestSignal });

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
                        const choice = completion.choices?.[0];
                        if (choice) {
                            // Prefer chat message content, fall back to text field if provided
                            response = choice.message?.content ?? choice.text ?? "";

                            // @ts-ignore
                            const isTest = otherArgs && otherArgs.isTestConnection;

                            // Fallback for some Vertex AI models that return content in a different field during test.
                            if (!response && isTest && choice.message?.reasoning_content) {
                                console.debug("Found response in 'reasoning_content' field during test connection.");
                                response = choice.message.reasoning_content;
                            }
                        }
                    }

                    if (!response || response.trim() === "") {
                        console.error("Empty response parsed from chat completion:", JSON.stringify(completion, null, 2));
                        throw { code: 599, error: { message: "No response" } };
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
                        completion = await this.client.chat.completions.create(requestBody as any, { signal: requestSignal });
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
                        completion = await this.client.completions.create(requestBody as any, { signal: requestSignal });
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
                            // @ts-ignore
                            const textChunk = chunk.choices[0].text ?? chunk.choices[0].delta?.content ?? "";
                            if (textChunk) {
                                let msgChunk: MessageChunk = {
                                    content: textChunk
                                };
                                streamRelay!(msgChunk);
                                response += msgChunk.content;
                            }
                        }
                    } else {
                        // Notice: OpenRouter returns response in completion.choices[0].text trough chat endpoint with legacy format
                        // @ts-ignore
                        const choice = completion.choices?.[0];
                        if (choice) {
                            response = choice.text ?? choice.message?.content ?? "";
                        }
                    }

                    if (!response || response.trim() === "") {
                        console.error("Empty response parsed from completion endpoint:", JSON.stringify(completion, null, 2));
                        throw { code: 599, error: { message: "No response" } };
                    }
                    console.debug("Parsed response:", response);
                    return response;
                }
            } catch (error) {
                if (isAbortError(error)) {
                    if (signal?.aborted) {
                        // Caller's signal was aborted: genuine user cancel, do not retry.
                        console.log('API request was aborted by caller.');
                        throw error;
                    }
                    // No caller signal (or caller signal not aborted): the abort came
                    // from the internal timeout or a network-level abort (e.g. the
                    // server closed the connection). Retry with exponential backoff.
                    retries++;
                    if (retries >= MAX_RETRIES) {
                        console.debug(`Failed after ${MAX_RETRIES} attempts (abort/timeout).`);
                        throw error;
                    }
                    const delayMs = RETRY_DELAY * Math.pow(2, retries);
                    console.warn(`API request aborted (timeout or network), retry ${retries}/${MAX_RETRIES} in ${delayMs}ms`);
                    await delay(delayMs);
                    continue;
                }
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
                                RETRY_DELAY * Math.pow(2, retries)
                            }ms`
                        );
                        await delay(RETRY_DELAY * Math.pow(2, retries)); // Exponential backoff
                    } else if (
                        typedError.code === 599 &&
                        typedError.error?.message.includes("No response")
                    ) {
                        retries++;
                        console.debug(
                            `Retry ${retries}/${MAX_RETRIES} after error: ${typedError.error?.message}, delaying for ${
                                RETRY_DELAY * Math.pow(2, retries)
                            }ms`
                        );
                        await delay(RETRY_DELAY * Math.pow(2, retries)); // Exponential backoff
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

    async listModels(): Promise<any[]> {
        if (this.type === CHATGPT_PROVIDER) return getChatGPTAdapter().models();
        if (this.type === 'novelai') {
            const token = await this.getNovelAIToken();
            const response = await fetch('https://api.novelai.net/ai/model/list', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch NovelAI models');
            }
            const data = await response.json();
            return data.models;
        }
        if (this.type === 'player2') {
            // Player2 does not support listing models.
            // We return a list containing the currently configured model, any saved custom models, and a default.
            const modelIds = new Set<string>();

            if (this.model) {
                modelIds.add(this.model);
            }
            modelIds.add('gpt-oss-120b');

            // Add custom models from config
            if (this.config.apiKeys && this.config.apiKeys.player2 && this.config.apiKeys.player2.customModels) {
                for (const model of this.config.apiKeys.player2.customModels) {
                    modelIds.add(model);
                }
            }

            return Array.from(modelIds).map(id => ({
                id: id,
                owned_by: id === 'gpt-oss-120b' ? 'player2-local' : 'player2-custom'
            }));
        }
        // Return empty for other types for now
        return [];
    }

    async authenticateNovelAI(): Promise<void> {
        console.debug("Authenticating NovelAI...");
        const token = this.config.key; // NovelAI key is now used directly as Persistent API Token
        if (!token) {
            throw new Error("NovelAI token is not set.");
        }

        this.novelaiAccessToken = token;
        // No expiry for persistent tokens
        this.novelaiTokenExpiry = null;
        console.debug("NovelAI token set.");
    }

    async getNovelAIToken(): Promise<string> {
        if (!this.novelaiAccessToken || (this.novelaiTokenExpiry && Date.now() >= this.novelaiTokenExpiry)) {
            await this.authenticateNovelAI();
        }
        if (!this.novelaiAccessToken) {
            throw new Error("NovelAI access token not available after authentication.");
        }
        return this.novelaiAccessToken;
    }

    async testConnection(): Promise<apiConnectionTestResult>{
        if (this.type === CHATGPT_PROVIDER) {
            try {
                await this.complete([{ role: 'user', content: 'Reply with OK.' }], false, {});
                return { success: true, overwriteWarning: this.overwriteWarning };
            } catch (error: any) { return { success: false, errorMessage: error.message }; }
        }
        if (this.type === 'novelai') {
            try {
                const token = this.config.key;
                if (!token) {
                    return { success: false, errorMessage: "NovelAI token is not set." };
                }
                const response = await fetch('https://text.novelai.net/oa/v1/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        model: this.model,
                        prompt: "ping",
                        max_tokens: 1
                    })
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    return { success: false, errorMessage: `NovelAI test failed: ${response.status} ${errorText}` };
                }
                return { success: true, overwriteWarning: this.overwriteWarning };
            } catch (err: any) {
                return { success: false, errorMessage: err.message };
            }
        }
        console.debug("--- API CONNECTION: testConnection() ---");
        if (this.type === 'player2') {
            try {
                const response = await fetch(`${player2BaseUrl}/health`, {
                    method: 'GET',
                    headers: {
                        'player2-game-key': player2GameKey,
                        'Content-Type': 'application/json'
                    }
                });
                if (response.status === 200) {
                    return { success: true, overwriteWarning: this.overwriteWarning };
                } else {
                    const errorText = await response.text();
                    const message = `Player2 health check failed: ${response.status} ${errorText}`;
                    console.error(message);
                    return { success: false, overwriteWarning: false, errorMessage: message };
                }
            } catch (err) {
                if (err instanceof Error) {
                    return { success: false, overwriteWarning: false, errorMessage: err.message };
                }
                return { success: false, overwriteWarning: false, errorMessage: String(err) };
            }
        }
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

        if (this.type === 'glm') {
            const url = `${this.client.baseURL}/chat/completions`;
            const body = {
                model: this.model,
                messages: [{ role: "user", content: "ping" }],
                max_tokens: 1,
                thinking: {
                    type: "disabled"
                }
            };
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.client.apiKey}`
                    },
                    body: JSON.stringify(body)
                });
                const data = await response.json();
                if (data.choices && data.choices.length > 0) {
                    return { success: true, overwriteWarning: this.overwriteWarning };
                } else {
                    return { success: false, overwriteWarning: false, errorMessage: data.error?.message || "Invalid response from GLM" };
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
                    content: "hello"
                }
            ]
        }else{
            prompt = "hello";
        }
        console.debug("Test prompt:", prompt);

        // Test connection should not be cancellable from the UI, so no signal is passed.
        return this.complete(prompt, false, {max_tokens: 10, isTestConnection: true}).then( (resp) =>{
            console.debug("testConnection received response from complete():", resp);
            // A non-empty response is a clear success
            if(resp){
                return {success: true, overwriteWarning: this.overwriteWarning };
            }
            // An empty response is still a success — the API returned 2xx with no body.
            console.log("API returned an empty response");
            return {success: true, overwriteWarning: this.overwriteWarning };

        }).catch( (err) =>{
            console.debug("testConnection caught an error from complete():", err);

            // Specifically handle the "No response" error from `complete()` as a success for testing.
            if (err && err.code === 599 && err.error?.message === "No response") {
                console.log("API returned an empty response");
                return {success: true, overwriteWarning: this.overwriteWarning };
            }

            if (err instanceof Error) {
                return {success: false, overwriteWarning: false, errorMessage: err.message};
            }

            // Handle other structured errors from `complete`
            if (err && err.error && err.error.message) {
                return {success: false, overwriteWarning: false, errorMessage: err.error.message};
            }

            return {success: false, overwriteWarning: false, errorMessage: String(err)};
        });
    }

    calculateTokensFromText(text: string): number{
        if (!this.encoder) return Math.ceil((text || "").length / 4);
        return this.encoder.encode(text).length;
    }

    calculateTokensFromMessage(msg: Message): number{
        if (!this.encoder) return Math.ceil(((msg.role || "") + (msg.content || "") + (msg.name || "")).length / 4);
        let sum = this.encoder.encode(msg.role).length + this.encoder.encode(msg.content).length

        if(msg.name){
            sum += this.encoder.encode(msg.name).length;
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

    async embed(text: string): Promise<number[]> {
        if (this.type === CHATGPT_PROVIDER) throw new Error('ChatGPT subscriptions do not support embeddings. Select a separate embedding provider.');
        // This method acts as a proxy to the EmbeddingProvider, using the connection's own config.
        // This is necessary because other parts of the app use ApiConnection for all remote calls.
        if (!this.config || !this.config.type || !this.config.model || !this.config.baseUrl) {
            throw new Error("ApiConnection is not configured for embedding.");
        }
        const provider = new EmbeddingProvider(
            this.config.type as EmbeddingProviderType,
            this.config.model,
            this.config.baseUrl,
            this.config.key,
            getEffectiveEmbeddingDimension(this.config),
            this.config.embeddingInputType
        );
        return provider.embed(text);
    }
}

// --- Embedding Provider ---

/** Supported embedding provider types */
export type EmbeddingProviderType = 'openai' | 'ollama' | 'onnx' | 'custom' | 'openrouter' | 'deepseek' | 'grok' | 'nvidia' | 'glm' | 'player2' | 'anthropic';

/** Result of an embedding generation request */
export interface EmbeddingResult {
    vector: Float32Array;
    dimensions: number;
    provider: EmbeddingProviderType;
    model: string;
}

/** Result of an embedding connection test */
export interface EmbeddingTestResult {
    success: boolean;
    message: string;
    dimensions?: number;
    provider: EmbeddingProviderType;
    model?: string;
    expectedDimension?: number;
    mismatch?: boolean;
}

/**
 * EmbeddingProvider generates vector embeddings from text using
 * OpenAI, Ollama, or ONNX runtime backends.
 */
export class EmbeddingProvider {
    private provider: EmbeddingProviderType;
    private model: string;
    private baseUrl: string;
    private apiKey: string;
    private expectedDimension?: number;
    private embeddingInputType?: string;

    constructor(provider: EmbeddingProviderType, model: string, baseUrl: string, apiKey: string, expectedDimension?: number, embeddingInputType?: string) {
        this.provider = provider;
        this.model = model;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.expectedDimension = expectedDimension;
        this.embeddingInputType = embeddingInputType;
    }

    /**
     * Generate an embedding vector for the given text.
     * @param text - The input text to embed.
     * @returns An EmbeddingResult containing the vector and metadata.
     */
    async generateEmbedding(text: string): Promise<EmbeddingResult> {
        if (!text || text.trim().length === 0) {
            throw new Error('Cannot generate embedding for empty text.');
        }
        switch (this.provider) {
            case 'ollama':
                return this.embedWithRetry(() => this.generateOllamaEmbedding(text));
            case 'onnx':
                return this.generateOnnxEmbedding(text);
            // All OpenAI-compatible providers (openai, custom, openrouter, deepseek,
            // grok, nvidia, glm, player2, anthropic) use the standard /embeddings endpoint.
            case 'openai':
            case 'custom':
            case 'openrouter':
            case 'deepseek':
            case 'grok':
            case 'nvidia':
            case 'glm':
            case 'player2':
            case 'anthropic':
                return this.embedWithRetry(() => this.generateOpenAIEmbedding(text));
            default:
                throw new Error(`Unsupported embedding provider: ${this.provider}`);
        }
    }

    /**
     * Runs an embedding attempt, retrying transient HTTP failures (429/5xx)
     * with exponential backoff, mirroring the retry pattern used by
     * ApiConnection.complete(). Permanent errors (400/401/403/404/410,
     * unsupported providers, empty input) are rethrown immediately so the
     * original status and response body stay visible in the caller's logs.
     */
    private async embedWithRetry(attemptFn: () => Promise<EmbeddingResult>): Promise<EmbeddingResult> {
        const MAX_RETRIES = 4; // retries after the first attempt -> up to 5 total attempts
        const RETRY_DELAY = 750; // base delay in ms; doubles each retry: 750ms, 1.5s, 3s, 6s
        let retries = 0;
        while (true) {
            try {
                return await attemptFn();
            } catch (error) {
                const retryable = isRetryableHttpError(error);
                if (!retryable || retries >= MAX_RETRIES) {
                    if (retryable) {
                        console.error(`EmbeddingProvider: embedding still failing after ${retries + 1} attempts: ${error instanceof Error ? error.message : String(error)}`);
                    }
                    throw error;
                }
                retries++;
                const delayMs = RETRY_DELAY * Math.pow(2, retries - 1);
                console.warn(`EmbeddingProvider: transient embedding failure, retry ${retries}/${MAX_RETRIES} in ${delayMs}ms: ${error instanceof Error ? error.message : String(error)}`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    /**
     * Test the connection to the configured embedding provider.
     * Sends a minimal embedding request to verify connectivity.
     */
    async testConnection(): Promise<EmbeddingTestResult> {
        try {
            const result = await this.generateEmbedding('test');
            if (this.expectedDimension && result.dimensions !== this.expectedDimension) {
                return {
                    success: false,
                    message: `Overwrite dimension mismatch: requested ${this.expectedDimension} but model returned ${result.dimensions}. Disable "Overwrite embedding dimension" or correct the value.`,
                    dimensions: result.dimensions,
                    provider: this.provider,
                    model: result.model,
                    expectedDimension: this.expectedDimension,
                    mismatch: true
                };
            }
            return {
                success: true,
                message: this.expectedDimension
                    ? `Connection successful. Model: ${result.model}, Dimensions: ${result.dimensions} (matches overwrite).`
                    : `Connection successful. Model: ${result.model}, Dimensions: ${result.dimensions}`,
                dimensions: result.dimensions,
                provider: this.provider,
                model: result.model,
                expectedDimension: this.expectedDimension
            };
        } catch (error: any) {
            return {
                success: false,
                message: error?.message || String(error),
                provider: this.provider
            };
        }
    }

    /**
     * Generate embedding using OpenAI's embeddings API.
     */
    private async generateOpenAIEmbedding(text: string): Promise<EmbeddingResult> {
        const url = `${this.baseUrl}/embeddings`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                input: text,
                ...(this.expectedDimension ? { dimensions: this.expectedDimension } : {}),
                ...(this.embeddingInputType ? { input_type: this.embeddingInputType } : { input_type: 'passage' })
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`OpenAI embedding API error (${response.status}): ${errorText}`);
            // Attach the HTTP status so isRetryableHttpError can classify the failure:
            // 429/5xx get retried; permanent client errors (400/404/410...) fail fast.
            (error as any).status = response.status;
            throw error;
        }

        const data = await response.json();
        const embedding = data.data?.[0]?.embedding;
        if (!embedding || !Array.isArray(embedding)) {
            throw new Error('OpenAI embedding API returned an unexpected response format.');
        }
        return {
            vector: new Float32Array(embedding),
            dimensions: embedding.length,
            provider: this.provider,
            model: this.model
        };
        return {
            vector: new Float32Array(embedding),
            dimensions: embedding.length,
            provider: 'openai',
            model: this.model
        };
    }

    /**
     * Generate embedding using a local Ollama server.
     */
    private async generateOllamaEmbedding(text: string): Promise<EmbeddingResult> {
        const url = `${this.baseUrl}/api/embeddings`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.model,
                prompt: text
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`Ollama embedding API error (${response.status}): ${errorText}`);
            // Attach the HTTP status so isRetryableHttpError can classify the failure.
            (error as any).status = response.status;
            throw error;
        }

        const data = await response.json();
        const embedding = data.embedding;
        if (!embedding || !Array.isArray(embedding)) {
            throw new Error('Ollama embedding API returned an unexpected response format.');
        }

        return {
            vector: new Float32Array(embedding),
            dimensions: embedding.length,
            provider: 'ollama',
            model: this.model
        };
    }

    /**
     * Generate embedding using ONNX runtime (offline).
     * This is a placeholder — actual ONNX integration requires onnxruntime-node.
     */
    private async generateOnnxEmbedding(text: string): Promise<EmbeddingResult> {
        // ONNX runtime requires the optional onnxruntime-node dependency.
        // This is a stub that throws a descriptive error if the dependency is missing.
        try {
            const ort = require('onnxruntime-node');
            // In a full implementation, this would:
            // 1. Tokenize the text using the model's tokenizer
            // 2. Run the ONNX session with the tokenized input
            // 3. Return the pooled embedding vector
            throw new Error(
                'ONNX embedding is not yet fully implemented. ' +
                'The onnxruntime-node package is installed but the model pipeline is not configured. ' +
                'Please use OpenAI or Ollama providers for now.'
            );
        } catch (error: any) {
            if (error?.message?.includes('not yet fully implemented')) {
                throw error;
            }
            throw new Error(
                'ONNX runtime is not available. ' +
                'Install onnxruntime-node as an optional dependency or use OpenAI/Ollama providers. ' +
                `Original error: ${error?.message || String(error)}`
            );
        }
    }

    /**
     * Generate an embedding vector for the given text, returning a simple array.
     * @param text - The input text to embed.
     * @returns A raw array of numbers representing the vector.
     */
    async embed(text: string): Promise<number[]> {
        const result = await this.generateEmbedding(text);
        return Array.from(result.vector);
    }
}
