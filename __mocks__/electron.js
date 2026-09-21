module.exports = {
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
  },
  app: {
    isPackaged: false,
    getPath: jest.fn(() => '/tmp'), // Mock getPath for user data folders
    quit: jest.fn(),
    // main.ts calls this at module load (disable-gpu); without it any test
    // importing main.ts dies before it can exercise anything.
    commandLine: {
      appendSwitch: jest.fn(),
    },
    // Only registration happens at import time: the 'ready' handler is never
    // invoked here, so importing main.ts does not build windows or read config.
    on: jest.fn(),
    requestSingleInstanceLock: jest.fn(() => true),
  },
  screen: {
    getPrimaryDisplay: jest.fn(() => ({workArea: {x: 0, y: 0, width: 1920, height: 1080}})),
  },
  dialog: {
    showOpenDialog: jest.fn(),
  },
  autoUpdater: {
    checkForUpdatesAndNotify: jest.fn(),
    checkForUpdates: jest.fn(),
    checkForUpdatesAndInstall: jest.fn(),
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
    getAllWindows: jest.fn().mockReturnValue([]),
  })),
  Tray: jest.fn(),
  Menu: {
    buildFromTemplate: jest.fn(),
  },
};
