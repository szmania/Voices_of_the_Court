
const path = require('path');
const { execSync } = require('child_process');

module.exports = {
  outDir: process.platform === 'win32' ? 'C:/tmp' : 'out',
  packagerConfig: {
    icon: './build/icons/icon', // Electron Forge will automatically use .ico for Windows and .icns for Mac
    //"asar":true
    ignore: /^(\/out|\/tests|\/logs|\/debug|\/\.)/
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: { loadingGif: path.join(__dirname, 'build', 'icons', 'installerPic.png')}
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        name: 'VOTC-2_0-CE_macOS',
        title: 'VOTC-2_0-CE_macOS'
      }
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  hooks: {
    postPackage: (forgeConfig, packageResult) => {
      // This hook is used to remove the quarantine attribute from the app bundle on macOS
      // which causes the "damaged file" error.
      if (packageResult.platform === 'darwin') {
        const appPath = packageResult.outputPaths[0];
        console.log(`Running xattr -cr on ${appPath} to prevent "damaged file" error.`);
        try {
          execSync(`xattr -cr "${appPath}"`);
          console.log('Successfully removed quarantine attribute.');
        } catch (error) {
          console.error('Failed to remove quarantine attribute:', error);
        }
      }
    }
  },
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'szmania',
          name: 'Voices_of_the_Court'
        },
        prerelease: true
      }
    }
  ]
};
