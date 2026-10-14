const { JSDOM } = require('jsdom');
const { it } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
function page(selectors = false) {
    const dom = new JSDOM('<div id="host"></div>', { runScripts: 'outside-only', url: 'https://votc.test' });
    const context = dom.getInternalVMContext();
    const listeners = new Map(); const sent = [];
    const config = { textGenerationApiConnectionConfig: { connection: { type: 'openai_chatgpt', model: 'saved-model' } } };
    config.embeddingApiConnectionConfig = { connection: { type: 'openai', model: 'embedding-model', key: 'existing-key' } };
    const ipc = {
        on: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
        removeListener: (name, fn) => listeners.get(name)?.delete(fn),
        invoke: async name => name === 'get-config' ? config : name.endsWith(':models') ?
            { ok: true, value: [{ id: 'first-model', name: 'First' }, { id: 'saved-model', name: 'Saved' }] } :
            { ok: true, value: { signedIn: true, planEnabled: true, persistent: true, pending: false, usageLimited: false } },
        send: (...args) => { sent.push(args); }
    };
    const shared = { CHATGPT_PROVIDER: 'openai_chatgpt', CHATGPT_USAGE_URL: 'https://chatgpt.com/settings/usage' };
    const code = ts.transpileModule(fs.readFileSync(path.join(root, 'src/configWindow/components/ChatGPTSettings.ts'), 'utf8'),
        { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
    context.exports = {}; context.require = name => name === 'electron' ? { ipcRenderer: ipc } : shared;
    vm.runInContext(code, context);
    if (selectors) {
        context.require = name => name === 'electron' ? { ipcRenderer: ipc } : {};
        const selector = ts.transpileModule(fs.readFileSync(path.join(root, 'src/configWindow/components/apiSelector.ts'), 'utf8'),
            { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
        vm.runInContext('(function () {' + selector + '\n})()', context);
        dom.window.document.getElementById('host').innerHTML = `<config-api-selector confID="textGenerationApiConnectionConfig"></config-api-selector>
            <config-api-selector confID="embeddingApiConnectionConfig"></config-api-selector>`;
        return { dom, listeners, config, sent };
    }
    const host = dom.window.document.getElementById('host'); host.confID = 'textGenerationApiConnectionConfig';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<chatgpt-settings></chatgpt-settings>';
    const element = shadow.firstElementChild;
    return { dom, listeners, config, element, sent };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
it('loads real settings, preserves a valid model, and saves model changes without tokens', async () => {
    const h = page(); await settle(); await settle();
    const select = h.element.shadowRoot.querySelector('select');
    assert.equal(select.value, 'saved-model');
    select.value = 'first-model'; select.dispatchEvent(new h.dom.window.Event('change'));
    await settle();
    assert(h.sent.some(args => args[0] === 'config-change-nested-nested' && args[4] === 'first-model'));
    assert(!JSON.stringify(h.sent).includes('accessToken'));
    h.dom.window.close();
});
it('shows a replacement notice for an unavailable saved model and removes IPC listeners', async () => {
    const h = page(); h.config.textGenerationApiConnectionConfig.connection.model = 'removed-model';
    await settle(); await settle();
    assert.equal(h.element.shadowRoot.querySelector('select').value, 'first-model');
    assert.match(h.element.shadowRoot.querySelector('#error').textContent, /saved model is unavailable/);
    h.element.remove();
    assert.equal(h.listeners.get('openai-chatgpt:changed').size, 0);
    assert.equal(h.listeners.get('update-language').size, 0);
    h.dom.window.close();
});
it('connects the real text selector and excludes subscription from embeddings', async () => {
    const h = page(true); await settle(); await settle();
    const [text, embedding] = h.dom.window.document.querySelectorAll('config-api-selector');
    assert.equal(text.shadowRoot.querySelector('#connection-api').value, 'openai_chatgpt');
    assert.equal(text.shadowRoot.querySelector('#chatgpt-menu').style.display, 'block');
    assert.equal(text.shadowRoot.querySelector('chatgpt-settings').shadowRoot.querySelector('select').value, 'saved-model');
    assert.equal(embedding.shadowRoot.querySelector('option[value="openai_chatgpt"]'), null);
    assert(h.sent.some(args => args[0] === 'config-change-nested-nested' && args[1] === 'textGenerationApiConnectionConfig'));
    h.dom.window.close();
});
it('switches to subscription without overwriting the latest provider cache', async () => {
    const h = page(true); await settle(); await settle();
    const [text] = h.dom.window.document.querySelectorAll('config-api-selector');
    h.config.textGenerationApiConnectionConfig.connection.apiKeys = { openai: { key: 'newly-saved-key' } };
    const select = text.shadowRoot.querySelector('#connection-api');
    select.value = 'openai_chatgpt'; select.dispatchEvent(new h.dom.window.Event('change'));
    const change = h.sent.find(args => args[0] === 'config-change-nested' && args[2] === 'connection');
    assert(change);
    assert.equal(change[3].type, 'openai_chatgpt');
    // The main process preserves its current cache when the replacement omits this field.
    assert.equal(Object.hasOwn(change[3], 'apiKeys'), false);
    h.dom.window.close();
});
