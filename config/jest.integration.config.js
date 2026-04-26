/**
 * Jest Integration Test Configuration
 *
 * Extends the base unit test config with integration-specific settings.
 * Uses jest.mock('@forge/api') to mock Forge runtime functions since
 * nock cannot intercept Forge platform proxied requests.
 *
 * [TEST-QA-0764] Tests run in isolation without external dependencies.
 * [TEST-QA-204] afterEach cleanup is mandatory in each test file.
 */

const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

/** @type {import('jest').Config} */
module.exports = {
  rootDir: projectRoot,
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/integration'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transformIgnorePatterns: ['node_modules/(?!(?:@atlaskit|@babel/runtime)/)'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
    '^.+\\.jsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/tests/helpers/styleMock.js',
  },
  // No coverage thresholds for integration tests — coverage is enforced at unit level
  collectCoverageFrom: [],
};
