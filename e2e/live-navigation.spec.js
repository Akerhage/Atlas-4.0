const { test, expect } = require('@playwright/test');
const { loginToLiveAtlas, openLiveView } = require('./helpers/live-session');

test('live Atlas navigates across deployed views without mutating data', async ({ page }) => {
  await loginToLiveAtlas(page);

  await openLiveView(page, 'chat');
  await expect(page.locator('#chat-form')).toBeVisible();
  await expect(page.locator('#my-chat-input')).toBeVisible();

  await openLiveView(page, 'my-tickets');
  await expect(page.locator('#my-tickets-tab-btn-chats')).toBeVisible();
  await expect(page.locator('#my-tickets-tab-btn-mail')).toBeVisible();
  await expect(page.locator('#my-tickets-list')).toBeVisible();
  await page.locator('#my-tickets-tab-btn-mail').click();
  await expect(page.locator('#my-tickets-tab-btn-mail')).toHaveClass(/active/);
  await page.locator('#my-tickets-tab-btn-chats').click();
  await expect(page.locator('#my-tickets-tab-btn-chats')).toHaveClass(/active/);

  await openLiveView(page, 'inbox');
  await expect(page.locator('#inbox-tab-btn-chats')).toBeVisible();
  await expect(page.locator('#inbox-tab-btn-mail')).toBeVisible();
  await expect(page.locator('#inbox-tab-btn-claimed')).toBeVisible();
  await expect(page.locator('#inbox-list')).toBeVisible();
  await expect(page.locator('#inbox-search')).toBeVisible();
  await page.locator('#inbox-tab-btn-mail').click();
  await expect(page.locator('#inbox-tab-btn-mail')).toHaveClass(/active/);
  await page.locator('#inbox-tab-btn-claimed').click();
  await expect(page.locator('#inbox-tab-btn-claimed')).toHaveClass(/active/);
  await page.locator('#inbox-tab-btn-chats').click();
  await expect(page.locator('#inbox-tab-btn-chats')).toHaveClass(/active/);

  await openLiveView(page, 'archive');
  await expect(page.locator('#archive-list')).toBeVisible();
  await expect(page.locator('#filter-search')).toBeVisible();
  await expect(page.locator('#filter-office')).toBeVisible();
  await expect(page.locator('#filter-agent')).toBeVisible();

  await openLiveView(page, 'customers');
  await expect(page.locator('#customer-list')).toBeVisible();
  await expect(page.locator('#customer-search-top')).toBeVisible();
  await expect(page.locator('#customer-search-main')).toBeVisible();

  await openLiveView(page, 'templates');
  await expect(page.locator('#template-tabs')).toBeVisible();
  await expect(page.locator('#template-list')).toBeVisible();
  await page.locator('#template-tabs .header-tab[data-group="BIL"]').click();
  await expect(page.locator('#template-tabs .header-tab[data-group="BIL"]')).toHaveClass(/active/);
  await page.locator('#template-tabs .header-tab[data-group="mine"]').click();
  await expect(page.locator('#template-tabs .header-tab[data-group="mine"]')).toHaveClass(/active/);

  await openLiveView(page, 'about');
  await expect(page.locator('#about-grid')).toBeVisible();
  await expect(page.locator('#theme-select')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#server-version-display')).toBeVisible({ timeout: 30_000 });

  const adminMenu = page.locator('.menu-item[data-view="admin"]');
  if (await adminMenu.isVisible()) {
    await openLiveView(page, 'admin');
    await expect(page.locator('#admin-main-list')).toBeVisible();
    await expect(page.locator('#view-admin .header-tab')).toHaveCount(3);
    await page.locator('#view-admin .header-tab').nth(1).click();
    await expect(page.locator('#view-admin .header-tab').nth(1)).toHaveClass(/active/);
    await page.locator('#view-admin .header-tab').nth(2).click();
    await expect(page.locator('#view-admin .header-tab').nth(2)).toHaveClass(/active/);
  }
});
