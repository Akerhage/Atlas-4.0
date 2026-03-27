const { expect } = require('@playwright/test');

async function loginAsAdmin(page, request) {
  await page.goto('/');
  await expect(page.locator('#login-modal')).toBeVisible();

  const response = await request.post('/api/auth/login', {
    data: {
      username: 'atlas-admin',
      password: 'playwright'
    }
  });

  const payload = await response.json();

  await page.evaluate(({ token, user }) => {
    localStorage.setItem('atlas_token', token);
    localStorage.setItem('atlas_user', JSON.stringify(user));
  }, payload);

  await page.reload();

  await expect(page.locator('#user-profile-container')).toBeVisible();
  await expect(page.locator('#current-user-name')).toContainText('Atlas');
}

async function openView(page, viewId) {
  await page.locator(`.menu-item[data-view="${viewId}"]`).click();
  await expect(page.locator(`#view-${viewId}`)).toBeVisible();
}

module.exports = {
  loginAsAdmin,
  openView
};
