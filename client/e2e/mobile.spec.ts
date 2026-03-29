import { test, expect, devices } from '@playwright/test'
import { login } from './helpers'

// Use iPhone viewport for mobile tests
test.use({ ...devices['iPhone 13'] })

test.describe('Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('hamburger button is visible on mobile', async ({ page }) => {
    await expect(page.locator('.mobile-hamburger-btn')).toBeVisible()
  })

  test('sidebar is hidden by default on mobile', async ({ page }) => {
    // Sidebar wrapper should be off-screen (transform: translateX(-100%))
    const wrapper = page.locator('.sidebar-wrapper')
    await expect(wrapper).toBeVisible() // Element exists
    // But it should be translated off-screen
    const transform = await wrapper.evaluate(el => getComputedStyle(el).transform)
    // Should have a translateX that's not 0
    expect(transform).not.toBe('none')
  })

  test('clicking hamburger shows sidebar', async ({ page }) => {
    await page.locator('.mobile-hamburger-btn').click()
    await expect(page.locator('.sidebar-wrapper.mobile-open')).toBeVisible()
  })

  test('clicking hamburger shows overlay', async ({ page }) => {
    await page.locator('.mobile-hamburger-btn').click()
    await expect(page.locator('.mobile-overlay')).toBeVisible()
  })

  test('clicking overlay closes sidebar', async ({ page }) => {
    await page.locator('.mobile-hamburger-btn').click()
    await expect(page.locator('.sidebar-wrapper.mobile-open')).toBeVisible()

    await page.locator('.mobile-overlay').click()
    await expect(page.locator('.sidebar-wrapper.mobile-open')).not.toBeVisible()
    await expect(page.locator('.mobile-overlay')).not.toBeVisible()
  })

  test('sidebar navigation works on mobile', async ({ page }) => {
    // Open menu
    await page.locator('.mobile-hamburger-btn').click()
    await expect(page.locator('.sidebar-wrapper.mobile-open')).toBeVisible()

    // Click Hem
    await page.locator('.menu-item', { hasText: 'Hem' }).click()
    await expect(page.locator('#view-chat')).toBeVisible()
  })

  test('main content takes full width on mobile', async ({ page }) => {
    const main = page.locator('.main-content-area')
    const box = await main.boundingBox()
    const viewport = page.viewportSize()!
    // Main should be close to full viewport width
    expect(box!.width).toBeGreaterThanOrEqual(viewport.width * 0.9)
  })

  test('hamburger icon toggles between menu and close', async ({ page }) => {
    const btn = page.locator('.mobile-hamburger-btn')

    // Initially should show hamburger (3 lines)
    await expect(btn.locator('line')).toHaveCount(3)

    // After click should show X
    await btn.click()
    await expect(btn.locator('path')).toBeVisible()

    // After another click should show hamburger again
    await btn.click()
    await expect(btn.locator('line')).toHaveCount(3)
  })
})
