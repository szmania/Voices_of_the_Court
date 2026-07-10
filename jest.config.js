module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/out/'],
  testMatch: ['**/tests/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^electron$': '<rootDir>/__mocks__/electron.js',
    '^\\./(.*)\\.js$': '<rootDir>/src/main/$1',
    '^\\.\\./(.*)\\.js$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
};