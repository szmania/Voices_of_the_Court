module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/out/', '/dist/'],
  testMatch: ['**/tests/**/*.+(spec|test).ts'],
  moduleNameMapper: {
    '^electron$': '<rootDir>/__mocks__/electron.js',
  },
  modulePathIgnorePatterns: [],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  resolver: '<rootDir>/jest.resolver.js',
};