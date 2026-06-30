module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/out/'],
  testMatch: ['**/tests/?(*.)+(spec|test).ts'],
};