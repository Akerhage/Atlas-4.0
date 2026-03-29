import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.ATLAS_E2E_BASE_URL || 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.ATLAS_E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        port: 5173,
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
      },
})
