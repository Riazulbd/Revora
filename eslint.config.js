const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', '.expo/*', 'node_modules/*', 'scripts/*', 'design/*', 'functions/lib/**', 'functions/node_modules/**', 'functions/test/**'],
  },
  {
    // Config plugins and metro/babel config run in Node, not in the app bundle.
    files: ['plugins/**/*.js', '*.config.js'],
    languageOptions: { globals: { __dirname: 'readonly', require: 'readonly', module: 'writable', process: 'readonly' } },
  },
  {
    rules: {
      // Production code must not leave console output behind (requirement 68).
      'no-console': 'error',
      'no-debugger': 'error',
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    // Jest setup has to use require() to reach a package's jest mock.
    files: ['**/*.test.ts', '**/*.test.tsx', 'jest.setup.ts'],
    rules: { 'no-console': 'off', '@typescript-eslint/no-require-imports': 'off' },
  },
]);
