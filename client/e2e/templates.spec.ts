import { test, expect } from '@playwright/test'
import { login, navigateIfVisible, waitForListLoaded } from './helpers'

test.describe('Templates', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await login(page)
    if (!(await navigateIfVisible(page, 'Mailmallar'))) {
      testInfo.skip()
    }
  })

  test('renders templates view', async ({ page }) => {
    await expect(page.locator('#view-templates')).toBeVisible()
  })

  test('shows template list or empty state', async ({ page }) => {
    await waitForListLoaded(page)
    const hasTemplates = await page.locator('.team-ticket-card').first().isVisible().catch(() => false)
    const hasPlaceholder = await page.locator('.hero-placeholder').isVisible().catch(() => false)
    expect(hasTemplates || hasPlaceholder).toBeTruthy()
  })

  test('clicking a template shows detail panel', async ({ page }) => {
    await waitForListLoaded(page)
    const card = page.locator('.team-ticket-card').first()
    if (!(await card.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    await card.click()
    await expect(page.locator('.detail-content')).toBeVisible()
    // Should show template name and subject
    await expect(page.locator('.detail-content h3')).toBeVisible()
  })

  test('detail panel shows edit and delete buttons', async ({ page }) => {
    await waitForListLoaded(page)
    const card = page.locator('.team-ticket-card').first()
    if (!(await card.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    await card.click()
    await expect(page.locator('.detail-content')).toBeVisible()
    // Edit button (pencil icon)
    await expect(page.locator('.detail-content [title="Redigera"]')).toBeVisible()
    // Delete button
    await expect(page.locator('.detail-content [title="Radera"]')).toBeVisible()
  })

  test('edit button switches to edit mode with Quill editor', async ({ page }) => {
    await waitForListLoaded(page)
    const card = page.locator('.team-ticket-card').first()
    if (!(await card.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    await card.click()
    await expect(page.locator('.detail-content')).toBeVisible()

    // Click edit
    await page.locator('.detail-content [title="Redigera"]').click()

    // Should show name and subject inputs
    await expect(page.locator('input[placeholder="T.ex. Välkomstmail"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Ämne för mailet"]')).toBeVisible()

    // Quill editor should load (lazy)
    await expect(page.locator('.quill-wrapper')).toBeVisible({ timeout: 10_000 })

    // Should have save and cancel buttons
    await expect(page.locator('.btn-modal-confirm', { hasText: 'Spara' })).toBeVisible()
    await expect(page.locator('.btn-modal-cancel', { hasText: 'Avbryt' })).toBeVisible()
  })

  test('cancel button returns to read mode', async ({ page }) => {
    await waitForListLoaded(page)
    const card = page.locator('.team-ticket-card').first()
    if (!(await card.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    await card.click()
    await expect(page.locator('.detail-content')).toBeVisible()
    await page.locator('.detail-content [title="Redigera"]').click()
    await expect(page.locator('.btn-modal-cancel', { hasText: 'Avbryt' })).toBeVisible()

    await page.locator('.btn-modal-cancel', { hasText: 'Avbryt' }).click()

    // Should be back in read mode — Quill wrapper gone
    await expect(page.locator('.quill-wrapper')).not.toBeVisible()
    // Edit button visible again
    await expect(page.locator('.detail-content [title="Redigera"]')).toBeVisible()
  })

  test('new template button opens create form', async ({ page }) => {
    await page.locator('.icon-only-btn').first().click()
    // Should show editor in create mode
    await expect(page.locator('.detail-content')).toBeVisible()
    await expect(page.locator('input[placeholder="T.ex. Välkomstmail"]')).toBeVisible()
    // Mode indicator should say "Ny mall"
    await expect(page.locator('text=Ny mall')).toBeVisible()
  })

  test('status indicator shows correct mode', async ({ page }) => {
    await waitForListLoaded(page)
    const card = page.locator('.team-ticket-card').first()
    if (!(await card.isVisible().catch(() => false))) {
      test.skip()
      return
    }

    // View mode
    await card.click()
    await expect(page.locator('.detail-content')).toBeVisible()
    await expect(page.locator('text=Visar')).toBeVisible()

    // Edit mode
    await page.locator('.detail-content [title="Redigera"]').click()
    await expect(page.locator('text=Redigerar')).toBeVisible()
  })
})
