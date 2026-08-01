/** @type {import('jest').Config} */
// Lightweight unit tests for the pure logic (no native/expo deps). Uses ts-jest
// in transpile-only mode with an isolated commonjs config so the Expo/RN tsconfig
// doesn't get in the way.
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
};
