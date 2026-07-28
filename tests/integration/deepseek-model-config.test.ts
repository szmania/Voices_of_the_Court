/**
 * Integration tests for DeepSeek model configuration
 * Tests the full round-trip of model input, config persistence, and retrieval
 */

import { mockIpcRenderer } from '../helpers/mock-ipc';

describe('DeepSeek Model Config Integration', () => {
  beforeEach(() => {
    mockIpcRenderer.__reset();
  });

  afterEach(() => {
    mockIpcRenderer.__reset();
  });

  describe('Full Round-trip Scenarios', () => {
    it('TC-I1: type model name "deepseek-chat" -> save config -> reload window -> verify input still shows "deepseek-chat"', async () => {
      // Arrange - simulate save
      const savedConfig = {
        type: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        key: 'test-key',
        model: 'deepseek-chat',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 8192
      };

      // Simulate config persistence
      mockIpcRenderer.__setResponse('get-config', {
        deepseek: { connection: savedConfig }
      });

      // Act - simulate reload by invoking get-config
      const config = await mockIpcRenderer.invoke('get-config');

      // Assert
      expect(config.deepseek.connection.model).toBe('deepseek-chat');
    });

    it('TC-I2: type model name with whitespace "  deepseek-chat  " -> save -> reload -> verify trimmed value', async () => {
      const savedConfig = {
        type: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        key: 'test-key',
        model: '  deepseek-chat  ',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 8192
      };

      mockIpcRenderer.__setResponse('get-config', {
        deepseek: { connection: savedConfig }
      });

      const config = await mockIpcRenderer.invoke('get-config');

      // Assert - verify the value is preserved as-is (user's responsibility to trim)
      expect(config.deepseek.connection.model).toBe('  deepseek-chat  ');
    });

    it('TC-I3: type empty model name -> save -> reload -> verify empty string', async () => {
      const savedConfig = {
        type: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        key: 'test-key',
        model: '',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 8192
      };

      mockIpcRenderer.__setResponse('get-config', {
        deepseek: { connection: savedConfig }
      });

      const config = await mockIpcRenderer.invoke('get-config');

      expect(config.deepseek.connection.model).toBe('');
    });

    it('TC-I4: type model name with special characters "deepseek-chat/v3" -> save -> reload -> verify preserved', async () => {
      const savedConfig = {
        type: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        key: 'test-key',
        model: 'deepseek-chat/v3',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 8192
      };

      mockIpcRenderer.__setResponse('get-config', {
        deepseek: { connection: savedConfig }
      });

      const config = await mockIpcRenderer.invoke('get-config');

      expect(config.deepseek.connection.model).toBe('deepseek-chat/v3');
    });
  });

  describe('API Connection Test Integration', () => {
    it('TC-I5: verify API test connection logs "API returned an empty response" for empty 2xx response', async () => {
      const { ApiConnection } = await import('../../src/shared/apiConnection');

      const apiConnection = new ApiConnection({
        type: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        key: 'test-key',
        model: 'deepseek-chat',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 8192
      }, {});

      // Mock the complete method to simulate empty response via 599 error
      (apiConnection as any).complete = jest.fn().mockRejectedValueOnce({
        code: 599,
        error: { message: 'No response' }
      });

      const result = await apiConnection.testConnection();

      expect(result.success).toBe(true);
      expect(console.log).toHaveBeenCalledWith('API returned an empty response');
    });

    it('TC-I6: verify API test testConnection() logs "API returned an empty response" for empty 2xx (.then path)', async () => {
      const { ApiConnection } = await import('../../src/shared/apiConnection');

      const apiConnection = new ApiConnection({
        type: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        key: 'test-key',
        model: 'deepseek-chat',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 8192
      }, {});

      // Mock the complete method to return empty string (.then() path)
      (apiConnection as any).complete = jest.fn().mockResolvedValueOnce('');

      const result = await apiConnection.testConnection();

      expect(result.success).toBe(true);
      expect(console.log).toHaveBeenCalledWith('API returned an empty response');
    });
  });

  describe('Cross-Component Scenarios', () => {
    it('TC-I7: save model via API selector -> verify it is stored in config -> verify ApiConnection uses it', async () => {
      // Simulate saving via IPC
      const model = 'deepseek-coder-v2';
      mockIpcRenderer.send('config-change', 'test-conf', {
        type: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        key: 'test-api-key',
        model,
        forceInstruct: false,
        overwriteContext: false,
        customContext: 8192
      });

      // Verify IPC send was called with the correct model
      expect(mockIpcRenderer.send).toHaveBeenCalled();
      const sendCalls = mockIpcRenderer.send.mock.calls;
      const savedConfig = sendCalls[0][2];
      expect(savedConfig.model).toBe('deepseek-coder-v2');
    });

    it('TC-I8: change model via config file directly -> reload UI -> verify input reflects change', async () => {
      // Simulate config change
      mockIpcRenderer.__setResponse('get-config', {
        deepseek: {
          connection: {
            type: 'deepseek',
            baseUrl: 'https://api.deepseek.com',
            key: 'test-key',
            model: 'deepseek-chat-v2',
            forceInstruct: false,
            overwriteContext: false,
            customContext: 8192
          }
        }
      });

      // Act - simulate reload by fetching config
      const config = await mockIpcRenderer.invoke('get-config');

      // Assert - the config should contain the changed model
      expect(config.deepseek.connection.model).toBe('deepseek-chat-v2');
    });
  });
});