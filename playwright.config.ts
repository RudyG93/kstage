import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Playwright ne charge pas .env.local (convention Next, pas Node) : on le fait
// explicitement pour que les tests voient E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD.
loadEnvConfig(process.cwd())

const IS_CI = !!process.env.CI

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: IS_CI,
  // Le trace on-first-retry (déjà configuré) devient exploitable avec 1 retry.
  retries: IS_CI ? 1 : 0,
  // ubuntu-latest = 4 vCPU → le défaut donnerait déjà 2 ; on fige pour être
  // déterministe. Ne pas descendre à 1 (double le wall time pour rien).
  workers: IS_CI ? 2 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // CI : sert le build de production du step précédent (`next start` boot en
    // ~1 s, routes précompilées) — un dev server Turbopack froid compile chaque
    // route à la demande pendant que 28 tests tournent en parallèle → timeouts
    // (cause des runs rouges du 2026-07-05). Local : dev inchangé.
    command: IS_CI ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !IS_CI,
    // Local : Next 16 + Turbopack peut prendre 60-120s au cold start selon le
    // filesystem (warning observé sur E:\ Windows).
    timeout: IS_CI ? 60_000 : 180_000,
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'mobile', use: devices['Pixel 5'] },
  ],
})
