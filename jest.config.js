module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/out/'],
  modulePathIgnorePatterns: ['/out/'],
  testMatch: ['**/tests/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^electron$': '<rootDir>/__mocks__/electron.js',
    '^\\./src/(.*)\\.js$': '<rootDir>/src/$1',
    '^\\.\\./src/(.*)\\.js$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};
