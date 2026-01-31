
const path = require('path');

module.exports = {
  packagerConfig: {
     icon: './build/icons/icon.ico',
    //"asar":true
    ignore: /^\/\./,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-nsis',
      platforms: ['win32'],
      config: {
        oneClick: false,
        perMachine: false
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
    

  },
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'szmania',
          name: 'Voices_of_the_Court'
        },
        prerelease: false
      }
    }
  ]
};
