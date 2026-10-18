const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expo,
  { ignores: ['android/**', 'ios/**', 'dist/**'] },
  {
    files: ['src/app/index.tsx'],
    // These compiler heuristics mistake the button/search handler factories for
    // render-time calls. Refs and time are accessed only in native event handlers.
    rules: { 'react-hooks/refs': 'off', 'react-hooks/purity': 'off' },
  },
]);
