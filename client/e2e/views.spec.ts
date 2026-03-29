import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Views', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('Home view shows chat interface', async ({ page }) => {
    await page.locator('.menu-item', { hasText: 'Hem' }).click()
    // Chat view with hero placeholder or messages area
    await expect(page.locator('#view-chat')).toBeVisible()
    // Should have input area
    await expect(page.locator('.chat-input')).toBeVisible()
    await expect(page.locator('.send-btn')).toBeVisible()
  })

  test('Home chat accepts user input', async ({ page }) => {
    await page.locator('.menu-item', { hasText: 'Hem' }).click()
    const input = page.locator('.chat-input')
    await input.fill('Hej Atlas')
    await expect(input).toHaveValue('Hej Atlas')
    // Send button should be enabled
    await expect(page.locator('.send-btn')).toBeEnabled()
  })

  test('Inbox tabs switch correctly', async ({ page }) => {
    const inboxItem = page.locator('.menu-item', { hasText: 'Inkorgen' })
    if (!(await inboxItem.isVisible())) {
      test.skip()
      return
    }

    await inboxItem.click()
    await expect(page.locator('#view-inbox')).toBeVisible()

    // Click mail tab
    await page.locator('.header-tab', { hasText: 'Nya Mail-ärenden' }).click()
    await expect(page.locator('.header-tab.active', { hasText: 'Nya Mail-ärenden' })).toBeVisible()

    // Click claimed tab
    await page.locator('.header-tab', { hasText: 'Plockade/Routade' }).click()
    await expect(page.locator('.header-tab.active', { hasText: 'Plockade/Routade' })).toBeVisible()

    // Click back to chats
    await page.locator('.header-tab', { hasText: 'Nya Live-Chattar' }).click()
    await expect(page.locator('.header-tab.active', { hasText: 'Nya Live-Chattar' })).toBeVisible()
  })

  test('My Tickets tabs switch correctly', async ({ page }) => {
    const myItem = page.locator('.menu-item', { hasText: 'Mina ärenden' })
    if (!(await myItem.isVisible())) {
      test.skip()
      return
    }

    await myItem.click()
    await expect(page.locator('#view-my-tickets')).toBeVisible()

    await page.locator('.header-tab', { hasText: 'Mail' }).click()
    await expect(page.locator('.header-tab.active', { hasText: 'Mail' })).toBeVisible()

    await page.locator('.header-tab', { hasText: 'Chattar' }).click()
    await expect(page.locator('.header-tab.active', { hasText: 'Chattar' })).toBeVisible()
  })

  test('Archive has search functionality', async ({ page }) => {
    const archiveItem = page.locator('.menu-item', { hasText: 'Garaget' })
    if (!(await archiveItem.isVisible())) {
      test.skip()
      return
    }

    await archiveItem.click()
    await expect(page.locator('#view-archive')).toBeVisible()
    const searchInput = page.locator('.search-input')
    await expect(searchInput).toBeVisible()
    await searchInput.fill('test')
    await expect(searchInput).toHaveValue('test')
  })

  test('Admin tab switching works', async ({ page }) => {
    const adminItem = page.locator('.menu-item', { hasText: 'Admin' })
    if (!(await adminItem.isVisible())) {
      test.skip()
      return
    }

    await adminItem.click()
    await expect(page.locator('#view-admin')).toBeVisible()

    // Switch to Offices tab
    await page.locator('.header-tab', { hasText: 'Kontor & Utbildning' }).click()
    await expect(page.locator('.header-tab.active', { hasText: 'Kontor & Utbildning' })).toBeVisible()

    // Switch to Config tab
    await page.locator('.header-tab', { hasText: 'Systemkonfiguration' }).click()
    await expect(page.locator('.header-tab.active', { hasText: 'Systemkonfiguration' })).toBeVisible()

    // Switch back to Agents tab
    await page.locator('.header-tab', { hasText: 'Agenter' }).click()
    await expect(page.locator('.header-tab.active', { hasText: 'Agenter' })).toBeVisible()
  })

  test('sidebar shows user profile', async ({ page }) => {
    await expect(page.locator('#user-profile-container')).toBeVisible()
    await expect(page.locator('.user-avatar')).toBeVisible()
    await expect(page.locator('#current-user-name')).toBeVisible()
  })

  test('sidebar shows server connection status', async ({ page }) => {
    await expect(page.locator('#server-status')).toBeVisible()
  })

  test('hero placeholders show on empty detail panels', async ({ page }) => {
    // My Tickets should show placeholder in detail panel
    const myItem = page.locator('.menu-item', { hasText: 'Mina ärenden' })
    if (await myItem.isVisible()) {
      await myItem.click()
      await expect(page.locator('.hero-placeholder')).toBeVisible()
    }
  })
})
