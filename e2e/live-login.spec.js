const { test, expect } = require('@playwright/test');
const {
  getExpectedVisibleViews,
  getVisibleMenuViews,
  loginToLiveAtlas,
} = require('./helpers/live-session');

test('live Atlas login succeeds for the Playwright user', async ({ page }) => {
  const user = await loginToLiveAtlas(page);
  const expectedViews = getExpectedVisibleViews(user);
  const actualViews = await getVisibleMenuViews(page);

  expect(actualViews).toEqual(expectedViews);
  await expect(page.locator('.menu-item[data-view="chat"]')).toBeVisible();
  await expect(page.locator('#current-user-name')).not.toHaveText('');
});
