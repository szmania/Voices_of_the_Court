module.exports = {
  ipcMain: {
    on: jest.fn(),
    handle: jest.fn(),
  },
  app: {
    isPackaged: false,
    getPath: jest.fn(() => '/tmp'), // Mock getPath for user data folders
    quit: jest.fn(),
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
