import { ApiConnection, Connection } from '../../src/shared/apiConnection';
import { createMockApiConnection } from '../helpers/mock-api-components';
import { mockIpcRenderer } from '../helpers/mock-ipc';

describe('ApiConnection', () => {
  let mockConnection: Connection;
  let apiConnection: ApiConnection;

  beforeEach(() => {
    // Reset mocks before each test
    mockIpcRenderer.__reset();
    
    // Create a basic connection for testing
    mockConnection = {
      type: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      key: 'test-key',
      model: 'deepseek-chat',
      forceInstruct: false,
      overwriteContext: false,
      customContext: 8192
    };
    
    apiConnection = new ApiConnection(mockConnection, {});
  });

  describe('testConnection', () => {
    it('should return {success: true} when complete() returns a non-empty response (happy path)', async () => {
      // Arrange
      const mockCompleteFn = apiConnection.complete as jest.Mock;
      mockCompleteFn.mockResolvedValueOnce('Hello, world!');

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(result).toEqual({
        success: true,
        overwriteWarning: apiConnection.overwriteWarning
      });
      expect(mockCompleteFn).toHaveBeenCalledWith('hello', false, {max_tokens: 10, isTestConnection: true});
    });

    it('should return {success: true} when complete() returns empty string (.then() empty path)', async () => {
      // Arrange
      const mockCompleteFn = apiConnection.complete as jest.Mock;
      mockCompleteFn.mockResolvedValueOnce('');

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(result).toEqual({
        success: true,
        overwriteWarning: apiConnection.overwriteWarning
      });
      expect(console.log).toHaveBeenCalledWith('API returned an empty response');
    });

    it('should return {success: true} when complete() throws {code: 599, error: {message: "No response"}} (.catch() 599 path)', async () => {
      // Arrange
      const mockCompleteFn = apiConnection.complete as jest.Mock;
      mockCompleteFn.mockRejectedValueOnce({ code: 599, error: { message: 'No response' } });

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(result).toEqual({
        success: true,
        overwriteWarning: apiConnection.overwriteWarning
      });
      expect(console.log).toHaveBeenCalledWith('API returned an empty response');
    });

    it('should log "API returned an empty response" in the .then() empty path', async () => {
      // Arrange
      const mockCompleteFn = apiConnection.complete as jest.Mock;
      mockCompleteFn.mockResolvedValueOnce('');

      // Act
      await apiConnection.testConnection();

      // Assert
      expect(console.log).toHaveBeenCalledWith('API returned an empty response');
    });

    it('should log "API returned an empty response" in the .catch() 599 path', async () => {
      // Arrange
      const mockCompleteFn = apiConnection.complete as jest.Mock;
      mockCompleteFn.mockRejectedValueOnce({ code: 599, error: { message: 'No response' } });

      // Act
      await apiConnection.testConnection();

      // Assert
      expect(console.log).toHaveBeenCalledWith('API returned an empty response');
    });

    it('should return overwriteWarning from this.overwriteWarning in success cases', async () => {
      // Arrange
      const mockCompleteFn = apiConnection.complete as jest.Mock;
      mockCompleteFn.mockResolvedValueOnce('test response');
      apiConnection.overwriteWarning = true; // Set explicitly for testing

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(result.overwriteWarning).toBe(true);
    });

    it('should return {success: false} when complete() throws a regular Error (sad path)', async () => {
      // Arrange
      const mockCompleteFn = apiConnection.complete as jest.Mock;
      mockCompleteFn.mockRejectedValueOnce(new Error('Network error'));

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(result).toEqual({
        success: false,
        overwriteWarning: false,
        errorMessage: 'Network error'
      });
    });

    it('should return {success: false} when complete() throws structured error with err.error.message (sad path)', async () => {
      // Arrange
      const mockCompleteFn = apiConnection.complete as jest.Mock;
      mockCompleteFn.mockRejectedValueOnce({ code: 400, error: { message: 'Bad request' } });

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(result).toEqual({
        success: false,
        overwriteWarning: false,
        errorMessage: 'Bad request'
      });
    });
  });

  describe('API-Type Specific Tests', () => {
    it('testConnection for gemini type returns success: true when candidates exist in response', async () => {
      // Arrange
      const geminiConnection: Connection = {
        type: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        key: 'test-key',
        model: 'gemini-pro',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 8192
      };
      
      const geminiApi = new ApiConnection(geminiConnection, {});
      const mockCompleteFn = geminiApi.complete as jest.Mock;
      mockCompleteFn.mockResolvedValueOnce({
        candidates: [{
          content: {
            parts: [{ text: 'Test response' }]
          }
        }]
      });

      // Act
      const result = await geminiApi.testConnection();

      // Assert
      expect(result).toEqual({
        success: true,
        overwriteWarning: geminiApi.overwriteWarning
      });
    });

    it('testConnection for gemini type returns success: false when no candidates in response', async () => {
      // Arrange
      const geminiConnection: Connection = {
        type: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        key: 'test-key',
        model: 'gemini-pro',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 8192
      };
      
      const geminiApi = new ApiConnection(geminiConnection, {});
      const mockCompleteFn = geminiApi.complete as jest.Mock;
      mockCompleteFn.mockResolvedValueOnce({ candidates: [] });

      // Act
      const result = await geminiApi.testConnection();

      // Assert
      expect(result).toEqual({
        success: false,
        overwriteWarning: false,
        errorMessage: 'Invalid response from Gemini'
      });
    });

    it('testConnection for glm type returns success: true when choices exist in response', async () => {
      // Arrange
      const glmConnection: Connection = {
        type: 'glm',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        key: 'test-key',
        model: 'glm-4',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 8192
      };
      
      const glmApi = new ApiConnection(glmConnection, {});
      const mockCompleteFn = glmApi.complete as jest.Mock;
      mockCompleteFn.mockResolvedValueOnce({ choices: [{ message: { content: 'Test response' } }] });

      // Act
      const result = await glmApi.testConnection();

      // Assert
      expect(result).toEqual({
        success: true,
        overwriteWarning: glmApi.overwriteWarning
      });
    });

    it('testConnection for player2 type returns success: true when health check returns 200', async () => {
      // Arrange
      const player2Connection: Connection = {
        type: 'player2',
        baseUrl: 'http://127.0.0.1:4315/v1',
        key: 'test-key',
        model: 'test-model',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 8192
      };
      
      const player2Api = new ApiConnection(player2Connection, {});
      
      // Mock fetch for player2 health check
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('{}')
      });

      try {
        // Act
        const result = await player2Api.testConnection();

        // Assert
        expect(result).toEqual({
          success: true,
          overwriteWarning: player2Api.overwriteWarning
        });
        expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:4315/v1/health', {
          method: 'GET',
          headers: {
            'player2-game-key': '019cb2bb-6704-7d22-89e5-41ce7c765942',
            'Content-Type': 'application/json'
          }
        });
      } finally {
        // Restore original fetch
        global.fetch = originalFetch;
      }
    });
  });
});
import { Connection } from '../../src/shared/apiConnection';

// Mock the console.log method
const consoleLogSpy = jest.spyOn(console, 'log');

describe('ApiConnection.testConnection', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Test Connection Success Scenarios', () => {
    it('TC-U1: testConnection returns {success: true} when complete() returns a non-empty response (happy path)', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        key: 'test-key',
        model: 'gpt-3.5-turbo',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 4096
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      const completeSpy = jest.spyOn(apiConnection, 'complete').mockResolvedValue('Hello, world!');

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(completeSpy).toHaveBeenCalledWith('hello', false, { max_tokens: 10, isTestConnection: true });
      expect(result).toEqual({ success: true, overwriteWarning: false });
      expect(consoleLogSpy).not.toHaveBeenCalledWith('API returned an empty response');
    });

    it('TC-U2: testConnection returns {success: true} when complete() returns empty string (the .then() empty path - NEW behavior)', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        key: 'test-key',
        model: 'gpt-3.5-turbo',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 4096
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      const completeSpy = jest.spyOn(apiConnection, 'complete').mockResolvedValue('');

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(completeSpy).toHaveBeenCalledWith('hello', false, { max_tokens: 10, isTestConnection: true });
      expect(result).toEqual({ success: true, overwriteWarning: false });
      expect(consoleLogSpy).toHaveBeenCalledWith('API returned an empty response');
    });

    it('TC-U3: testConnection returns {success: true} when complete() throws {code: 599, error: {message: "No response"}} (the .catch() 599 path)', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        key: 'test-key',
        model: 'gpt-3.5-turbo',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 4096
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      const completeSpy = jest.spyOn(apiConnection, 'complete').mockRejectedValue({ code: 599, error: { message: 'No response' } });

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(completeSpy).toHaveBeenCalledWith('hello', false, { max_tokens: 10, isTestConnection: true });
      expect(result).toEqual({ success: true, overwriteWarning: false });
      expect(consoleLogSpy).toHaveBeenCalledWith('API returned an empty response');
    });

    it('TC-U4: testConnection logs "API returned an empty response" in the .then() empty path', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        key: 'test-key',
        model: 'gpt-3.5-turbo',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 4096
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      const completeSpy = jest.spyOn(apiConnection, 'complete').mockResolvedValue('');

      // Act
      await apiConnection.testConnection();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith('API returned an empty response');
    });

    it('TC-U5: testConnection logs "API returned an empty response" in the .catch() 599 path', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        key: 'test-key',
        model: 'gpt-3.5-turbo',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 4096
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      const completeSpy = jest.spyOn(apiConnection, 'complete').mockRejectedValue({ code: 599, error: { message: 'No response' } });

      // Act
      await apiConnection.testConnection();

      // Assert
      expect(consoleLogSpy).toHaveBeenCalledWith('API returned an empty response');
    });

    it('TC-U6: testConnection returns overwriteWarning from this.overwriteWarning in success cases', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        key: 'test-key',
        model: 'gpt-3.5-turbo',
        forceInstruct: false,
        overwriteContext: true, // This should trigger overwriteWarning to be true
        customContext: 2048
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      const completeSpy = jest.spyOn(apiConnection, 'complete').mockResolvedValue('');

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(result).toEqual({ success: true, overwriteWarning: true });
    });
  });

  describe('Test Connection Error Scenarios', () => {
    it('TC-U7: testConnection returns {success: false} when complete() throws a regular Error (sad path)', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        key: 'test-key',
        model: 'gpt-3.5-turbo',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 4096
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      const completeSpy = jest.spyOn(apiConnection, 'complete').mockRejectedValue(new Error('Network error'));

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(completeSpy).toHaveBeenCalledWith('hello', false, { max_tokens: 10, isTestConnection: true });
      expect(result).toEqual({ success: false, overwriteWarning: false, errorMessage: 'Network error' });
    });

    it('TC-U8: testConnection returns {success: false} when complete() throws structured error with err.error.message (sad path)', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        key: 'test-key',
        model: 'gpt-3.5-turbo',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 4096
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      const completeSpy = jest.spyOn(apiConnection, 'complete').mockRejectedValue({ code: 400, error: { message: 'Bad request' } });

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(completeSpy).toHaveBeenCalledWith('hello', false, { max_tokens: 10, isTestConnection: true });
      expect(result).toEqual({ success: false, overwriteWarning: false, errorMessage: 'Bad request' });
    });
  });

  describe('API-Type Specific Tests', () => {
    it('TC-U9: testConnection for gemini type returns success: true when candidates exist in response', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        key: 'test-key',
        model: 'gemini-pro',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 4096
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      // Mock the fetch call that Gemini uses in testConnection
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'pong' }] } }]
        })
      }) as jest.Mock;

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(result).toEqual({ success: true, overwriteWarning: false });
    });

    it('TC-U10: testConnection for gemini type returns success: false when no candidates in response', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        key: 'test-key',
        model: 'gemini-pro',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 4096
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      // Mock the fetch call that Gemini uses in testConnection
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: []
        })
      }) as jest.Mock;

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(result).toEqual({ success: false, overwriteWarning: false, errorMessage: 'Invalid response from Gemini' });
    });

    it('TC-U11: testConnection for glm type returns success: true when choices exist in response', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'glm',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        key: 'test-key',
        model: 'chatglm_lite',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 4096
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      // Mock the fetch call that GLM uses in testConnection
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'pong' } }]
        })
      }) as jest.Mock;

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(result).toEqual({ success: true, overwriteWarning: false });
    });

    it('TC-U12: testConnection for player2 type returns success: true when health check returns 200', async () => {
      // Arrange
      const mockConnection: Connection = {
        type: 'player2',
        baseUrl: 'http://127.0.0.1:4315/v1',
        key: 'test-key',
        model: 'test-model',
        forceInstruct: false,
        overwriteContext: false,
        customContext: 4096
      };

      const apiConnection = new ApiConnection(mockConnection, {});
      // Mock the fetch call that Player2 uses in testConnection
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        text: async () => 'OK'
      }) as jest.Mock;

      // Act
      const result = await apiConnection.testConnection();

      // Assert
      expect(result).toEqual({ success: true, overwriteWarning: false });
    });
  });
});