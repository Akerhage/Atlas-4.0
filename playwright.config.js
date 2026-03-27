const { defineConfig } = require('@playwright/test');

const serverHost = process.env.PLAYWRIGHT_HOST || 'localhost';
const serverPort = process.env.PLAYWRIGHT_PORT || '3001';
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || `http://${serverHost}:${serverPort}`;
const browserChannel =
  process.env.PLAYWRIGHT_BROWSER_CHANNEL ||
  (process.platform === 'win32' ? 'msedge' : undefined);
const slowMo = Number(process.env.PLAYWRIGHT_SLOWMO || 0);

module.exports = defineConfig({
  testDir: './playwright/tests',
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: {
      width: 1440,
      height: 960
    }
  },
  projects: [
    {
      name: browserChannel ? `chromium-${browserChannel}` : 'chromium',
      use: {
        browserName: 'chromium',
        channel: browserChannel,
        launchOptions: slowMo > 0 ? { slowMo } : undefined
      }
    }
  ],
  webServer: {
    command: 'node playwright/mock-server.js',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30_000,
    env: {
      PLAYWRIGHT_PORT: serverPort,
      PLAYWRIGHT_HOST: serverHost
    }
  }
});
