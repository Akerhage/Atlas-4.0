const { test, expect } = require('@playwright/test');
const { loginAsAdmin, openView } = require('./helpers/session');

test.describe('Templates and about', () => {
  test('renders template tabs and about dashboard', async ({ page, request }) => {
    await loginAsAdmin(page, request);

    await openView(page, 'templates');

    await expect(page.locator('#badge-tmpl-mine')).toHaveText('1');
    await expect(page.locator('#template-list .template-item')).toHaveCount(1);

    await page.locator('#template-list .template-item').first().click();
    await expect(page.locator('#template-editor-form')).toBeVisible();
    await expect(page.locator('#template-title-input')).toHaveValue('Min privata uppfoljning');

    await page.locator('#template-tabs .header-tab[data-group="BIL"]').click();
    await expect(page.locator('#template-list .template-item')).toHaveCount(1);
    await expect(page.locator('#template-list')).toContainText('B-korkort priser');

    await openView(page, 'about');

    await expect(page.locator('#theme-select')).toBeVisible();
    await expect(page.locator('#server-version-display')).toHaveText('4.0.0-playwright');
    await expect(page.locator('#about-stats-content')).toContainText('18');
    await expect(page.locator('#about-stats-content')).toContainText('11');
  });
});
