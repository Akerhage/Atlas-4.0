const { test, expect } = require('@playwright/test');

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

test('live Atlas login succeeds for the Playwright user', async ({ page }) => {
  const username = getRequiredEnv('ATLAS_E2E_USERNAME');
  const password = getRequiredEnv('ATLAS_E2E_PASSWORD');

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const loginModal = page.locator('#login-modal');
  await expect(loginModal).toBeVisible({ timeout: 30_000 });

  await page.locator('#login-user').fill(username);
  await page.locator('#login-pass').fill(password);
  await page.locator('#login-form').locator('button[type="submit"]').click();

  await page.waitForFunction(() => {
    return Boolean(window.localStorage.getItem('atlas_token')) &&
      Boolean(window.localStorage.getItem('atlas_user'));
  }, null, { timeout: 30_000 });

  // Appen laddar själv om efter lyckad login. Vi laddar om roten en gång till
  // för att verifiera post-login-state deterministiskt i samma test.
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#user-profile-container')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#login-btn-sidebar')).toBeHidden();

  const sessionState = await page.evaluate(() => {
    const storedUser = JSON.parse(window.localStorage.getItem('atlas_user') || 'null');
    return {
      hasToken: Boolean(window.localStorage.getItem('atlas_token')),
      storedUser,
    };
  });

  expect(sessionState.hasToken).toBeTruthy();
  expect(sessionState.storedUser).not.toBeNull();
  expect((sessionState.storedUser.username || '').toLowerCase()).toBe(username.toLowerCase());

  await expect(page.locator('#current-user-name')).not.toHaveText('');
});
