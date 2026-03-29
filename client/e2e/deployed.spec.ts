/**
 * E2E tests for deployed React app.
 *
 * Run against live environment:
 *   ATLAS_E2E_BASE_URL=https://www.atlas-support.se \
 *   ATLAS_E2E_USER=playwright_user \
 *   ATLAS_E2E_PASS=<password> \
 *   npx playwright test e2e/deployed.spec.ts
 */
import { test, expect } from '@playwright/test'
import { login, getVisibleMenuLabels } from './helpers'

// Skip entire file if no live URL is configured
const isLive = !!process.env.ATLAS_E2E_BASE_URL
const describeOrSkip = isLive ? test.describe : test.describe.skip

describeOrSkip('Deployed React App', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('login loads the app and shows sidebar', async ({ page }) => {
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('#user-profile-container')).toBeVisible()
    await expect(page.locator('#server-status')).toBeVisible()
  })

  test('socket connects successfully', async ({ page }) => {
    // Wait for server status to show connected
    await expect(page.locator('#server-status')).toContainText('LIVE', { timeout: 20_000 })
  })

  test('sidebar menu renders correct items', async ({ page }) => {
    const labels = await getVisibleMenuLabels(page)
    expect(labels).toContain('Hem')
    expect(labels.length).toBeGreaterThanOrEqual(2)
  })

  test('Home view loads and chat input is functional', async ({ page }) => {
    await page.locator('.menu-item', { hasText: 'Hem' }).click()
    await expect(page.locator('#view-chat')).toBeVisible()
    const chatInput = page.locator('.chat-input')
    await expect(chatInput).toBeVisible()
    await chatInput.fill('Testar Atlas')
    await expect(chatInput).toHaveValue('Testar Atlas')
    // Clear without sending to avoid mutating data
    await chatInput.clear()
  })

  test('all visible views load without errors', async ({ page }) => {
    const labels = await getVisibleMenuLabels(page)

    for (const label of labels) {
      await page.locator('.menu-item', { hasText: label }).click()
      // Wait for view to render (no crash, no blank screen)
      await page.waitForTimeout(500)

      // Verify no uncaught errors by checking the page didn't redirect to login
      await expect(page.locator('.sidebar')).toBeVisible()

      // Verify main content area has content
      const mainArea = page.locator('.main-content-area')
      await expect(mainArea).toBeVisible()
    }
  })

  test('Inbox tabs switch without errors (admin only)', async ({ page }) => {
    const inboxItem = page.locator('.menu-item', { hasText: 'Inkorgen' })
    if (!(await inboxItem.isVisible())) {
      test.skip()
      return
    }

    await inboxItem.click()
    await expect(page.locator('#view-inbox')).toBeVisible()

    const tabs = ['Nya Live-Chattar', 'Nya Mail-ärenden', 'Plockade/Routade']
    for (const tabLabel of tabs) {
      await page.locator('.header-tab', { hasText: tabLabel }).click()
      await expect(page.locator('.header-tab.active', { hasText: tabLabel })).toBeVisible()
    }
  })

  test('Admin view loads and tabs work (admin only)', async ({ page }) => {
    const adminItem = page.locator('.menu-item', { hasText: 'Admin' })
    if (!(await adminItem.isVisible())) {
      test.skip()
      return
    }

    await adminItem.click()
    await expect(page.locator('#view-admin')).toBeVisible()

    // Switch tabs
    await page.locator('.header-tab', { hasText: 'Kontor & Utbildning' }).click()
    await expect(page.locator('.header-tab.active', { hasText: 'Kontor & Utbildning' })).toBeVisible()

    await page.locator('.header-tab', { hasText: 'Systemkonfiguration' }).click()
    await expect(page.locator('.header-tab.active', { hasText: 'Systemkonfiguration' })).toBeVisible()

    await page.locator('.header-tab', { hasText: 'Agenter' }).click()
    await expect(page.locator('.header-tab.active', { hasText: 'Agenter' })).toBeVisible()
  })

  test('Templates view loads', async ({ page }) => {
    const item = page.locator('.menu-item', { hasText: 'Mailmallar' })
    if (!(await item.isVisible())) {
      test.skip()
      return
    }

    await item.click()
    await expect(page.locator('#view-templates')).toBeVisible()
  })

  test('profile modal opens on profile click', async ({ page }) => {
    await page.locator('#user-profile-container').click()
    // Should show profile modal overlay
    await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5_000 })
    // Close it
    await page.keyboard.press('Escape')
    await expect(page.locator('.modal-overlay')).not.toBeVisible()
  })

  test('logout returns to login screen', async ({ page }) => {
    await page.locator('.logout-btn').click()
    await expect(page.locator('.ln-overlay')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('.ln-app-name')).toHaveText('ATLAS')
  })
})
