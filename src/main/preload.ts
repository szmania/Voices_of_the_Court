const { ipcRenderer } = require('electron');
const util = require('util');

// Save original console methods
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
};

// Function to send log messages to the main process
const sendLog = (level, ...args) => {
    // We use util.format to handle multiple arguments and complex objects
    const message = util.format(...args);
    ipcRenderer.send('log-message', { level, message });
};

// Override console methods
console.log = (...args) => {
    originalConsole.log.apply(console, args);
    sendLog('log', ...args);
};
console.error = (...args) => {
    originalConsole.error.apply(console, args);
    sendLog('error', ...args);
};
console.warn = (...args) => {
    originalConsole.warn.apply(console, args);
    sendLog('warn', ...args);
};
console.info = (...args) => {
    originalConsole.info.apply(console, args);
    sendLog('info', ...args);
};
console.debug = (...args) => {
    if (originalConsole.debug) {
        originalConsole.debug.apply(console, args);
    } else {
        originalConsole.log.apply(console, args); // Fallback for environments without console.debug
    }
    sendLog('debug', ...args);
};
