
const path = require('path');

module.exports = {
  packagerConfig: {
     icon: './build/icons/icon.ico',
    //"asar":true
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: { loadingGif: path.join(__dirname, 'build', 'icons', 'installerPic.png')}
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
  ],
  ignore: "/^\\/\\./"
};
