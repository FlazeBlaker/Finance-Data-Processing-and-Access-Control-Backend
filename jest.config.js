module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 10000,
  // Setup file for test database initialization
  globalSetup: './test/setup.js',
  globalTeardown: './test/teardown.js'
};
