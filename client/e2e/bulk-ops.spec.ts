import { test, expect } from '@playwright/test'
import { login, navigateIfVisible, waitForListLoaded, clickTab } from './helpers'

test.describe('Bulk Operations', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await login(page)
    if (!(await navigateIfVisible(page, 'Inkorgen'))) {
      testInfo.skip()
    }
  })

  test('bulk mode toggle button exists', async ({ page }) => {
    const toggleBtn = page.locator('.header-actions .icon-only-btn')
    await expect(toggleBtn).toBeVisible()
  })

  test('entering bulk mode shows checkboxes on cards', async ({ page }) => {
    await waitForListLoaded(page)
    const cards = page.locator('.team-ticket-card')
    if ((await cards.count()) === 0) {
      test.skip()
      return
    }

    // Enter bulk mode
    await page.locator('.header-actions .icon-only-btn').click()

    // Cards should now have checkboxes
    await expect(page.locator('.team-ticket-card input[type="checkbox"]').first()).toBeVisible()
  })

  test('selecting cards shows bulk toolbar', async ({ page }) => {
    await waitForListLoaded(page)
    const cards = page.locator('.team-ticket-card')
    if ((await cards.count()) === 0) {
      test.skip()
      return
    }

    // Enter bulk mode
    await page.locator('.header-actions .icon-only-btn').click()

    // Click first card checkbox
    await page.locator('.team-ticket-card input[type="checkbox"]').first().click()

    // Toolbar should appear
    await expect(page.locator('#bulk-action-toolbar')).toBeVisible()
    await expect(page.locator('.bulk-count-label')).toContainText('markerade')
  })

  test('bulk toolbar shows correct count', async ({ page }) => {
    await waitForListLoaded(page)
    const checkboxes = page.locator('.team-ticket-card input[type="checkbox"]')
    if ((await page.locator('.team-ticket-card').count()) < 2) {
      test.skip()
      return
    }

    // Enter bulk mode
    await page.locator('.header-actions .icon-only-btn').click()

    // Select first
    await checkboxes.first().click()
    await expect(page.locator('.bulk-count-label')).toContainText('1 markerade')

    // Select second
    await checkboxes.nth(1).click()
    await expect(page.locator('.bulk-count-label')).toContainText('2 markerade')

    // Deselect first
    await checkboxes.first().click()
    await expect(page.locator('.bulk-count-label')).toContainText('1 markerade')
  })

  test('bulk toolbar has claim and archive buttons', async ({ page }) => {
    await waitForListLoaded(page)
    if ((await page.locator('.team-ticket-card').count()) === 0) {
      test.skip()
      return
    }

    // Enter bulk mode and select
    await page.locator('.header-actions .icon-only-btn').click()
    await page.locator('.team-ticket-card input[type="checkbox"]').first().click()

    await expect(page.locator('#bulk-action-toolbar')).toBeVisible()
    await expect(page.locator('#bulk-action-toolbar .btn-glass-small', { hasText: 'Plocka alla' })).toBeVisible()
    await expect(page.locator('#bulk-action-toolbar .btn-glass-small', { hasText: 'Arkivera alla' })).toBeVisible()
    await expect(page.locator('#bulk-action-toolbar .btn-glass-small', { hasText: 'Avbryt' })).toBeVisible()
  })

  test('cancel button exits bulk mode', async ({ page }) => {
    await waitForListLoaded(page)
    if ((await page.locator('.team-ticket-card').count()) === 0) {
      test.skip()
      return
    }

    // Enter bulk mode, select, cancel
    await page.locator('.header-actions .icon-only-btn').click()
    await page.locator('.team-ticket-card input[type="checkbox"]').first().click()
    await page.locator('#bulk-action-toolbar .btn-glass-small', { hasText: 'Avbryt' }).click()

    // Toolbar gone, checkboxes gone
    await expect(page.locator('#bulk-action-toolbar')).not.toBeVisible()
    await expect(page.locator('.team-ticket-card input[type="checkbox"]')).not.toBeVisible()
  })

  test('exiting bulk mode via toggle clears selection', async ({ page }) => {
    await waitForListLoaded(page)
    if ((await page.locator('.team-ticket-card').count()) === 0) {
      test.skip()
      return
    }

    const toggle = page.locator('.header-actions .icon-only-btn')

    // Enter, select, toggle off
    await toggle.click()
    await page.locator('.team-ticket-card input[type="checkbox"]').first().click()
    await toggle.click()

    // Checkboxes and toolbar should be gone
    await expect(page.locator('#bulk-action-toolbar')).not.toBeVisible()
    await expect(page.locator('.team-ticket-card.bulk-selected')).not.toBeVisible()
  })
})
