import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Playwright ne charge pas .env.local (convention Next, pas Node) : on le fait
// explicitement pour que les tests voient E2E_AUTH_EMAIL / E2E_AUTH_PASSWORD.
loadEnvConfig(process.cwd())

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'mobile', use: devices['Pixel 5'] },
  ],
})
