// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      'local-rn': {
        rules: {
          'no-deprecated-rn-shadows': require('./eslint-rules/no-deprecated-rn-shadows.js'),
        }
      }
    },
    rules: {
      'local-rn/no-deprecated-rn-shadows': ['warn', { allowInFiles: ['utils/shadow.ts'] }]
    }
  }
]);
