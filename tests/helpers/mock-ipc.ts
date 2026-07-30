/**
 * Mock IPC Renderer for Electron IPC testing
 * Provides mock implementations of ipcRenderer.invoke and ipcRenderer.send
 */

import { jest } from '@jest/globals';

// Store for IPC responses
const ipcResponses: Record<string, any> = {};

// Store for IPC events
const ipcListeners: Record<string, ((...args: any[]) => void)[]> = {};

// Mock implementation of ipcRenderer
export const mockIpcRenderer = {
  invoke: jest.fn((channel: string, ...args: any[]) => {
    // Return stored response if available
    if (ipcResponses[channel]) {
      return Promise.resolve(ipcResponses[channel]);
    }
    // Default response for unknown channels
    return Promise.resolve(undefined);
  }),

  send: jest.fn((channel: string, ...args: any[]) => {
    // Trigger any listeners for this channel
    if (ipcListeners[channel]) {
      ipcListeners[channel].forEach(listener => listener(...args));
    }
  }),

  on: jest.fn((channel: string, listener: (...args: any[]) => void) => {
    if (!ipcListeners[channel]) {
      ipcListeners[channel] = [];
    }
    ipcListeners[channel].push(listener);
    return this;
  }),

  removeListener: jest.fn((channel: string, listener: (...args: any[]) => void) => {
    if (ipcListeners[channel]) {
      const index = ipcListeners[channel].indexOf(listener);
      if (index > -1) {
        ipcListeners[channel].splice(index, 1);
      }
    }
    return this;
  }),

  once: jest.fn((channel: string, listener: (...args: any[]) => void) => {
    const onceListener = (...args: any[]) => {
      listener(...args);
      this.removeListener(channel, onceListener);
    };
    return this.on(channel, onceListener);
  }),

  // Helper to set up responses for specific channels
  __setResponse(channel: string, response: any) {
    ipcResponses[channel] = response;
  },

  // Helper to clear all stored responses
  __clearResponses() {
    Object.keys(ipcResponses).forEach(key => delete ipcResponses[key]);
  },

  // Helper to clear all listeners
  __clearListeners() {
    Object.keys(ipcListeners).forEach(key => delete ipcListeners[key]);
  },

  // Helper to get mock statistics
  __getStats() {
    return {
      invokeCalls: this.invoke.mock.calls,
      sendCalls: this.send.mock.calls,
      onCalls: this.on.mock.calls,
      removeListenerCalls: this.removeListener.mock.calls,
    };
  },

  // Reset all mocks
  __reset() {
    this.invoke.mockClear();
    this.send.mockClear();
    this.on.mockClear();
    this.removeListener.mockClear();
    this.__clearResponses();
    this.__clearListeners();
  },
};

// Mock the electron module
jest.mock('electron', () => ({
  ipcRenderer: mockIpcRenderer,
}));

export default mockIpcRenderer;