const { test, expect } = require('@playwright/test');
const {
  getExpectedVisibleViews,
  getVisibleMenuViews,
  loginToLiveAtlas,
  openLiveView,
} = require('./helpers/live-session');

test('live Atlas navigates across deployed views without mutating data', async ({ page }) => {
  const user = await loginToLiveAtlas(page);
  const expectedViews = getExpectedVisibleViews(user);
  const actualViews = await getVisibleMenuViews(page);

  expect(actualViews).toEqual(expectedViews);

  await openLiveView(page, 'chat');
  await expect(page.locator('#chat-form')).toBeVisible();
  await expect(page.locator('#my-chat-input')).toBeVisible();

  if (actualViews.includes('my-tickets')) {
    await openLiveView(page, 'my-tickets');
    await expect(page.locator('#my-tickets-tab-btn-chats')).toBeVisible();
    await expect(page.locator('#my-tickets-tab-btn-mail')).toBeVisible();
    await expect(page.locator('#my-tickets-list')).toBeVisible();
    await page.locator('#my-tickets-tab-btn-mail').click();
    await expect(page.locator('#my-tickets-tab-btn-mail')).toHaveClass(/active/);
    await page.locator('#my-tickets-tab-btn-chats').click();
    await expect(page.locator('#my-tickets-tab-btn-chats')).toHaveClass(/active/);
  }

  if (actualViews.includes('inbox')) {
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
  }

  if (actualViews.includes('archive')) {
    await openLiveView(page, 'archive');
    await expect(page.locator('#archive-list')).toBeVisible();
    await expect(page.locator('#filter-search')).toBeVisible();
    await expect(page.locator('#filter-office')).toBeVisible();
    await expect(page.locator('#filter-agent')).toBeVisible();
  }

  if (actualViews.includes('customers')) {
    await openLiveView(page, 'customers');
    await expect(page.locator('#customer-placeholder')).toBeVisible();
    await expect(page.locator('#customer-search-top')).toBeVisible();
    await expect(page.locator('#customer-search-main')).toBeVisible();
    await expect(page.locator('#customer-detail')).toBeHidden();
  }

  if (actualViews.includes('templates')) {
    await openLiveView(page, 'templates');
    await expect(page.locator('#template-tabs')).toBeVisible();
    await expect(page.locator('#template-list')).toBeVisible();
    await page.locator('#template-tabs .header-tab[data-group="BIL"]').click();
    await expect(page.locator('#template-tabs .header-tab[data-group="BIL"]')).toHaveClass(/active/);
    await page.locator('#template-tabs .header-tab[data-group="mine"]').click();
    await expect(page.locator('#template-tabs .header-tab[data-group="mine"]')).toHaveClass(/active/);
  }

  if (actualViews.includes('about')) {
    await openLiveView(page, 'about');
    await expect(page.locator('#about-grid')).toBeVisible();
    await expect(page.locator('#theme-select')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#server-version-display')).toBeVisible({ timeout: 30_000 });
  }

  if (actualViews.includes('admin')) {
    await openLiveView(page, 'admin');
    await expect(page.locator('#admin-main-list')).toBeVisible();
    const visibleAdminTabs = page.locator('#view-admin .header-tab:visible');
    const tabCount = await visibleAdminTabs.count();
    if (user.role === 'admin') {
      expect(tabCount).toBe(3);
    } else {
      expect(tabCount).toBeGreaterThan(0);
    }
    if (tabCount > 1) {
      await visibleAdminTabs.nth(1).click();
      await expect(visibleAdminTabs.nth(1)).toHaveClass(/active/);
    }
    if (tabCount > 2) {
      await visibleAdminTabs.nth(2).click();
      await expect(visibleAdminTabs.nth(2)).toHaveClass(/active/);
    }
  }
});
