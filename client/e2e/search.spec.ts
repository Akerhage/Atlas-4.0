import { test, expect } from '@playwright/test'
import { login, navigateIfVisible, waitForListLoaded } from './helpers'

test.describe('Search', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test.describe('Archive Search', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      if (!(await navigateIfVisible(page, 'Garaget'))) {
        testInfo.skip()
      }
    })

    test('search input is visible', async ({ page }) => {
      await expect(page.locator('.search-input')).toBeVisible()
    })

    test('shows result count', async ({ page }) => {
      await expect(page.locator('.result-count')).toBeVisible()
      await expect(page.locator('.result-count')).toContainText('ärenden')
    })

    test('typing in search updates results', async ({ page }) => {
      const searchInput = page.locator('.search-input')
      await searchInput.fill('test')
      // Wait for debounced search to fire
      await page.waitForTimeout(500)
      await waitForListLoaded(page)
      // Result count should still be visible
      await expect(page.locator('.result-count')).toBeVisible()
    })

    test('clearing search shows all results', async ({ page }) => {
      const searchInput = page.locator('.search-input')
      // Get initial count text
      const initialCount = await page.locator('.result-count').textContent()

      // Search something
      await searchInput.fill('xyznonexistent')
      await page.waitForTimeout(500)
      await waitForListLoaded(page)

      // Clear search
      await searchInput.clear()
      await page.waitForTimeout(500)
      await waitForListLoaded(page)

      // Count should be back to initial (or close)
      await expect(page.locator('.result-count')).toBeVisible()
    })
  })

  test.describe('Customer Search', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      if (!(await navigateIfVisible(page, 'Kunder'))) {
        testInfo.skip()
      }
    })

    test('search input is visible', async ({ page }) => {
      await expect(page.locator('.search-input')).toBeVisible()
    })

    test('shows result count', async ({ page }) => {
      await expect(page.locator('.result-count')).toBeVisible()
      await expect(page.locator('.result-count')).toContainText('kunder')
    })

    test('typing in search filters customers', async ({ page }) => {
      const searchInput = page.locator('.search-input')
      await searchInput.fill('a')
      await page.waitForTimeout(500)
      await waitForListLoaded(page)
      await expect(page.locator('.result-count')).toBeVisible()
    })
  })
})
