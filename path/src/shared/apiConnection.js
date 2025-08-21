"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiConnection = void 0;
const openai_1 = __importDefault(require("openai"));
const contextLimits = require("../../public/contextLimits.json");
const js_tiktoken_1 = __importDefault(require("js-tiktoken"));
let encoder = js_tiktoken_1.default.getEncoding("cl100k_base");
class ApiConnection {
    constructor(connection, parameters) {
        console.debug("--- API CONNECTION: Constructor ---");
        const connectionForLogging = JSON.parse(JSON.stringify(connection));
        if (connectionForLogging.key)
            connectionForLogging.key = "[REDACTED]";
        console.debug("Received connection:", connectionForLogging);
        console.debug("Received parameters:", parameters);
        this.type = connection.type;
        this.client = new openai_1.default({
            baseURL: connection.baseUrl,
            apiKey: connection.key,
            dangerouslyAllowBrowser: true,
            defaultHeaders: {
                "HTTP-Referer": "https://github.com/Demeter29/Voices_of_the_Court", // Optional, for including your app on openrouter.ai rankings.
                "X-Title": "Voices of the Court", // Optional. Shows in rankings on openrouter.ai.
            }
        });
        this.model = connection.model;
        this.forceInstruct = this.forceInstruct;
        this.parameters = parameters;
        let modelName = this.model;
        if (modelName && modelName.includes("/")) {
            modelName = modelName.split("/").pop();
        }
        if (connection.overwriteContext) {
            console.debug("Overwriting context size!");
            this.context = connection.customContext;
            this.overwriteWarning = false;
        }
        else if (contextLimits[modelName]) {
            this.context = contextLimits[modelName];
            this.overwriteWarning = false;
        }
        else {
            console.debug(`Warning: couldn't find ${this.model}'s context limit. context overwrite value will be used!`);
            this.context = connection.customContext;
            this.overwriteWarning = true;
        }
        const safeThisForLogging = {
            type: this.type,
            model: this.model,
            forceInstruct: this.forceInstruct,
            parameters: this.parameters,
            context: this.context,
            overwriteWarning: this.overwriteWarning,
            client: {
                baseURL: this.client.baseURL,
                apiKey: '[REDACTED]'
            }
        };
        console.debug("Constructed ApiConnection object:", safeThisForLogging);
    }
    isChat() {
        console.debug(`--- API CONNECTION: isChat() check. Type: ${this.type}, forceInstruct: ${this.forceInstruct}`);
        if (this.type === "openai" || (this.type === "openrouter" && !this.forceInstruct) || this.type === "other") {
            console.debug("isChat() is returning true");
            return true;
        }
        else {
            console.debug("isChat() is returning false");
            return false;
        }
    }
    complete(prompt, stream, otherArgs, streamRelay) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c, _d, e_2, _e, _f;
            var _g, _h, _j, _k;
            console.debug("--- API CONNECTION: complete() ---");
            console.debug("Prompt:", prompt);
            console.debug(`Stream: ${stream}, otherArgs:`, otherArgs);
            const MAX_RETRIES = 5; // Maximum number of retries
            const RETRY_DELAY = 750; // Initial delay in milliseconds (will increase)
            // Helper function for delaying execution
            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
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
                        const requestBody = Object.assign(Object.assign({ model: this.model, messages: prompt, stream: stream }, this.parameters), otherArgs);
                        console.debug("Making chat completion request with body:", requestBody);
                        let completion = yield this.client.chat.completions.create(requestBody);
                        console.debug("Received API response (completion object):", completion);
                        let response = "";
                        //@ts-ignore
                        if (completion["error"]) {
                            //@ts-ignore
                            throw new Error(completion.error.message);
                        }
                        if (stream) {
                            try {
                                // @ts-ignore
                                for (var _l = true, completion_1 = (e_1 = void 0, __asyncValues(completion)), completion_1_1; completion_1_1 = yield completion_1.next(), _a = completion_1_1.done, !_a; _l = true) {
                                    _c = completion_1_1.value;
                                    _l = false;
                                    const chunk = _c;
                                    let msgChunk = chunk.choices[0].delta;
                                    if (msgChunk.content) {
                                        streamRelay(msgChunk);
                                        response += msgChunk.content;
                                    }
                                }
                            }
                            catch (e_1_1) { e_1 = { error: e_1_1 }; }
                            finally {
                                try {
                                    if (!_l && !_a && (_b = completion_1.return)) yield _b.call(completion_1);
                                }
                                finally { if (e_1) throw e_1.error; }
                            }
                        }
                        else {
                            // @ts-ignore
                            response = completion.choices[0].message.content;
                        }
                        console.debug("Parsed response:", response);
                        return response;
                    }
                    else {
                        let completion;
                        if (this.type === "openrouter") {
                            const requestBody = Object.assign(Object.assign({ model: this.model, messages: [{ role: 'user', content: prompt }], stream: stream }, this.parameters), otherArgs);
                            console.debug("Making legacy completion request (via chat endpoint for openrouter instruct) with body:", requestBody);
                            completion = yield this.client.chat.completions.create(requestBody);
                        }
                        else {
                            const requestBody = Object.assign(Object.assign({ model: this.model, prompt: prompt, stream: stream }, this.parameters), otherArgs);
                            console.debug("Making legacy completion request with body:", requestBody);
                            completion = yield this.client.completions.create(requestBody);
                        }
                        console.debug("Received API response (completion object):", completion);
                        let response = "";
                        //@ts-ignore
                        if (completion["error"]) {
                            //@ts-ignore
                            throw new Error(completion.error.message);
                        }
                        if (stream) {
                            try {
                                // @ts-ignore
                                for (var _m = true, completion_2 = (e_2 = void 0, __asyncValues(completion)), completion_2_1; completion_2_1 = yield completion_2.next(), _d = completion_2_1.done, !_d; _m = true) {
                                    _f = completion_2_1.value;
                                    _m = false;
                                    const chunk = _f;
                                    let msgChunk = {
                                        // @ts-ignore
                                        content: chunk.choices[0].text
                                    };
                                    streamRelay(msgChunk);
                                    response += msgChunk.content;
                                }
                            }
                            catch (e_2_1) { e_2 = { error: e_2_1 }; }
                            finally {
                                try {
                                    if (!_m && !_d && (_e = completion_2.return)) yield _e.call(completion_2);
                                }
                                finally { if (e_2) throw e_2.error; }
                            }
                        }
                        else {
                            // @ts-ignore
                            response = completion.choices[0].text;
                        }
                        console.debug("Parsed response:", response);
                        if (response === "" || response === undefined || response === null || response === " ") {
                            throw new Error("{code: 599, error: {message: 'No response'}}");
                        }
                        return response;
                    }
                }
                catch (error) {
                    console.debug(`--- API CONNECTION: complete() caught an error on attempt ${retries + 1} ---`);
                    console.debug(error);
                    // Narrow down the error type
                    if (typeof error === "object" && error !== null && "code" in error && "error" in error) {
                        const typedError = error;
                        if (typedError.code === 429 &&
                            ((_g = typedError.error) === null || _g === void 0 ? void 0 : _g.message.includes("Provider returned error"))) {
                            retries++;
                            console.debug(`Retry ${retries}/${MAX_RETRIES} after error: ${(_h = typedError.error) === null || _h === void 0 ? void 0 : _h.message}, delaying for ${RETRY_DELAY * retries}ms`);
                            yield delay(RETRY_DELAY * retries); // Exponential backoff
                        }
                        else if (typedError.code === 599 &&
                            ((_j = typedError.error) === null || _j === void 0 ? void 0 : _j.message.includes("No response"))) {
                            retries++;
                            console.debug(`Retry ${retries}/${MAX_RETRIES} after error: ${(_k = typedError.error) === null || _k === void 0 ? void 0 : _k.message}, delaying for ${RETRY_DELAY * retries}ms`);
                            yield delay(RETRY_DELAY * retries); // Exponential backoff
                        }
                        else {
                            console.debug("Unrecoverable error:", error);
                            throw error; // Propagate unrecoverable errors
                        }
                    }
                    else {
                        console.debug("Unknown error type:", error);
                        throw error; // If it's not an object or doesn't have the expected properties
                    }
                }
            }
            console.debug(`Failed after ${MAX_RETRIES} retries.`);
            //throw new Error(`Unable to complete request after ${MAX_RETRIES} retries.`);
            return "";
        });
    }
    testConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            console.debug("--- API CONNECTION: testConnection() ---");
            let prompt;
            if (this.isChat()) {
                prompt = [
                    {
                        role: "user",
                        content: "ping"
                    }
                ];
            }
            else {
                prompt = "ping";
            }
            console.debug("Test prompt:", prompt);
            return this.complete(prompt, false, { max_tokens: 1 }).then((resp) => {
                console.debug("testConnection received response from complete():", resp);
                if (resp) {
                    return { success: true, overwriteWarning: this.overwriteWarning };
                }
                else {
                    return { success: false, overwriteWarning: false, errorMessage: "no response, something went wrong..." };
                }
            }).catch((err) => {
                console.debug("testConnection caught an error from complete():", err);
                return { success: false, overwriteWarning: false, errorMessage: err };
            });
        });
    }
    calculateTokensFromText(text) {
        return encoder.encode(text).length;
    }
    calculateTokensFromMessage(msg) {
        let sum = encoder.encode(msg.role).length + encoder.encode(msg.content).length;
        if (msg.name) {
            sum += encoder.encode(msg.name).length;
        }
        return sum;
    }
    calculateTokensFromChat(chat) {
        let sum = 0;
        for (let msg of chat) {
            sum += this.calculateTokensFromMessage(msg);
        }
        return sum;
    }
}
exports.ApiConnection = ApiConnection;
//# sourceMappingURL=apiConnection.js.map