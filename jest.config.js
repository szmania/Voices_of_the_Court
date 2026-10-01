module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/out/', '/dist/'],
  testMatch: ['**/tests/**/*.+(spec|test).ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Timeline modules ported from 1.x use NodeNext-style './x.js' relative
  // imports; strip the extension so jest resolves the .ts sources.
  moduleNameMapper: {
    '^(\.{1,2}/.*)\.js$': '$1',
    '^electron$': '<rootDir>/__mocks__/electron.js',
  },
  modulePathIgnorePatterns: [],
  transform: {
    '^.+\.ts$': 'ts-jest',
  },
  resolver: '<rootDir>/jest.resolver.js',
  clearMocks: true,
};
