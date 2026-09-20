// Exercise the real renderer and component in jsdom, with in-memory IPC storage.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { describe, it, afterEach, mock } = require('node:test');
const keysModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../src/shared/promptKeys.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: keysModule.exports });
const { promptKeys, isPromptKey } = keysModule.exports;
// Use Node's loader for jsdom's ESM dependencies; production remains CommonJS.
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../..');
const clone = (value) => JSON.parse(JSON.stringify(value));
const compile = (source) => ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2015, module: ts.ModuleKind.CommonJS, esModuleInterop: true }
}).outputText;
function page(presets = {}, activePreset = 'Default') {
    const dom = new JSDOM(fs.readFileSync(path.join(root, 'public/configWindow/prompts.html'), 'utf8'), {
        url: 'https://votc.test/', runScripts: 'outside-only'
    });
    const context = dom.getInternalVMContext();
    const config = { language: 'en', activePromptPreset: activePreset, inputSequence: 'User:' };
    let stored = clone(presets);
    const listeners = new Map();
    const ipc = {
        invoke: mock.fn(async (channel, value) => {
            switch (channel) {
                case 'get-config': return clone(config);
                case 'get-default-prompts': return JSON.parse(fs.readFileSync(path.join(root, `default_userdata/configs/prompts/${config.language}.json`), 'utf8'));
                case 'get-prompt-presets': return clone(stored);
                case 'save-prompt-presets':
                    stored = clone(value);
                    return { success: true };
                case 'get-all-summary-player-ids': return { success: true, ids: [] };
                case 'get-userdata-path': return '/unused-user-data';
                case 'calculate-tokens': return 1;
                case 'get-context-limit': return 4096;
                default: throw new Error(`Unexpected IPC: ${channel}`);
            }
        }),
        send: mock.fn((channel, key, value) => {
            if (channel === 'config-change')
                config[key] = value;
        }),
        on: (channel, listener) => listeners.set(channel, [...(listeners.get(channel) || []), listener]),
        removeListener: (channel, listener) => listeners.set(channel, (listeners.get(channel) || []).filter(item => item !== listener))
    };
    context.console = { log: mock.fn(), warn: mock.fn(), error: mock.fn() };
    context.setTimeout = () => 0;
    context.LocalizationManager = {
        language: 'en', loadTranslations: async () => { }, applyTranslations: () => { },
        getNestedTranslation: (key, _args, fallback) => fallback || key,
        getTranslation: (key) => key
    };
    dom.window.document.querySelector('#suffix-prompt-checkbox').checkbox = dom.window.document.createElement('input');
    context.require = (name) => {
        if (name === 'electron')
            return { ipcRenderer: ipc };
        if (name.endsWith('/promptKeys'))
            return { promptKeys, isPromptKey };
        if (name === 'path')
            return path;
        if (name === 'fs')
            return { readFileSync: () => '{}', existsSync: () => false };
        throw new Error(`Unexpected import: ${name}`);
    };
    function run(file, source, extra = '') {
        context.exports = {};
        context.__dirname = path.dirname(path.join(root, file));
        vm.runInContext(`(function () { ${compile(source ?? fs.readFileSync(path.join(root, file), 'utf8'))}\n${extra}\n})();`, context);
        return context.exports;
    }
    run('src/configWindow/components/configTextarea.ts');
    const source = fs.readFileSync(path.join(root, 'src/configWindow/promptsRenderer.ts'), 'utf8');
    assert.ok(source.includes('\ninit();'));
    const api = run('src/configWindow/promptsRenderer.ts', source.replace('\ninit();', '\nconst initialization = init();'), 'exports.ready = initialization; exports.save = saveCurrentPreset;');
    const textarea = (key) => dom.window.document.querySelector(`config-textarea[confID="${key}"]`).textarea;
    return { dom, config, ipc, api, textarea, stored: () => clone(stored), errors: context.console.error,
        language: async (language) => {
            config.language = language;
            context.LocalizationManager.language = language;
            await Promise.all((listeners.get('update-language') || []).map(listener => listener({}, language)));
        }
    };
}
describe('prompt preset editor', () => {
    const pages = [];
    function open(presets, active) { const result = page(presets, active); pages.push(result); return result; }
    afterEach(() => { pages.splice(0).forEach(item => item.dom.window.close()); });
    it('loads every prompt without config.prompts and reloads language defaults without stale component writes', async () => {
        const current = open();
        await current.api.ready;
        const en = JSON.parse(fs.readFileSync(path.join(root, 'default_userdata/configs/prompts/en.json'), 'utf8'));
        for (const key of promptKeys)
            assert.equal(current.textarea(key).value, en.prompts[key]);
        assert.equal(current.config.prompts, undefined);
        await current.language('zh');
        const zh = JSON.parse(fs.readFileSync(path.join(root, 'default_userdata/configs/prompts/zh.json'), 'utf8'));
        for (const key of promptKeys)
            assert.equal(current.textarea(key).value, zh.prompts[key]);
        assert.equal(current.errors.mock.callCount(), 0);
    });
    it('saves edited prompts only through presets and preserves them after reload and language change', async () => {
        const current = open();
        await current.api.ready;
        for (const key of promptKeys) {
            const textarea = current.textarea(key);
            textarea.value = `Custom ${key}`;
            textarea.dispatchEvent(new current.dom.window.Event('input'));
            textarea.dispatchEvent(new current.dom.window.Event('change'));
        }
        assert.equal(current.ipc.send.mock.calls.filter(call => isPromptKey(call.arguments[1])).length, 0);
        current.dom.window.document.querySelector('#prompt-preset-name-input').value = 'My preset';
        await current.api.save();
        const reopened = open(current.stored(), 'My preset');
        await reopened.api.ready;
        await reopened.language('zh');
        for (const key of promptKeys)
            assert.equal(reopened.textarea(key).value, `Custom ${key}`);
        assert.equal(reopened.config.prompts, undefined);
        assert.equal(reopened.errors.mock.callCount(), 0);
    });
    it('retains ordinary configuration textarea loading and change events', async () => {
        const current = open();
        await current.api.ready;
        const host = current.dom.window.document.createElement('div');
        host.innerHTML = '<config-textarea confID="inputSequence"></config-textarea>';
        current.dom.window.document.body.append(host);
        await new Promise(resolve => setImmediate(resolve));
        const textarea = host.firstElementChild.textarea;
        assert.equal(textarea.value, 'User:');
        textarea.value = 'Player:';
        textarea.dispatchEvent(new current.dom.window.Event('change'));
        assert.ok(current.ipc.send.mock.calls.some(call => JSON.stringify(call.arguments) === JSON.stringify(['config-change', 'inputSequence', 'Player:'])));
    });
    it('ignores obsolete prompt config-change messages without touching user configuration', () => {
        const source = fs.readFileSync(path.join(root, 'src/main/main.ts'), 'utf8');
        const ast = ts.createSourceFile('main.ts', source, ts.ScriptTarget.Latest, true);
        let callback;
        function visit(node) {
            ts.forEachChild(node, visit);
            if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression))
                return;
            const call = node.expression;
            if (call.expression.getText(ast) === 'ipcMain.on' && call.arguments[0]?.getText(ast) === "'config-change'")
                callback = call.arguments[1];
        }
        visit(ast);
        assert.ok(callback);
        const config = { language: 'en', export: mock.fn() };
        const context = { exports: {}, config, isPromptKey, console: { log: () => { } } };
        vm.runInNewContext(compile(`export const handle = ${callback.getText(ast)};`), context);
        for (const key of promptKeys)
            assert.doesNotThrow(() => context.exports.handle({}, key, 'stale value'));
        assert.deepEqual(Object.keys(config), ['language', 'export']);
        assert.equal(config.export.mock.callCount(), 0);
    });
});
