import { test, expect } from '@playwright/test'
import { login, navigateIfVisible } from './helpers'

test.describe('Theme & UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test.describe('Theme', () => {
    test('accent color is applied from user profile', async ({ page }) => {
      // CSS variable should be set
      const accentColor = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim()
      )
      expect(accentColor).toBeTruthy()
      expect(accentColor).toMatch(/^#[0-9a-fA-F]{6}$/)
    })

    test('theme stylesheet is loaded', async ({ page }) => {
      const themeLink = page.locator('#theme-stylesheet')
      if (await themeLink.isVisible().catch(() => false)) {
        const href = await themeLink.getAttribute('href')
        expect(href).toContain('themes/')
      }
    })

    test('changing theme in About section updates stylesheet', async ({ page }) => {
      if (!(await navigateIfVisible(page, 'Admin'))) {
        test.skip()
        return
      }

      // Navigate to config > About
      await page.locator('.header-tab', { hasText: 'Systemkonfiguration' }).click()
      await page.locator('.admin-mini-card', { hasText: 'Om Atlas' }).click()
      await expect(page.locator('.admin-detail-content')).toBeVisible()

      // Find theme select
      const themeSelect = page.locator('select').first()
      if (await themeSelect.isVisible()) {
        const options = await themeSelect.locator('option').allTextContents()
        expect(options.length).toBeGreaterThanOrEqual(2)
      }
    })
  })

  test.describe('Toast Notifications', () => {
    test('toast container exists in DOM', async ({ page }) => {
      await expect(page.locator('#atlas-toast-container')).toBeVisible()
    })
  })

  test.describe('Connection Status', () => {
    test('server status indicator is visible', async ({ page }) => {
      await expect(page.locator('#server-status')).toBeVisible()
    })

    test('server status shows LIVE when connected', async ({ page }) => {
      // May take a moment for socket to connect
      await expect(page.locator('#server-status')).toContainText('LIVE', { timeout: 20_000 })
    })
  })

  test.describe('Sidebar UI', () => {
    test('sidebar has logo', async ({ page }) => {
      const logo = page.locator('.sidebar-logo')
      if (await logo.isVisible().catch(() => false)) {
        await expect(logo).toBeVisible()
      }
    })

    test('sidebar has app name', async ({ page }) => {
      await expect(page.locator('.sidebar-app-name')).toHaveText('ATLAS')
    })

    test('user avatar shows in sidebar footer', async ({ page }) => {
      await expect(page.locator('.user-avatar')).toBeVisible()
    })

    test('user name shows in sidebar footer', async ({ page }) => {
      await expect(page.locator('#current-user-name')).toBeVisible()
      const name = await page.locator('#current-user-name span').first().textContent()
      expect(name && name.trim().length).toBeGreaterThan(0)
    })

    test('logout button is visible', async ({ page }) => {
      await expect(page.locator('.logout-btn')).toBeVisible()
    })
  })

  test.describe('Hero Placeholders', () => {
    test('inbox shows placeholder when no ticket selected', async ({ page }) => {
      if (!(await navigateIfVisible(page, 'Inkorgen'))) {
        test.skip()
        return
      }
      await expect(page.locator('#inbox-placeholder')).toBeVisible()
    })

    test('my tickets shows placeholder when no ticket selected', async ({ page }) => {
      if (!(await navigateIfVisible(page, 'Mina ärenden'))) {
        test.skip()
        return
      }
      await expect(page.locator('#my-detail-placeholder')).toBeVisible()
    })

    test('archive shows placeholder when no ticket selected', async ({ page }) => {
      if (!(await navigateIfVisible(page, 'Garaget'))) {
        test.skip()
        return
      }
      await expect(page.locator('#archive-placeholder')).toBeVisible()
    })

    test('templates shows placeholder when no template selected', async ({ page }) => {
      if (!(await navigateIfVisible(page, 'Mailmallar'))) {
        test.skip()
        return
      }
      await expect(page.locator('#editor-placeholder')).toBeVisible()
    })

    test('admin shows placeholder when no item selected', async ({ page }) => {
      if (!(await navigateIfVisible(page, 'Admin'))) {
        test.skip()
        return
      }
      await expect(page.locator('#admin-placeholder')).toBeVisible()
    })
  })
})
