/**
 * Security-rules tests run in Node against the Firestore emulator, not in the
 * React Native environment — so they need their own Jest project.
 */
module.exports = {
  testEnvironment: 'node',
  // The serialisers under test import the native Firestore package for its
  // Timestamp and DocumentData types; the web SDK is API-compatible for both.
  moduleNameMapper: {
    '^@react-native-firebase/firestore$': 'firebase/firestore',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: { '^.+\\.tsx?$': ['babel-jest', { presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]] }] },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  testTimeout: 20000,
};
