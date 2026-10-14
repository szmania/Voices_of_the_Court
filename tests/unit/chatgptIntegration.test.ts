import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import { ApiConnection } from '../../src/shared/apiConnection';
import { Config } from '../../src/shared/Config';
import { CHATGPT_PROVIDER, setChatGPTAdapter } from '../../src/shared/chatgptSubscription';
import { registerChatGPTIpc, TEXT_CONNECTIONS } from '../../src/main/auth/chatgptIpc';
import ts from 'typescript';

const connection = () => ({ type: CHATGPT_PROVIDER, baseUrl: 'https://bad.example', key: 'never-persist-this',
    model: 'model-1', forceInstruct: false, overwriteContext: true, customContext: 16000,
    access_token: 'never-persist-access', apiKeys: { openai: { key: 'existing-api-key' },
        openai_chatgpt: { model: 'model-1', accessToken: 'never-persist-cache' } } });
beforeEach(() => jest.spyOn(console, 'debug').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());
it('uses the same adapter for every text connection while filtering legacy arguments and blocking embeddings', async () => {
    const complete = jest.fn(async (..._args: any[]) => 'Complete answer');
    setChatGPTAdapter({ complete, models: async () => [{ id: 'model-1', name: 'Model' }] });
    for (const id of TEXT_CONNECTIONS) {
        const api = new ApiConnection(connection(), { enableTemperature: true, temperature: 0.9 }, null);
        expect(api.isChat()).toBe(true);
        await expect(api.complete([{ role: 'user', content: id }], false,
            { temperature: 0.9, max_tokens: 32, stop: ['stop'], isTestConnection: true })).resolves.toBe('Complete answer');
        expect(complete.mock.calls.at(-1)).toHaveLength(6);
        expect(complete.mock.calls.at(-1)?.[0]).toBe('model-1');
        expect(api.context).toBe(16000);
        await expect(api.embed('text')).rejects.toThrow('separate embedding');
    }
});
it('configuration reload/export contains no OAuth credentials and preserves existing API keys', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'votc-config-test-'));
    try {
        await fs.mkdir(path.join(directory, 'votc_data', 'configs'), { recursive: true });
        (app.getPath as jest.Mock).mockReturnValue(directory);
        const file = path.join(directory, 'votc_data', 'configs', 'config.json');
        await fs.writeFile(file, JSON.stringify({ textGenerationApiConnectionConfig: { connection: connection(), parameters: {} } }));
        const config = new Config(file); config.export();
        const saved = await fs.readFile(file, 'utf8');
        expect(saved).not.toContain('never-persist');
        expect(saved).toContain('existing-api-key');
        expect(new Config(file).textGenerationApiConnectionConfig.connection.type).toBe(CHATGPT_PROVIDER);
        expect(new Config(file).embeddingApiConnectionConfig.connection.type).toBe('openai');
        expect(JSON.stringify(config.toSafeConfig())).not.toContain('existing-api-key');
    } finally { await fs.rm(directory, { recursive: true, force: true }); }
});
it('settings IPC denies other senders, validates arguments, and never exposes underlying errors', async () => {
    const handlers = new Map<string, (...args: any[]) => any>();
    const auth = { status: () => ({ signedIn: true }), startLogin: jest.fn(), cancelLogin: jest.fn(),
        logout: jest.fn(), clearUsageLimit: jest.fn() };
    const models = jest.fn(async () => { throw new Error('synthetic-secret in diagnostic'); });
    registerChatGPTIpc({ handle: (channel, fn) => handlers.set(channel, fn) }, auth as any, { models } as any,
        event => event.trusted === true, async () => ({ type: CHATGPT_PROVIDER, testConnection: async () => ({ success: true }) } as any));
    expect((await handlers.get('openai-chatgpt:status')!({})).ok).toBe(false);
    expect((await handlers.get('openai-chatgpt:status')!({ trusted: true }, 'extra')).ok).toBe(false);
    expect((await handlers.get('openai-chatgpt:start-login')!({ trusted: true }, { url: 'https://bad.example' })).ok).toBe(false);
    expect((await handlers.get('openai-chatgpt:test-connection')!({ trusted: true }, 'embeddingApiConnectionConfig')).ok).toBe(false);
    expect((await handlers.get('openai-chatgpt:test-connection')!({ trusted: true }, TEXT_CONNECTIONS[0])).value.success).toBe(true);
    expect(JSON.stringify(await handlers.get('openai-chatgpt:models')!({ trusted: true }))).not.toContain('synthetic-secret');
});
it('conversation validation does not replay subscription failures or completed invalid replies', async () => {
    const source = await fs.readFile(path.join(__dirname, '../../src/main/conversation/Conversation.ts'), 'utf8');
    const ast = ts.createSourceFile('Conversation.ts', source, ts.ScriptTarget.Latest, true);
    const cls = ast.statements.find(ts.isClassDeclaration)!;
    const method = cls.members.find(member => ts.isMethodDeclaration(member) &&
        member.name.getText(ast) === 'generateNewAIMessageWithValidation')!;
    const js = ts.transpileModule(`class Subject { ${method.getText(ast)} }`,
        { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    const Subject = new Function('isAbortError', js + '; return Subject;')(() => false);
    for (const fails of [false, true]) {
        const subject = new Subject();
        subject.config = { stream: false };
        subject.gameData = { characters: new Map([[1, {}], [2, {}], [3, {}]]) };
        subject.textGenApiConnection = { type: CHATGPT_PROVIDER };
        const failure = new Error('Interrupted stream');
        subject.generateNewAIMessage = jest.fn(async () => { if (fails) throw failure; return { content: 'Completed text' }; });
        subject.generateMessageWithValidationPrompt = jest.fn();
        subject.validateCharacterIdentity = async () => false;
        subject.chatWindow = { window: { webContents: { send: jest.fn() } } };
        const result = subject.generateNewAIMessageWithValidation({ fullName: 'King' });
        if (fails) await expect(result).rejects.toBe(failure);
        else await expect(result).resolves.toBeNull();
        expect(subject.generateNewAIMessage).toHaveBeenCalledTimes(1);
        expect(subject.generateMessageWithValidationPrompt).not.toHaveBeenCalled();
    }
});
it.each(['error-message', 'generation-cancelled'])('keeps a completed reply when a later reply receives %s', async failure => {
    const source = await fs.readFile(path.join(__dirname, '../../src/chatWindow/chatRenderer.ts'), 'utf8');
    const ast = ts.createSourceFile('chatRenderer.ts', source, ts.ScriptTarget.Latest, true);
    const channels = ['stream-start', 'stream-message', failure];
    const statements = ast.statements.filter(statement =>
        ts.isFunctionDeclaration(statement) && statement.name?.text === 'discardProvisionalMessages' ||
        ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) &&
        statement.expression.expression.getText(ast) === 'ipcRenderer.on' &&
        channels.includes((statement.expression.arguments[0] as ts.StringLiteral).text));
    const code = ts.transpileModule(statements.map(statement => statement.getText(ast)).join('\n'),
        { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    const elements: any[] = [];
    const document = { createElement: () => {
        const element = { dataset: {} as any, classList: { add: () => {} },
            removeAttribute: () => { delete element.dataset.provisional; },
            remove: () => { elements.splice(elements.indexOf(element), 1); } };
        return element;
    } };
    const chatMessages = { append: (element: any) => elements.push(element),
        get lastElementChild() { return elements.at(-1); },
        querySelectorAll: () => elements.filter(element => element.dataset.provisional) };
    const handlers = new Map<string, (...args: any[]) => any>();
    const install = new Function('ipcRenderer', 'document', 'window', 'chatMessages', 'replaceLastMessage',
        'removeLoadingDots', 'showLoadingDots', 'displayErrorMessage', 'updateRegenerateButtonState',
        `let aiInitiatorId; ${code}`);
    install({ on: (channel: string, handler: any) => handlers.set(channel, handler) }, document, {}, chatMessages,
        (message: any) => { elements.at(-1).content = message.content; }, () => {}, () => {}, () => {}, () => {});
    handlers.get('stream-start')!({});
    handlers.get('stream-message')!({}, { content: 'Completed king reply' }, true);
    handlers.get('stream-start')!({});
    handlers.get('stream-message')!({}, { content: 'Interrupted queen reply' });
    handlers.get(failure)!({}, 'Interrupted');
    expect(elements.filter(element => element.content).map(element => element.content)).toEqual(['Completed king reply']);
});
