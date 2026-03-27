const { test, expect } = require('@playwright/test');
const { loginAsAdmin, openView } = require('./helpers/session');

test.describe('Archive and customers', () => {
  test('renders archive filters and customer detail flows', async ({ page, request }) => {
    await loginAsAdmin(page, request);

    await openView(page, 'archive');

    await expect(page.locator('#archive-list .team-ticket-card')).toHaveCount(1);
    await expect(page.locator('#filter-office option')).toHaveCount(3);
    await expect(page.locator('#filter-agent option')).toHaveCount(3);

    await page.locator('#filter-agent').selectOption('all');
    await expect(page.locator('#archive-list .team-ticket-card')).toHaveCount(2);

    await page.locator('#archive-list .team-ticket-card').first().click();
    await expect(page.locator('#archive-detail')).toBeVisible();
    await expect(page.locator('#archive-detail')).toContainText('Olivia');

    const customersResponse = page.waitForResponse((response) =>
      response.url().includes('/api/customers') && response.ok()
    );

    await openView(page, 'customers');
    await customersResponse;

    await page.locator('#customer-search-main').fill('Anna');
    await expect(page.locator('#customer-list .team-ticket-card')).toHaveCount(1);

    await page.locator('#customer-list .team-ticket-card').first().click();
    await expect(page.locator('#customer-detail')).toBeVisible();
    await expect(page.locator('#customer-detail')).toContainText('Anna Andersson');

    await page.locator('#cust-detail-ai-btn').click();
    await expect(page.locator('#cust-detail-ai-panel')).toBeVisible();
    await expect(page.locator('#cust-detail-ai-text')).toContainText('Sammanfattning');

    await page.locator('#customer-detail .notes-trigger-btn').click();
    await expect(page.locator('#customer-notes-overlay')).toBeVisible();
    await expect(page.locator('#customer-notes-list')).toContainText('Vanlig kund');
  });
});
