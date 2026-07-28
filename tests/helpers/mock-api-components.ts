/**
 * Mock implementations for API components used in testing
 * Provides mock implementations of ApiConnection and ApiSelector for isolated testing
 */

import { jest } from '@jest/globals';
import { ApiConnection, Connection, apiConnectionTestResult } from '../../shared/apiConnection';

// Mock ApiConnection class
export class MockApiConnection extends ApiConnection {
  // Mock the complete method
  complete = jest.fn();

  // Override constructor to avoid complex initialization
  constructor(connection: Connection, parameters: any = {}) {
    // Call parent constructor with minimal setup
    super(connection, parameters);
    
    // Override the complete method with our mock
    this.complete = jest.fn();
  }

  // Mock the testConnection method to use our mocked complete
  async testConnection(): Promise<apiConnectionTestResult> {
    // Delegate to the mocked complete method
    return this.complete('hello', false, {max_tokens: 10, isTestConnection: true})
      .then((resp) => {
        if (resp) {
          return {success: true, overwriteWarning: this.overwriteWarning };
        }
        // An empty response is still a success — the API returned 2xx with no body.
        console.log('API returned an empty response');
        return {success: true, overwriteWarning: this.overwriteWarning };
      })
      .catch((err) => {
        // Specifically handle the "No response" error from `complete()` as a success for testing.
        if (err && err.code === 599 && err.error?.message === 'No response') {
          console.log('API returned an empty response');
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
}

// Mock ApiSelector class for testing
export class MockApiSelector {
  // Mock properties
  deepseekModelInput: HTMLInputElement;
  deepseekKeyInput: HTMLInputElement;
  overwriteContextCheckbox: HTMLInputElement;
  customContextNumber: HTMLInputElement;
  
  // Mock methods
  saveDeepseekConfig = jest.fn();
  connectedCallback = jest.fn();
  
  constructor() {
    // Create mock DOM elements
    this.deepseekModelInput = document.createElement('input');
    this.deepseekModelInput.type = 'text';
    this.deepseekModelInput.id = 'deepseek-model';
    
    this.deepseekKeyInput = document.createElement('input');
    this.deepseekKeyInput.type = 'password';
    this.deepseekKeyInput.id = 'deepseek-key';
    
    this.overwriteContextCheckbox = document.createElement('input');
    this.overwriteContextCheckbox.type = 'checkbox';
    this.overwriteContextCheckbox.id = 'overwrite-context';
    
    this.customContextNumber = document.createElement('input');
    this.customContextNumber.type = 'number';
    this.customContextNumber.id = 'custom-context';
  }
}

// Factory functions for creating mocks
export const createMockApiConnection = (connection: Connection, parameters: any = {}) => {
  return new MockApiConnection(connection, parameters);
};

export const createMockApiSelector = () => {
  return new MockApiSelector();
};

// Export types for convenience
export type { Connection, apiConnectionTestResult };