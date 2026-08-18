import { ChatWindow } from '../../src/main/windows/ChatWindow';

// Mock dependencies
jest.mock('electron', () => ({
  app: {
    isPackaged: false,
    quit: jest.fn(),
    getPath: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    removeMenu: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      send: jest.fn(),
    },
    on: jest.fn(),
    isDestroyed: jest.fn(() => false),
    show: jest.fn(),
    hide: jest.fn(),
    setAlwaysOnTop: jest.fn(),
    setVisibleOnAllWorkspaces: jest.fn(),
    setIgnoreMouseEvents: jest.fn(),
  })),
  ipcMain: {
    on: jest.fn(),
  },
  screen: {
    getPrimaryDisplay: jest.fn().mockReturnValue({
      bounds: { width: 1920, height: 1080 }
    }),
  },
}));

jest.mock('electron-overlay-window', () => ({
  OverlayController: {
    attachByTitle: jest.fn(),
    activateOverlay: jest.fn(),
    focusTarget: jest.fn(),
  },
  OVERLAY_WINDOW_OPTS: {},
}));

let mockActiveWindow: {
  getActiveWindow: jest.Mock;
  initialize: jest.Mock;
  subscribe: jest.Mock;
};

jest.mock('@paymoapp/active-window', () => ({
  default: mockActiveWindow,
}));

describe('ChatWindow', () => {

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockBrowserWindow = {
      loadFile: jest.fn(),
      removeMenu: jest.fn(),
      webContents: {
        openDevTools: jest.fn(),
        send: jest.fn(),
      },
      on: jest.fn(),
      isDestroyed: jest.fn(() => false),
      show: jest.fn(),
      hide: jest.fn(),
      setAlwaysOnTop: jest.fn(),
      setVisibleOnAllWorkspaces: jest.fn(),
      setIgnoreMouseEvents: jest.fn(),
    };

    // Mock BrowserWindow constructor to return our mock window
    require('electron').BrowserWindow.mockImplementation(() => mockBrowserWindow);

    // Mock ActiveWindow
    mockActiveWindow = {
      getActiveWindow: jest.fn(),
      initialize: jest.fn(),
      subscribe: jest.fn(),
    };
    (require('@paymoapp/active-window') as any).default = mockActiveWindow;

    // Create ChatWindow instance
    chatWindow = new ChatWindow();
  });

  describe('constructor', () => {
    it('should create BrowserWindow with correct options', () => {
      expect(require('electron').BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          transparent: true,
          alwaysOnTop: true,
          resizable: true,
          frame: false,
          webPreferences: expect.objectContaining({
            nodeIntegration: true,
            contextIsolation: false,
          }),
        })
      );
    });

    it('should initialize ActiveWindow on non-Linux platforms', () => {
      expect(mockActiveWindow.initialize).toHaveBeenCalled();
    });

    it('should load the chat HTML file', () => {
      expect(mockBrowserWindow.loadFile).toHaveBeenCalledWith(
        './public/chatWindow/chat.html'
      );
    });

    it('should attach overlay controller', () => {
      expect(require('electron-overlay-window').OverlayController.attachByTitle)
        .toHaveBeenCalledWith(mockBrowserWindow, 'Crusader Kings III');
    });

    it('should open dev tools in development mode', () => {
      expect(mockBrowserWindow.webContents.openDevTools).toHaveBeenCalledWith(
        { mode: 'detach', activate: false }
      );
    });

    it('should set up close event handler', () => {
      expect(mockBrowserWindow.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should initialize interval for focus checking', () => {
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 500);
    });
  });

  describe('showWindow', () => {
    it('should show window when not already shown', () => {
      chatWindow['isShown'] = false;
      chatWindow['showWindow']();

      expect(console.log).toHaveBeenCalledWith('Chat window showed via focus listener!');
      expect(require('electron-overlay-window').OverlayController.activateOverlay).toHaveBeenCalled();
      expect(mockBrowserWindow.show).toHaveBeenCalled();
      expect(chatWindow['isShown']).toBe(true);
    });

    it('should do nothing when window is already shown', () => {
      chatWindow['isShown'] = true;
      chatWindow['showWindow']();

      expect(console.log).not.toHaveBeenCalledWith('Chat window showed via focus listener!');
      expect(require('electron-overlay-window').OverlayController.activateOverlay).not.toHaveBeenCalled();
      expect(mockBrowserWindow.show).not.toHaveBeenCalled();
    });
  });

  describe('hideWindow', () => {
    it('should hide window when currently shown', () => {
      chatWindow['isShown'] = true;
      chatWindow['hideWindow']();

      expect(console.log).toHaveBeenCalledWith('Chat window hidden via focus listener!');
      expect(mockBrowserWindow.hide).toHaveBeenCalled();
      expect(chatWindow['isShown']).toBe(false);
    });

    it('should do nothing when window is already hidden', () => {
      chatWindow['isShown'] = false;
      chatWindow['hideWindow']();

      expect(console.log).not.toHaveBeenCalledWith('Chat window hidden via focus listener!');
      expect(mockBrowserWindow.hide).not.toHaveBeenCalled();
    });
  });

  describe('show method', () => {
    it('should call showWindow and send chat-show event after delay', () => {
      chatWindow['show']();

      expect(console.log).toHaveBeenCalledWith('Chat window showed!');
      expect(chatWindow['showWindow']).toHaveBeenCalled();

      // Check that setTimeout was called to send the event
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 150);

      // Get the callback from setTimeout and execute it to verify webContents.send was called
      const timeoutCallback = setTimeout.mock.calls[0][0];
      timeoutCallback();

      expect(mockBrowserWindow.webContents.send).toHaveBeenCalledWith('chat-show');
    });
  });

  describe('hide method', () => {
    it('should call hideWindow and focus target', () => {
      chatWindow['hide']();

      expect(console.log).toHaveBeenCalledWith('Chat window hidden!');
      expect(chatWindow['hideWindow']).toHaveBeenCalled();
      expect(require('electron-overlay-window').OverlayController.focusTarget).toHaveBeenCalled();
      expect(chatWindow['isShown']).toBe(false);
    });
  });

  describe('focus change handling', () => {
    let intervalCallback: Function;

    beforeEach(() => {
      // Get the interval callback that was set up in constructor
      intervalCallback = setInterval.mock.calls[0][0];
    });

    it('should show window when game gains focus', () => {
      // Setup: window currently hidden, last game state was inactive
      chatWindow['isShown'] = false;
      chatWindow['lastGameWindowActive'] = false;

      // Simulate game window gaining focus
      mockActiveWindow.getActiveWindow.mockReturnValueOnce({ title: 'Crusader Kings III' });

      // Execute the interval callback (focus check)
      intervalCallback();

      // Verify window was shown
      expect(chatWindow['showWindow']).toHaveBeenCalled();
      expect(chatWindow['lastGameWindowActive']).toBe(true);
    });

    it('should hide window when game loses focus (and chat/config not active)', () => {
      // Setup: window currently showing, last game state was active
      chatWindow['isShown'] = true;
      chatWindow['lastGameWindowActive'] = true;

      // Simulate game window losing focus, and neither chat nor config gaining focus
      mockActiveWindow.getActiveWindow.mockReturnValueOnce({ title: 'Some Other App' });

      // Execute the interval callback (focus check)
      intervalCallback();

      // Verify window was hidden (unless chat/config window gained focus)
      expect(chatWindow['hideWindow']).toHaveBeenCalled();
      expect(chatWindow['lastGameWindowActive']).toBe(false);
    });

    it('should not hide window when game loses focus but chat gains focus', () => {
      // Setup: window currently showing, last game state was active
      chatWindow['isShown'] = true;
      chatWindow['lastGameWindowActive'] = true;

      // Simulate game losing focus but chat window gaining focus
      mockActiveWindow.getActiveWindow.mockReturnValueOnce({ title: 'Voices of the Court 2.0 - Community Edition - Chat' });

      // Execute the interval callback
      intervalCallback();

      // Verify window was NOT hidden because chat gained focus
      expect(chatWindow['hideWindow']).not.toHaveBeenCalled();
      expect(chatWindow['lastGameWindowActive']).toBe(false); // Updated because isGameActive is false
    });

    it('should not hide window when game loses focus but config gains focus', () => {
      // Setup: window currently showing, last game state was active
      chatWindow['isShown'] = true;
      chatWindow['lastGameWindowActive'] = true;

      // Simulate game losing focus but config window gaining focus
      mockActiveWindow.getActiveWindow.mockReturnValueOnce({ title: 'Voices of the Court 2.0 - Community Edition' });

      // Execute the interval callback
      intervalCallback();

      // Verify window was NOT hidden because config gained focus
      expect(chatWindow['hideWindow']).not.toHaveBeenCalled();
      expect(chatWindow['lastGameWindowActive']).toBe(false); // Updated because isGameActive is false
    });

    it('should handle errors in getActiveWindow gracefully', () => {
      // Setup error condition
      mockActiveWindow.getActiveWindow.mockImplementation(() => {
        throw new Error('Failed to get active window');
      });

      // Should not throw error - just log it and continue
      expect(() => intervalCallback()).not.toThrow();
      expect(console.error).toHaveBeenCalledWith('Failed to get active window:', expect.any(Error));
    });
  });
});