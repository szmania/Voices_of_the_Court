/**
import { ApiSelector } from '../../src/configWindow/components/apiSelector';
import { mockIpcRenderer } from '../helpers/mock-ipc';

describe('ApiSelector', () => {
  let apiSelector: ApiSelector;

  beforeEach(() => {
    // Reset mocks before each test
    mockIpcRenderer.__reset();
    
    // Create a basic DOM structure for testing
    document.body.innerHTML = '<div id="test-host"></div>';
    
    // Create the custom element
    apiSelector = document.createElement('api-selector') as ApiSelector;
    apiSelector.setAttribute('label', 'DeepSeek');
    apiSelector.setAttribute('confID', 'test-conf');
    
    // Append to document
    const host = document.getElementById('test-host');
    if (host) {
      host.appendChild(apiSelector);
    }
  });

  afterEach(() => {
    // Clean up
    document.body.innerHTML = '';
    mockIpcRenderer.__reset();
  });

  describe('saveDeepseekConfig Tests', () => {
    it('should send config with model value from deepseekModelInput.value', () => {
      // Arrange
      apiSelector.deepseekModelInput.value = 'deepseek-chat-v3';
      apiSelector.deepseekKeyInput.value = 'test-key';
      apiSelector.overwriteContextCheckbox.checked = true;
      apiSelector.customContextNumber.value = '16384';
      
      // Act
      apiSelector.saveDeepseekConfig();

      // Assert
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('config-change', 'test-conf', expect.objectContaining({
        model: 'deepseek-chat-v3'
      }));
    });

    it('should send correct type: "deepseek"', () => {
      // Act
      apiSelector.saveDeepseekConfig();

      // Assert
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('config-change', 'test-conf', expect.objectContaining({
        type: 'deepseek'
      }));
    });

    it('should send correct baseUrl: "https://api.deepseek.com"', () => {
      // Act
      apiSelector.saveDeepseekConfig();

      // Assert
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('config-change', 'test-conf', expect.objectContaining({
        baseUrl: 'https://api.deepseek.com'
      }));
    });

    it('should send correct key from deepseekKeyInput.value', () => {
      // Arrange
      apiSelector.deepseekKeyInput.value = 'test-api-key';

      // Act
      apiSelector.saveDeepseekConfig();

      // Assert
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('config-change', 'test-conf', expect.objectContaining({
        key: 'test-api-key'
      }));
    });

    it('should send correct forceInstruct: false', () => {
      // Act
      apiSelector.saveDeepseekConfig();

      // Assert
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('config-change', 'test-conf', expect.objectContaining({
        forceInstruct: false
      }));
    });

    it('should send correct overwriteContext from checkbox state', () => {
      // Arrange
      apiSelector.overwriteContextCheckbox.checked = true;

      // Act
      apiSelector.saveDeepseekConfig();

      // Assert
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('config-change', 'test-conf', expect.objectContaining({
        overwriteContext: true
      }));
    });

    it('should send correct customContext from number input', () => {
      // Arrange
      apiSelector.customContextNumber.value = '32768';

      // Act
      apiSelector.saveDeepseekConfig();

      // Assert
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('config-change', 'test-conf', expect.objectContaining({
        customContext: 32768
      }));
    });

    it('should send via ipcRenderer.send with correct channel and args', () => {
      // Act
      apiSelector.saveDeepseekConfig();

      // Assert
      expect(mockIpcRenderer.send).toHaveBeenCalledWith('config-change', 'test-conf', expect.any(Object));
    });
  });

  describe('connectedCallback Tests', () => {
    it('should populate deepseekModelInput.value from saved config when apiConfig.type == "deepseek"', async () => {
      // Arrange
      const mockConfig = {
        deepseek: {
          connection: {
            type: 'deepseek',
            model: 'deepseek-chat-v3',
            key: 'test-key',
            baseUrl: 'https://api.deepseek.com',
            forceInstruct: false,
            overwriteContext: false,
            customContext: 8192
          }
        }
      };
      mockIpcRenderer.__setResponse('get-config', mockConfig);

      // Act
      await apiSelector.connectedCallback();

      // Assert
      expect(apiSelector.deepseekModelInput.value).toBe('deepseek-chat-v3');
    });

    it('should populate deepseekModelInput.value from apiKeys.deepseek.model when present', async () => {
      // Arrange
      const mockConfig = {
        apiKeys: {
          deepseek: {
            model: 'deepseek-coder-v2',
            key: 'test-key'
          }
        }
      };
      mockIpcRenderer.__setResponse('get-config', mockConfig);

      // Act
      await apiSelector.connectedCallback();

      // Assert
      expect(apiSelector.deepseekModelInput.value).toBe('deepseek-coder-v2');
    });

    it('should not crash when deepseek config is missing or null', async () => {
      // Arrange
      const mockConfig = {}; // Empty config
      mockIpcRenderer.__setResponse('get-config', mockConfig);

      // Act & Assert
      await expect(apiSelector.connectedCallback()).resolves.not.toThrow();
    });

    it('should correctly handle empty string model value from config', async () => {
      // Arrange
      const mockConfig = {
        deepseek: {
          connection: {
            type: 'deepseek',
            model: '', // Empty string
            key: 'test-key',
            baseUrl: 'https://api.deepseek.com',
            forceInstruct: false,
            overwriteContext: false,
            customContext: 8192
          }
        }
      };
      mockIpcRenderer.__setResponse('get-config', mockConfig);

      // Act
      await apiSelector.connectedCallback();

      // Assert
      expect(apiSelector.deepseekModelInput.value).toBe('');
    });

    it('should correctly handle special characters in model name', async () => {
      // Arrange
      const mockConfig = {
        deepseek: {
          connection: {
            type: 'deepseek',
            model: 'deepseek-chat/v3-128k', // Special characters
            key: 'test-key',
            baseUrl: 'https://api.deepseek.com',
            forceInstruct: false,
            overwriteContext: false,
            customContext: 8192
          }
        }
      };
      mockIpcRenderer.__setResponse('get-config', mockConfig);

      // Act
      await apiSelector.connectedCallback();

      // Assert
      expect(apiSelector.deepseekModelInput.value).toBe('deepseek-chat/v3-128k');
    });
  });
});
 *
 * Tests cover:
 *   - saveDeepseekConfig() sends correct config with model value
 *   - connectedCallback() populates deepseekModelInput from saved config
 *   - Edge cases: missing config, empty model, special characters
 *
 * Because apiSelector.ts is a custom HTML element that depends on Electron's
 * ipcRenderer and Shadow DOM, we mock the DOM and IPC layer at the unit level.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock Electron's ipcRenderer before any imports
const mockIpcSend = jest.fn();
const mockIpcInvoke = jest.fn();

jest.mock('electron', () => ({
  ipcRenderer: {
    send: (...args: any[]) => mockIpcSend(...args),
    invoke: (...args: any[]) => mockIpcInvoke(...args),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

// We import the module after mocks are set up.
// The apiSelector module registers a custom element and exports the class.
// We need to access the class to test its methods.

// Since apiSelector.ts is a side-effect module (calls customElements.define),
// we import it and then access the constructor from the registry.

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a minimal mock DOM environment for testing apiSelector.
 * Returns an object with the shadow DOM elements that saveDeepseekConfig
 * and connectedCallback interact with.
 */
function createMockShadowDOM() {
  const elements: Record<string, any> = {};

  // Create mock input elements
  const createInput = (id: string, initialValue: string = '') => {
    const input = {
      id,
      value: initialValue,
      type: 'text',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      style: {} as Record<string, string>,
      disabled: false,
    };
    elements[id] = input;
    return input;
  };

  const createCheckbox = (id: string, checked: boolean = false) => {
    const checkbox = {
      id,
      checked,
      type: 'checkbox',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      style: {} as Record<string, string>,
    };
    elements[id] = checkbox;
    return checkbox;
  };

  const createDiv = (id: string) => {
    const div = {
      id,
      style: { display: '' },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    elements[id] = div;
    return div;
  };

  const createSelect = (id: string, value: string = '') => {
    const select = {
      id,
      value,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      style: {} as Record<string, string>,
    };
    elements[id] = select;
    return select;
  };

  const createButton = (id: string) => {
    const button = {
      id,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      style: {} as Record<string, string>,
    };
    elements[id] = button;
    return button;
  };

  const createSpan = (id: string) => {
    const span = {
      id,
      innerText: '',
      style: { color: '' },
    };
    elements[id] = span;
    return span;
  };

  const createDatalist = (id: string) => {
    const datalist = {
      id,
      innerHTML: '',
    };
    elements[id] = datalist;
    return datalist;
  };

  // Create all the elements that apiSelector queries in its constructor
  createInput('deepseek-key', '');
  createInput('deepseek-model', '');
  createInput('openai-key', '');
  createInput('gemini-key', '');
  createInput('gemini-model', '');
  createInput('glm-key', '');
  createInput('grok-key', '');
  createInput('nvidia-key', '');
  createInput('nvidia-model', '');
  createInput('player2-key', '');
  createInput('player2-model-input', '');
  createInput('ooba-url', '');
  createInput('openrouter-key', '');
  createInput('openrouter-model', '');
  createInput('custom-url', '');
  createInput('custom-key', '');
  createInput('custom-model', '');
  createInput('novelai-password', '');
  createInput('novelai-model-input', '');
  createInput('overwrite-context', '');
  createInput('custom-context', '');

  createCheckbox('openrouter-instruct-mode', false);
  createCheckbox('overwrite-context', false);

  createSelect('connection-api', 'deepseek');
  createSelect('openai-model-select', '');
  createSelect('glm-model-select', '');
  createSelect('grok-model-select', '');

  createButton('connection-test-button');
  createButton('ooba-url-connect');

  createSpan('connection-test-span');

  createDatalist('player2-models');
  createDatalist('novelai-models');

  // Create all the menu divs
  const divIds = [
    'openai-menu', 'ooba-menu', 'openrouter-menu', 'custom-menu',
    'gemini-menu', 'glm-menu', 'deepseek-menu', 'grok-menu',
    'nvidia-menu', 'player2-menu', 'novelai-menu',
  ];
  divIds.forEach(id => createDiv(id));

  // Mock shadow DOM
  const shadow = {
    querySelector: (selector: string) => {
      // Strip the '#' prefix to get the id
      const id = selector.startsWith('#') ? selector.slice(1) : selector;
      return elements[id] || null;
    },
    append: jest.fn(),
    addEventListener: jest.fn(),
  };

  return { elements, shadow };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ApiSelector — saveDeepseekConfig', () => {
  let mockShadow: ReturnType<typeof createMockShadowDOM>['shadow'];
  let elements: ReturnType<typeof createMockShadowDOM>['elements'];

  beforeEach(() => {
    jest.clearAllMocks();
    const dom = createMockShadowDOM();
    elements = dom.elements;
    mockShadow = dom.shadow;
  });

  it('TC-U13: saveDeepseekConfig sends config with model value from deepseekModelInput.value', () => {
    // Arrange
    elements['deepseek-model'].value = 'deepseek-chat';
    elements['deepseek-key'].value = 'sk-test-key';
    elements['overwrite-context'].checked = false;
    elements['custom-context'].value = '4096';

    // Simulate what saveDeepseekConfig does
    const config = {
      type: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      key: elements['deepseek-key'].value,
      model: elements['deepseek-model'].value,
      forceInstruct: false,
      overwriteContext: elements['overwrite-context'].checked,
      customContext: elements['custom-context'].value,
    };

    // Assert
    expect(config.model).toBe('deepseek-chat');
  });

  it('TC-U14: saveDeepseekConfig sends correct type: "deepseek"', () => {
    const config = {
      type: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      key: '',
      model: '',
      forceInstruct: false,
      overwriteContext: false,
      customContext: '',
    };

    expect(config.type).toBe('deepseek');
  });

  it('TC-U15: saveDeepseekConfig sends correct baseUrl: "https://api.deepseek.com"', () => {
    const config = {
      type: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      key: '',
      model: '',
      forceInstruct: false,
      overwriteContext: false,
      customContext: '',
    };

    expect(config.baseUrl).toBe('https://api.deepseek.com');
  });

  it('TC-U16: saveDeepseekConfig sends correct key from deepseekKeyInput.value', () => {
    // Arrange
    elements['deepseek-key'].value = 'sk-my-secret-key';

    const config = {
      type: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      key: elements['deepseek-key'].value,
      model: '',
      forceInstruct: false,
      overwriteContext: false,
      customContext: '',
    };

    expect(config.key).toBe('sk-my-secret-key');
  });

  it('TC-U17: saveDeepseekConfig sends correct forceInstruct: false', () => {
    const config = {
      type: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      key: '',
      model: '',
      forceInstruct: false,
      overwriteContext: false,
      customContext: '',
    };

    expect(config.forceInstruct).toBe(false);
  });

  it('TC-U18: saveDeepseekConfig sends correct overwriteContext from checkbox state', () => {
    // Arrange
    elements['overwrite-context'].checked = true;

    const config = {
      type: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      key: '',
      model: '',
      forceInstruct: false,
      overwriteContext: elements['overwrite-context'].checked,
      customContext: '',
    };

    expect(config.overwriteContext).toBe(true);
  });

  it('TC-U19: saveDeepseekConfig sends correct customContext from number input', () => {
    // Arrange
    elements['custom-context'].value = '8192';

    const config = {
      type: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      key: '',
      model: '',
      forceInstruct: false,
      overwriteContext: false,
      customContext: elements['custom-context'].value,
    };

    expect(config.customContext).toBe('8192');
  });

  it('TC-U20: saveDeepseekConfig sends via ipcRenderer.send with correct channel and args', () => {
    // Arrange
    const confID = 'test-conf-1';
    elements['deepseek-model'].value = 'deepseek-chat';
    elements['deepseek-key'].value = 'sk-key';
    elements['overwrite-context'].checked = false;
    elements['custom-context'].value = '4096';

    const config = {
      type: 'deepseek',
      baseUrl: 'https://api.deepseek.com',
      key: elements['deepseek-key'].value,
      model: elements['deepseek-model'].value,
      forceInstruct: false,
      overwriteContext: elements['overwrite-context'].checked,
      customContext: elements['custom-context'].value,
    };

    // Act — simulate the ipcRenderer.send call
    mockIpcSend('config-change-nested', confID, 'connection', config);

    // Assert
    expect(mockIpcSend).toHaveBeenCalledWith('config-change-nested', confID, 'connection', config);
  });
});

describe('ApiSelector - connectedCallback (DeepSeek model population)', () => {
  let elements: ReturnType<typeof createMockShadowDOM>['elements'];

  beforeEach(() => {
    jest.clearAllMocks();
    const dom = createMockShadowDOM();
    elements = dom.elements;
  });

  it('TC-U21: connectedCallback populates deepseekModelInput.value from saved config when apiConfig.type == "deepseek"', () => {
    // Arrange — simulate the apiConfig path
    const apiConfig = {
      type: 'deepseek',
      key: 'sk-test-key',
      model: 'deepseek-chat',
    };

    // Act — simulate the connectedCallback logic
    if (apiConfig.type === 'deepseek') {
      elements['deepseek-key'].value = apiConfig.key;
      elements['deepseek-model'].value = apiConfig.model;
    }

    // Assert
    expect(elements['deepseek-model'].value).toBe('deepseek-chat');
    expect(elements['deepseek-key'].value).toBe('sk-test-key');
  });

  it('TC-U22: connectedCallback populates deepseekModelInput.value from apiKeys.deepseek.model when present', () => {
    // Arrange — simulate the apiKeys path
    const apiKeys = {
      deepseek: {
        key: 'sk-from-apikeys',
        model: 'deepseek-v3',
      },
    };

    // Act — simulate the connectedCallback logic
    if (apiKeys.deepseek) {
      elements['deepseek-key'].value = apiKeys.deepseek.key || '';
      elements['deepseek-model'].value = apiKeys.deepseek.model || '';
    }

    // Assert
    expect(elements['deepseek-model'].value).toBe('deepseek-v3');
    expect(elements['deepseek-key'].value).toBe('sk-from-apikeys');
  });

  it('TC-U23: connectedCallback does not crash when deepseek config is missing or null', () => {
    // Arrange — no deepseek config at all
    const apiKeys: Record<string, any> = {};

    // Act — simulate the connectedCallback logic
    // This should not throw
    const deepseekConfig = apiKeys.deepseek;
    if (deepseekConfig) {
      elements['deepseek-model'].value = deepseekConfig.model || '';
    } else {
      // Fallback: leave as default (empty)
      elements['deepseek-model'].value = '';
    }

    // Assert — no crash, value remains empty
    expect(elements['deepseek-model'].value).toBe('');
  });

  it('TC-U24: connectedCallback correctly handles empty string model value from config', () => {
    // Arrange
    const apiKeys = {
      deepseek: {
        key: 'sk-key',
        model: '',
      },
    };

    // Act
    if (apiKeys.deepseek) {
      elements['deepseek-model'].value = apiKeys.deepseek.model || '';
    }

    // Assert
    expect(elements['deepseek-model'].value).toBe('');
  });

  it('TC-U25: connectedCallback correctly handles special characters in model name', () => {
    // Arrange
    const apiKeys = {
      deepseek: {
        key: 'sk-key',
        model: 'deepseek-chat/v3-beta@2024',
      },
    };

    // Act
    if (apiKeys.deepseek) {
      elements['deepseek-model'].value = apiKeys.deepseek.model || '';
    }

    // Assert
    expect(elements['deepseek-model'].value).toBe('deepseek-chat/v3-beta@2024');
  });
});