/**
 * Lightweight test framework for Voices of the Court input field tests.
 * Provides DOM mocking, IPC simulation, and assertion helpers.
 */

const assert = require('assert');

// ─── Test Runner ───────────────────────────────────────────────────────────

class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.currentSuite = '';
    }

    /** Register a test suite */
    suite(name) {
        this.currentSuite = name;
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  SUITE: ${name}`);
        console.log(`${'='.repeat(60)}`);
    }

    /** Run a single test case */
    test(name, fn) {
        this.tests.push({ suite: this.currentSuite, name, fn });
    }

    /** Execute all registered tests */
    async run() {
        console.log('\n' + '='.repeat(60));
        console.log('  VOTC INPUT FIELD TEST SUITE');
        console.log('  Task: VOTC-147 - Input Field Unresponsive Fix');
        console.log('='.repeat(60));

        for (const t of this.tests) {
            try {
                await t.fn();
                this.passed++;
                console.log(`  ✓ PASS: ${t.name}`);
            } catch (err) {
                this.failed++;
                console.log(`  ✗ FAIL: ${t.name}`);
                console.log(`    Error: ${err.message}`);
            }
        }

        const total = this.passed + this.failed;
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  RESULTS: ${this.passed}/${total} passed` + 
                    (this.failed > 0 ? `, ${this.failed} failed` : ''));
        console.log(`${'='.repeat(60)}`);

        if (this.failed > 0) {
            process.exitCode = 1;
        }

        return { passed: this.passed, failed: this.failed, total };
    }
}

// ─── DOM Mock ───────────────────────────────────────────────────────────────

/**
 * Creates a mock DOM environment for testing chatRenderer functions.
 * Simulates the chat input field, loading dots overlay, and theme classes.
 */
function createMockDOM() {
    const eventListeners = {};
    const webContentsEvents = {};

    const dom = {
        chatInput: {
            disabled: false,
            value: '',
            title: '',
            style: { cursor: '' },
            innerHTML: '',
            focus() {},
            addEventListener(event, handler) {
                if (!eventListeners[event]) eventListeners[event] = [];
                eventListeners[event].push({ target: 'chatInput', handler });
            },
            classList: new Set(),
            parentNode: null
        },

        loadingDots: null,

        chatMessages: {
            innerHTML: '',
            children: [],
            append(child) { this.children.push(child); },
            get lastElementChild() {
                return this.children.length > 0 ? this.children[this.children.length - 1] : null;
            },
            scrollTop: 0,
            get scrollHeight() { return 0; },
            querySelectorAll(selector) { return []; },
            removeChild(child) {
                const idx = this.children.indexOf(child);
                if (idx !== -1) this.children.splice(idx, 1);
            },
            get parentNode() { return null; },
            addEventListener() {},
            classList: new Set()
        },

        cancelButtonWrapper: {
            classList: {
                _classes: new Set(),
                add(cls) { this._classes.add(cls); },
                remove(cls) { this._classes.delete(cls); },
                contains(cls) { return this._classes.has(cls); }
            },
            setAttribute() {},
            style: { display: '' }
        },

        suggestionsList: {
            innerHTML: '',
            append(child) {},
            style: {}
        },

        suggestionsContainer: {
            style: { display: '' }
        },

        documentBody: {
            classList: {
                _classes: new Set(['theme-normal']),
                add(cls) { this._classes.add(cls); },
                remove(cls) { this._classes.delete(cls); },
                contains(cls) { return this._classes.has(cls); }
            },
            style: { display: '' }
        },

        // Track console output for assertions
        consoleLogs: [],
        consoleErrors: [],

        // Track IPC messages sent/received
        ipcSent: [],
        ipcReceived: [],

        // Theme state
        currentTheme: 'normal',

        // Simulate theme change
        setTheme(themeName) {
            this.currentTheme = themeName;
            this.documentBody.classList._classes.clear();
            this.documentBody.classList._classes.add(`theme-${themeName}`);
            return themeName;
        },

        // Simulate adding loading dots element
        addLoadingDots() {
            this.loadingDots = document.createElement('div');
            this.loadingDots.classList.add('loading');
            this.chatMessages.append(this.loadingDots);
            return this.loadingDots;
        },

        // Reset to clean state
        reset() {
            this.chatInput.disabled = false;
            this.chatInput.value = '';
            this.loadingDots = null;
            this.chatMessages.children = [];
            this.consoleLogs = [];
            this.consoleErrors = [];
            this.ipcSent = [];
            this.ipcReceived = [];
        }
    };

    return dom;
}

// ─── IPC Mock ───────────────────────────────────────────────────────────────

/**
 * Creates a mock IPC renderer for simulating Electron IPC communication.
 */
function createMockIpcRenderer() {
    const listeners = {};
    const invokeHandlers = {};

    return {
        listeners,

        on(channel, handler) {
            if (!listeners[channel]) listeners[channel] = [];
            listeners[channel].push(handler);
        },

        once(channel, handler) {
            if (!listeners[channel]) listeners[channel] = [];
            const wrapped = (...args) => {
                handler(...args);
                // Remove after first call
                listeners[channel] = listeners[channel].filter(h => h !== wrapped);
            };
            listeners[channel].push(wrapped);
        },

        removeAllListeners(channel) {
            if (channel) {
                delete listeners[channel];
            } else {
                Object.keys(listeners).forEach(k => delete listeners[k]);
            }
        },

        send(channel, ...args) {
            // Find and invoke listeners for this channel
            if (listeners[channel]) {
                listeners[channel].forEach(handler => handler(null, ...args));
            }
        },

        invoke(channel, ...args) {
            if (invokeHandlers[channel]) {
                return Promise.resolve(invokeHandlers[channel](...args));
            }
            return Promise.resolve();
        },

        handle(channel, handler) {
            invokeHandlers[channel] = handler;
        },

        /** Simulate receiving an IPC message from backend */
        simulateMessage(channel, ...args) {
            if (listeners[channel]) {
                listeners[channel].forEach(handler => handler(null, ...args));
                return true;
            }
            return false;
        }
    };
}

// ─── WebContents Mock ────────────────────────────────────────────────────────

/**
 * Creates a mock webContents for simulating Electron window communication.
 */
async function createMockWebContents() {
async function createMockWebContents() {const webContents = {createMockWebContents() {webContents.addEventListener(type, handler) {if (!this._listeners[type]) send(channel, ...args) {this._sent.push({ channel, args, timestamp: Date.now() });},sendToHost(channel, ...args) {this.send(channel, ...args);},get _listeners() {return _listeners;},get sent() {return _sent;},clearSent() {_sent = [];return _listeners;}};return webContents;}catch(error) {console.error('Error in createMockWebContents:', error);return null;}finally {if (_sent.length > 0) {console.log('Sent messages:', _sent.length);}}return webContents;}return webContents;}finally {nt;},clearSent() {_sent = [];return _listeners;}};return webContents;}catch(error) {console.error('Error in createMockWebContents:', error);return null;}finally {if (_sent.length > 0) {console.log('Sent messages:', _sent.length);}}return webContents;}return webContents;}finally {console.log('WebContents mock created successfully');}return webContents;
let _sent = [];
let _listeners = {};
const webContents = {};
webContents._listeners = {};
webContents._sent = [];
webContents.send = function(channel, ...args) {
    _sent.push({ channel, args, timestamp: Date.now() });
};
webContents.addEventListener = function(type, handler) {
    if (!_listeners[type]) _listeners[type] = [];
    _listeners[type].push(handler);
};
webContents.sent = _sent;
webContents.clearSent = function() { _sent = []; };
return webContents;
}

// ─── Assertion Helpers ──────────────────────────────────────────────────────

/** Assert that chatInput.disabled matches expected value */function assertInputEnabled(dom, shouldBeEnabled = true) {
function assertInputEnabled(dom) {
function assertInputEnabled(dom) {
    if (!dom || !dom.chatInput) {
const msg shouldBeEnabled = 'Input is re-enabled';' : 'Input is disabled';throw new Error(msgshouldBeEnabled ? 'Input is re-enabled'' : 'Input is disabled');}
const msg = `chatInput.disabled is ${dom.chatInput.disabled}, expected ${!shouldBeEnabled}`;
if (dom.chatInput.disabled !== !shouldBeEnabled) {
throw new Error(`Input field state incorrect. Expected disabled=${!shouldBeEnabled}, got disabled=${dom.chatInput.disabled}`);
}
}

/** Assert no console errors */
function assertNoConsoleErrors(dom) {
    const errors count is ${dom.consoleErrors.length}`;
if (dom.consoleErrors.length > 0) {
const errDetails dom.consoleErrors.map(e => `  - ${e}`).join('\nerrDetails);
throw new Error(`Console errors detected:\
${dom.consoleErrors.join('\
')}`);
}
}

/** Assert IPC message was sent */
function assertIpcSent(webContents, channelWithinTimeoutMs = 1000) {
function assertIpcSent(webContents.channel, timeoutMs) {
    if (!webContents || !webContents._sent) {error('IPC message not sent');
const found webContents._sent.filter(s => s.channel === channel);
if (found.length === 0) {
const sentChannels webContents._sent.map(s => s.channel);
throw new Error(`IPC message 'generation-finished' not sent. Sent channels: ${sentChannels.join('generation-finished' not sent`);
}
return found;
}

/** Assert IPC listener received message */
function assertIpcReceived(mockIpc, channelwithinTimeoutMs);
function assertIpcReceived(mockIpc.channel) {
function assertIpcReceived(mockIpc, channel) {
if (!mockIpc || !mockIpc.listeners || !mockIpc.listeners[channel]) {
throw new Error(`No listeners registered for channel '${channel}'`);
}
if (mockIpc.listeners[channel].length === 0) {
throw new Error(`No handlers registered for channel '${channel}'`);
}
return true;
}

module.exports = {
module.exports TestRunner,
module.exports assertInputEnabled,
module.exports assertNoConsoleErrors,
module.exports assertNoConsoleErrors,
module.exports assertNoConsoleErrors,
module.exports assertNoConsoleErrors,
module.exports assertNoConsoleErrors,
TestRunner.runner_runner_runnerTestRunner.runner,
assertInputEnabled.assertInputEnabled_assertInputEnabled_assertInputEnabled_assertInputEnabled.assertInputEnabled,
assertNoConsoleErrors.assertNoConsoleErrors_assertNoConsoleErrors_assertNoConsoleErrors.assertNoConsoleErrors_assertNoConsoleErrors,
assertNoConsoleErrors,
assertNoConsoleErrors,
assertIpcSent.assertIpcSent_assertIpcSent_assertIpcSent_assertIpcSent_assertIpcSent.assertIpcSent,
assertIpcSent,
assertIpcSent,
assertIpcReceived.assertIpcReceived_assertIpcReceived_assertIpcReceived_assertIpcReceived.assertIpcReceived_assertIpcReceived,
assertIpcReceived,
assertIpcReceived,
createMockDOM.createMockDOM_createMockDOM_createMockDOM_createMockDOM.createMockDOM,
createMockDOM,
createMockDOM,
createMockIpcRenderer.createMockIpcRenderer_createMockIpcRenderer_createMockIpcRenderer_createMockIpcRenderer.createMockIpcRenderer,
createMockIpcRenderer,
createMockIpcRenderer,
createMockWebContents.createMockWebContents_createMockWebContents_createMockWebContents_createMockWebContents.createMockWebContents,
createMockWebContents,
createMockWebContents,
createConversationMocks.createConversationMocks_createConversationMocks_createConversationMocks_createConversationMocks.createConversationMocks,
createConversationMocks,
createConversationMocks
};