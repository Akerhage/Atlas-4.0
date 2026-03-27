const { expect } = require('@playwright/test');

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAllowedViews(rawValue) {
  if (!rawValue) return null;
  if (Array.isArray(rawValue)) return rawValue;
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getExpectedVisibleViews(user) {
  const role = user?.role || '';
  const isAdmin = role === 'admin';
  const allowed = parseAllowedViews(user?.allowed_views ?? null);

  const visibleViews = ['chat'];

  if (isAdmin || !allowed || allowed.includes('my-tickets')) visibleViews.push('my-tickets');
  if (isAdmin) visibleViews.push('inbox');
  if (isAdmin || !allowed || allowed.includes('archive')) visibleViews.push('archive');
  if (isAdmin || !allowed || allowed.includes('customers')) visibleViews.push('customers');

  const adminKeys = ['admin-users', 'admin-offices', 'admin-config'];
  const agentHasAdminAccess = !isAdmin && allowed && adminKeys.some((key) => allowed.includes(key));
  if (isAdmin || agentHasAdminAccess) visibleViews.push('admin');

  if (isAdmin || !allowed || allowed.includes('templates')) visibleViews.push('templates');
  if (isAdmin || !allowed || allowed.includes('about')) visibleViews.push('about');

  return visibleViews;
}

async function getVisibleMenuViews(page) {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.sidebar-menu .menu-item[data-view]'))
      .filter((item) => {
        const styles = window.getComputedStyle(item);
        return styles.display !== 'none' && styles.visibility !== 'hidden';
      })
      .map((item) => item.dataset.view)
      .filter(Boolean);
  });
}

async function loginToLiveAtlas(page) {
  const username = getRequiredEnv('ATLAS_E2E_USERNAME');
  const password = getRequiredEnv('ATLAS_E2E_PASSWORD');

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const loginModal = page.locator('#login-modal');
  await expect(loginModal).toBeVisible({ timeout: 30_000 });

  await page.locator('#login-user').fill(username);
  await page.locator('#login-pass').fill(password);

  const loginResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === 'POST' &&
      response.url().includes('/api/auth/login');
  }, { timeout: 30_000 });
  const postLoginNavigationPromise = page.waitForNavigation({
    waitUntil: 'domcontentloaded',
    timeout: 10_000,
  }).catch(() => null);

  await page.locator('#login-form').locator('button[type="submit"]').click();

  const loginResponse = await loginResponsePromise;
  const responseText = await loginResponse.text();

  let responseJson = null;
  try {
    responseJson = JSON.parse(responseText);
  } catch {
    responseJson = null;
  }

  if (!loginResponse.ok()) {
    const loginErrorText = (await page.locator('#login-error').textContent() || '').trim();
    const apiErrorText = typeof responseJson?.error === 'string' ? responseJson.error : '';
    const fallbackText = responseText.trim();

    throw new Error(
      `Atlas login failed (${loginResponse.status()}): ${apiErrorText || loginErrorText || fallbackText || 'empty response body'}`
    );
  }

  await expect.poll(async () => {
    try {
      return await page.evaluate(() => ({
        hasToken: Boolean(window.localStorage.getItem('atlas_token')),
        hasUser: Boolean(window.localStorage.getItem('atlas_user')),
      }));
    } catch {
      return { hasToken: false, hasUser: false };
    }
  }, { timeout: 30_000 }).toEqual({ hasToken: true, hasUser: true });

  await postLoginNavigationPromise;

  if (!(await page.locator('#user-profile-container').isVisible())) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }

  await expect(page.locator('#user-profile-container')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#login-btn-sidebar')).toBeHidden();
  await expect(page.locator('#current-user-name')).not.toHaveText('');

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

  return sessionState.storedUser;
}

async function openLiveView(page, viewId) {
  const menuItem = page.locator(`.menu-item[data-view="${viewId}"]`);
  await expect(menuItem).toBeVisible({ timeout: 15_000 });
  await menuItem.click();
  await expect(page.locator(`#view-${viewId}`)).toBeVisible({ timeout: 30_000 });
}

module.exports = {
  getRequiredEnv,
  getExpectedVisibleViews,
  getVisibleMenuViews,
  loginToLiveAtlas,
  openLiveView,
  parseAllowedViews,
};
