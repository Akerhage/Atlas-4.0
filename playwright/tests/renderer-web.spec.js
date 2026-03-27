const { test, expect } = require('@playwright/test');
const { loginAsAdmin } = require('./helpers/session');

const holdOpenMs = Number(process.env.PLAYWRIGHT_HOLD_OPEN_MS || 0);

test.describe('Atlas renderer shell', () => {
  test('logs in and renders the main navigation shell', async ({ page, request }) => {
    await loginAsAdmin(page, request);

    await expect(page.locator('#view-chat')).toBeVisible();
    await expect(page.locator('#view-chat h2')).toContainText('Hem');
    await expect(page.locator('#current-user-name')).toContainText('Atlas Admin');

    await expect(page.locator('.menu-item[data-view="my-tickets"]')).toBeVisible();
    await expect(page.locator('.menu-item[data-view="inbox"]')).toBeVisible();
    await expect(page.locator('.menu-item[data-view="archive"]')).toBeVisible();
    await expect(page.locator('.menu-item[data-view="customers"]')).toBeVisible();
    await expect(page.locator('.menu-item[data-view="admin"]')).toBeVisible();
    await expect(page.locator('.menu-item[data-view="templates"]')).toBeVisible();
    await expect(page.locator('.menu-item[data-view="about"]')).toBeVisible();

    await expect(page.locator('#badge-inbox')).toHaveText('2');
    await expect(page.locator('#badge-my-tickets')).toHaveText('2');

    if (holdOpenMs > 0) {
      await page.waitForTimeout(holdOpenMs);
    }
  });
});
