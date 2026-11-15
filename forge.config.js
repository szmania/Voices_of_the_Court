
const path = require('path');
const { execSync } = require('child_process');

// --- macOS signing & notarization (optional) ---
// Set these environment variables to sign and notarize with a real Apple Developer ID:
//   APPLE_SIGNING_IDENTITY       e.g. "Developer ID Application: Your Name (TEAMID)"
//   APPLE_ID                     Apple ID email used for notarization
//   APPLE_APP_SPECIFIC_PASSWORD  App-specific password for APPLE_ID
//   APPLE_TEAM_ID                Apple Developer Team ID
// When APPLE_SIGNING_IDENTITY is set, Forge signs via @electron/osx-sign (osxSign) and
// notarizes via @electron/notarize (osxNotarize, only when all three notarization vars
// are present). Without it, the postPackage hook below falls back to ad-hoc signing.
const signingIdentity = process.env.APPLE_SIGNING_IDENTITY;

const packagerConfig = {
  icon: './build/icons/icon', // Electron Forge will automatically use .ico for Windows and .icns for Mac
  //"asar":true
  ignore: /^(\/out|\/tests|\/logs|\/debug|\/\.)/
};

if (signingIdentity) {
  packagerConfig.osxSign = {
    identity: signingIdentity,
    hardenedRuntime: true,
    gatekeeperAssess: false
  };
  // Only notarize when all three credentials are present; osxNotarize with
  // undefined values would fail the build.
  if (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) {
    packagerConfig.osxNotarize = {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    };
  }
}

module.exports = {
  outDir: process.platform === 'win32' ? 'C:/tmp' : 'out',
  packagerConfig,
  rebuildConfig: {
    // These Node-API modules ship platform binaries that do not depend on Electron's ABI.
    ignoreModules: ['argon2', 'electron-overlay-window', '@paymoapp/active-window']
  },
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
        // Ad-hoc signing fallback when no real signing identity is configured.
        // Makes locally-built copies launchable and addresses the "damaged file"
        // error more robustly than xattr alone.
        if (!signingIdentity) {
          console.log(`Ad-hoc signing ${appPath} (codesign --force --deep --sign -).`);
          try {
            execSync(`codesign --force --deep --sign - "${appPath}"`);
            console.log('Successfully ad-hoc signed the app bundle.');
          } catch (error) {
            console.error('Failed to ad-hoc sign the app bundle:', error);
          }
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
