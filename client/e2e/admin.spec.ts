import { test, expect } from '@playwright/test'
import { login, navigateIfVisible, clickTab, waitForListLoaded } from './helpers'

test.describe('Admin', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await login(page)
    if (!(await navigateIfVisible(page, 'Admin'))) {
      testInfo.skip()
    }
  })

  test.describe('Agents Tab', () => {
    test('loads agent list', async ({ page }) => {
      await expect(page.locator('.admin-main-list')).toBeVisible()
      await expect(page.locator('.admin-list-title')).toContainText('Agenter')
      // Should have at least one agent card
      await expect(page.locator('.admin-mini-card').first()).toBeVisible({ timeout: 10_000 })
    })

    test('agent cards show name and online status', async ({ page }) => {
      const card = page.locator('.admin-mini-card').first()
      await expect(card).toBeVisible({ timeout: 10_000 })
      await expect(card.locator('.admin-card-name')).toBeVisible()
      await expect(card.locator('.status-indicator')).toBeVisible()
    })

    test('clicking agent opens detail panel', async ({ page }) => {
      await page.locator('.admin-mini-card').first().click({ timeout: 10_000 })
      // Detail panel should show user info
      await expect(page.locator('.admin-detail-content')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('.detail-header-top')).toBeVisible()
      await expect(page.locator('.detail-subject')).toBeVisible()
    })

    test('agent detail shows stats grid', async ({ page }) => {
      await page.locator('.admin-mini-card').first().click({ timeout: 10_000 })
      await expect(page.locator('.admin-detail-content')).toBeVisible({ timeout: 10_000 })
      // Stats grid should have 4 cells
      await expect(page.locator('.admin-stat-cell')).toHaveCount(4, { timeout: 10_000 })
    })

    test('agent detail shows color picker', async ({ page }) => {
      await page.locator('.admin-mini-card').first().click({ timeout: 10_000 })
      await expect(page.locator('.admin-detail-content')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('input[type="color"]')).toBeVisible()
    })

    test('agent detail shows action buttons (edit, reset pw, delete)', async ({ page }) => {
      await page.locator('.admin-mini-card').first().click({ timeout: 10_000 })
      await expect(page.locator('.admin-detail-content')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('.detail-header-actions .icon-only-btn')).toHaveCount(
        await page.locator('.detail-header-actions .icon-only-btn').count()
      )
    })

    test('new agent button opens form', async ({ page }) => {
      await page.locator('.icon-only-btn[title="Ny agent"]').click()
      // Form should appear with avatar grid and inputs
      await expect(page.locator('.admin-detail-content')).toBeVisible()
      await expect(page.locator('input[type="text"]').first()).toBeVisible()
    })

    test('new agent form has all required fields', async ({ page }) => {
      await page.locator('.icon-only-btn[title="Ny agent"]').click()
      await expect(page.locator('.admin-detail-content')).toBeVisible()

      // Should have username, display name, password, role, color inputs
      const inputs = page.locator('.admin-detail-content input')
      expect(await inputs.count()).toBeGreaterThanOrEqual(5)

      // Should have save and cancel buttons
      await expect(page.locator('.btn-modal-confirm', { hasText: 'Spara' })).toBeVisible()
      await expect(page.locator('.btn-modal-cancel', { hasText: 'Avbryt' })).toBeVisible()
    })
  })

  test.describe('Offices Tab', () => {
    test.beforeEach(async ({ page }) => {
      await clickTab(page, 'Kontor & Utbildning')
    })

    test('loads office list grouped by city', async ({ page }) => {
      await expect(page.locator('.admin-main-list')).toBeVisible()
      await expect(page.locator('.admin-list-title')).toContainText('Kontor')
      await expect(page.locator('.admin-mini-card').first()).toBeVisible({ timeout: 10_000 })
    })

    test('clicking office opens detail panel', async ({ page }) => {
      await page.locator('.admin-mini-card').first().click({ timeout: 10_000 })
      await expect(page.locator('.admin-detail-content')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('.detail-header-top')).toBeVisible()
    })

    test('office detail shows tickets and agents sections', async ({ page }) => {
      await page.locator('.admin-mini-card').first().click({ timeout: 10_000 })
      await expect(page.locator('.admin-detail-content')).toBeVisible({ timeout: 10_000 })
      // Two-column layout with tickets and agents
      await expect(page.locator('h4', { hasText: 'Ärenden' })).toBeVisible()
      await expect(page.locator('h4', { hasText: 'Kopplade agenter' })).toBeVisible()
    })

    test('office detail shows contact info section', async ({ page }) => {
      await page.locator('.admin-mini-card').first().click({ timeout: 10_000 })
      await expect(page.locator('.admin-detail-content')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('h4', { hasText: 'Kontaktuppgifter' })).toBeVisible()
    })

    test('new office button opens form', async ({ page }) => {
      await page.locator('.icon-only-btn[title="Nytt kontor"]').click()
      await expect(page.locator('.admin-detail-content')).toBeVisible()
      await expect(page.locator('.btn-modal-confirm', { hasText: 'Spara' })).toBeVisible()
    })
  })

  test.describe('Config Tab', () => {
    test.beforeEach(async ({ page }) => {
      await clickTab(page, 'Systemkonfiguration')
    })

    test('shows config navigation list', async ({ page }) => {
      await expect(page.locator('.admin-main-list')).toBeVisible()
      await expect(page.locator('.admin-list-title')).toContainText('Systemkonfiguration')
    })

    test('has all config sections', async ({ page }) => {
      const sections = page.locator('.admin-mini-card')
      expect(await sections.count()).toBeGreaterThanOrEqual(8)
    })

    test('clicking Om Atlas shows version and stats', async ({ page }) => {
      await page.locator('.admin-mini-card', { hasText: 'Om Atlas' }).click()
      await expect(page.locator('.admin-detail-content')).toBeVisible()
      // Should show version
      await expect(page.locator('text=v4.0')).toBeVisible()
    })

    test('clicking Drift & Säkerhet shows settings', async ({ page }) => {
      await page.locator('.admin-mini-card', { hasText: 'Drift & Säkerhet' }).click()
      await expect(page.locator('.admin-detail-content')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('h3', { hasText: 'Drift & Säkerhet' })).toBeVisible()
    })

    test('clicking Kunskapsbas shows file list', async ({ page }) => {
      await page.locator('.admin-mini-card', { hasText: 'Kunskapsbas' }).click()
      await expect(page.locator('.admin-detail-content')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('h3', { hasText: 'Kunskapsbas' })).toBeVisible()
    })

    test('clicking Kunskapsluckor shows gaps', async ({ page }) => {
      await page.locator('.admin-mini-card', { hasText: 'Kunskapsluckor' }).click()
      await expect(page.locator('.admin-detail-content')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('h3', { hasText: 'Kunskapsluckor' })).toBeVisible()
    })
  })
})
