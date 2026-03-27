const { test, expect } = require('@playwright/test');
const { loginAsAdmin, openView } = require('./helpers/session');

test.describe('Inbox and my tickets', () => {
  test('renders inbox groups, detail view, search, and my tickets tabs', async ({ page, request }) => {
    await loginAsAdmin(page, request);

    await openView(page, 'inbox');

    await expect(page.locator('#inbox-tab-badge-chats')).toHaveText('1');
    await expect(page.locator('#inbox-tab-badge-mail')).toHaveText('1');
    await expect(page.locator('#inbox-tab-badge-claimed')).toHaveText('1');
    await expect(page.locator('#inbox-list .team-ticket-card')).toHaveCount(1);

    await page.locator('#inbox-list .team-ticket-card').first().click();
    await expect(page.locator('#inbox-detail')).toBeVisible();
    await expect(page.locator('#inbox-detail-body')).toContainText('korlektion');

    await page.locator('#inbox-tab-btn-mail').click();
    await expect(page.locator('#inbox-list .team-ticket-card')).toHaveCount(1);
    await expect(page.locator('#inbox-list')).toContainText('Erik');

    await page.locator('#inbox-search').fill('anna');
    await expect(page.locator('#inbox-list .team-ticket-card')).toHaveCount(1);
    await expect(page.locator('#inbox-list')).toContainText('Anna');

    await openView(page, 'my-tickets');

    await expect(page.locator('#my-tickets-tab-badge-chats')).toHaveText('1');
    await expect(page.locator('#my-tickets-tab-badge-mail')).toHaveText('1');
    await expect(page.locator('#my-tickets-list .team-ticket-card')).toHaveCount(1);

    await page.locator('#my-tickets-list .team-ticket-card').first().click();
    await expect(page.locator('#my-ticket-detail')).toBeVisible();
    await expect(page.locator('#my-ticket-detail')).toContainText('Mikael');

    await page.locator('#my-tickets-tab-btn-mail').click();
    await expect(page.locator('#my-tickets-list .team-ticket-card')).toHaveCount(1);
    await expect(page.locator('#my-tickets-list')).toContainText('Lina');
  });
});
