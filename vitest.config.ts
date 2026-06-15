import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Défaut `node` (rapide) ; les rares tests DOM annotent `@vitest-environment
    // jsdom` en tête de fichier (cf. auth-menu.test.tsx). Évite de payer le coût
    // jsdom sur ~33 fichiers de logique pure.
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['**/node_modules/**', '**/tests/e2e/**'],
    passWithNoTests: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
