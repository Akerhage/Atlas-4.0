import { test, expect } from '@playwright/test'
import { login, getVisibleMenuLabels } from './helpers'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('sidebar shows correct menu items', async ({ page }) => {
    const labels = await getVisibleMenuLabels(page)
    // "Hem" should always be visible
    expect(labels).toContain('Hem')
    // At minimum these should exist
    expect(labels.length).toBeGreaterThanOrEqual(2)
  })

  test('navigates to Home view', async ({ page }) => {
    await page.locator('.menu-item', { hasText: 'Hem' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.locator('#view-chat')).toBeVisible()
  })

  test('navigates to My Tickets view', async ({ page }) => {
    const myTicketsItem = page.locator('.menu-item', { hasText: 'Mina ärenden' })
    if (await myTicketsItem.isVisible()) {
      await myTicketsItem.click()
      await expect(page).toHaveURL('/my-tickets')
      await expect(page.locator('#view-my-tickets')).toBeVisible()
      // Should have tabs
      await expect(page.locator('.header-tab', { hasText: 'Chattar' })).toBeVisible()
      await expect(page.locator('.header-tab', { hasText: 'Mail' })).toBeVisible()
    }
  })

  test('navigates to Inbox view', async ({ page }) => {
    const inboxItem = page.locator('.menu-item', { hasText: 'Inkorgen' })
    if (await inboxItem.isVisible()) {
      await inboxItem.click()
      await expect(page).toHaveURL('/inbox')
      await expect(page.locator('#view-inbox')).toBeVisible()
      // Should have 3 tabs
      await expect(page.locator('.header-tab', { hasText: 'Nya Live-Chattar' })).toBeVisible()
      await expect(page.locator('.header-tab', { hasText: 'Nya Mail-ärenden' })).toBeVisible()
      await expect(page.locator('.header-tab', { hasText: 'Plockade/Routade' })).toBeVisible()
    }
  })

  test('navigates to Archive view', async ({ page }) => {
    const archiveItem = page.locator('.menu-item', { hasText: 'Garaget' })
    if (await archiveItem.isVisible()) {
      await archiveItem.click()
      await expect(page).toHaveURL('/archive')
      await expect(page.locator('#view-archive')).toBeVisible()
      await expect(page.locator('.search-input')).toBeVisible()
    }
  })

  test('navigates to Customers view', async ({ page }) => {
    const customersItem = page.locator('.menu-item', { hasText: 'Kunder' })
    if (await customersItem.isVisible()) {
      await customersItem.click()
      await expect(page).toHaveURL('/customers')
      await expect(page.locator('#view-customers')).toBeVisible()
      await expect(page.locator('.search-input')).toBeVisible()
    }
  })

  test('navigates to Templates view', async ({ page }) => {
    const templatesItem = page.locator('.menu-item', { hasText: 'Mailmallar' })
    if (await templatesItem.isVisible()) {
      await templatesItem.click()
      await expect(page).toHaveURL('/templates')
      await expect(page.locator('#view-templates')).toBeVisible()
    }
  })

  test('navigates to Admin view', async ({ page }) => {
    const adminItem = page.locator('.menu-item', { hasText: 'Admin' })
    if (await adminItem.isVisible()) {
      await adminItem.click()
      await expect(page).toHaveURL('/admin')
      await expect(page.locator('#view-admin')).toBeVisible()
      // Should have 3 tabs
      await expect(page.locator('.header-tab', { hasText: 'Agenter' })).toBeVisible()
      await expect(page.locator('.header-tab', { hasText: 'Kontor & Utbildning' })).toBeVisible()
      await expect(page.locator('.header-tab', { hasText: 'Systemkonfiguration' })).toBeVisible()
    }
  })

  test('highlights active menu item', async ({ page }) => {
    // Click Hem
    await page.locator('.menu-item', { hasText: 'Hem' }).click()
    await expect(page.locator('.menu-item.active', { hasText: 'Hem' })).toBeVisible()

    // Click another view if visible
    const archiveItem = page.locator('.menu-item', { hasText: 'Garaget' })
    if (await archiveItem.isVisible()) {
      await archiveItem.click()
      await expect(page.locator('.menu-item.active', { hasText: 'Garaget' })).toBeVisible()
      // Hem should no longer be active
      await expect(page.locator('.menu-item', { hasText: 'Hem' })).not.toHaveClass(/active/)
    }
  })
})
