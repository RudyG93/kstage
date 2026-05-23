import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import jsxA11y from 'eslint-plugin-jsx-a11y'

// eslint-config-next already registers the jsx-a11y plugin.
// We spread only the rules from the recommended config to avoid redefining the plugin.
const jsxA11yRules = jsxA11y.flatConfigs.recommended.rules

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      ...jsxA11yRules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/jsx-key': 'error',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
