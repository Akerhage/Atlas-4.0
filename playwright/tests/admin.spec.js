const { test, expect } = require('@playwright/test');
const { loginAsAdmin, openView } = require('./helpers/session');

test.describe('Admin surfaces', () => {
  test('renders users, offices, and config knowledge views', async ({ page, request }) => {
    await loginAsAdmin(page, request);

    await openView(page, 'admin');

    await expect(page.locator('#admin-main-list .admin-mini-card')).toHaveCount(3);

    await page.locator('#admin-main-list .admin-mini-card').first().click();
    await expect(page.locator('#admin-detail-content')).toBeVisible();
    await expect(page.locator('#admin-detail-content')).toContainText('Atlas Admin');

    await page.locator('#view-admin .header-tab').nth(1).click();
    await expect(page.locator('#admin-main-list .admin-mini-card')).toHaveCount(2);

    await page.locator('#admin-main-list .admin-mini-card').filter({ hasText: 'Stockholm' }).click();
    await expect(page.locator('#office-detail-header')).toBeVisible();
    await expect(page.locator('#admin-detail-content')).toContainText('Stockholm');

    await page.locator('#view-admin .header-tab').nth(2).click();
    await expect(page.locator('#admin-main-list .admin-sysconfig-nav-item')).toHaveCount(11);

    await page.locator('#admin-main-list .admin-sysconfig-nav-item').nth(2).click();
    await expect(page.locator('#admin-detail-content')).toContainText('atlas-support.se');

    await page.locator('#admin-main-list .admin-sysconfig-nav-item').nth(7).click();
    await expect(page.locator('#kb-sublist .admin-sysconfig-nav-item')).toHaveCount(2);

    await page.locator('#kb-sublist .admin-sysconfig-nav-item').first().click();
    await expect(page.locator('#admin-detail-content')).toContainText('650 kronor');
  });
});
