/**
 * Jest setup. The calculation suite is pure and needs no native mocks; the
 * component suite gets the handful of Expo/Firebase shims below.
 */
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
