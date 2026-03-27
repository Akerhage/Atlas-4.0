const { test, expect } = require('@playwright/test');
const { loginToLiveAtlas } = require('./helpers/live-session');

test('live Atlas login succeeds for the Playwright user', async ({ page }) => {
  await loginToLiveAtlas(page);

  await expect(page.locator('.menu-item[data-view="chat"]')).toBeVisible();
  await expect(page.locator('.menu-item[data-view="my-tickets"]')).toBeVisible();
  await expect(page.locator('.menu-item[data-view="inbox"]')).toBeVisible();
  await expect(page.locator('.menu-item[data-view="archive"]')).toBeVisible();
  await expect(page.locator('.menu-item[data-view="customers"]')).toBeVisible();
  await expect(page.locator('.menu-item[data-view="templates"]')).toBeVisible();
  await expect(page.locator('.menu-item[data-view="about"]')).toBeVisible();
  await expect(page.locator('#current-user-name')).not.toHaveText('');
});
