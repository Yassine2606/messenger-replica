/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'backend/dist/*', 'backend/dist/**/*'],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
]);
