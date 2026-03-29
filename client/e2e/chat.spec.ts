import { test, expect } from '@playwright/test'
import { login, navigateTo } from './helpers'

test.describe('Home / Chat', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await navigateTo(page, 'Hem')
  })

  test('renders chat view with input and send button', async ({ page }) => {
    await expect(page.locator('#view-chat')).toBeVisible()
    await expect(page.locator('.chat-input')).toBeVisible()
    await expect(page.locator('.send-btn')).toBeVisible()
  })

  test('shows welcome hero when no messages', async ({ page }) => {
    await expect(page.locator('.hero-placeholder')).toBeVisible()
    await expect(page.locator('.hero-title')).toContainText('Välkommen')
  })

  test('send button is disabled when input is empty', async ({ page }) => {
    await expect(page.locator('.send-btn')).toBeDisabled()
  })

  test('send button enables when text is entered', async ({ page }) => {
    await page.locator('.chat-input').fill('Test')
    await expect(page.locator('.send-btn')).toBeEnabled()
  })

  test('sending a message adds user bubble to chat', async ({ page }) => {
    const input = page.locator('.chat-input')
    await input.fill('Hej Atlas, detta är ett test')
    await page.locator('.send-btn').click()

    // User message should appear as a bubble
    await expect(page.locator('.chat-bubble.user')).toBeVisible({ timeout: 3_000 })
    await expect(page.locator('.chat-bubble.user .bubble-content')).toContainText('Hej Atlas, detta är ett test')

    // Input should be cleared
    await expect(input).toHaveValue('')
  })

  test('typing indicator shows after sending', async ({ page }) => {
    await page.locator('.chat-input').fill('Test fråga')
    await page.locator('.send-btn').click()

    // Typing indicator should appear briefly
    await expect(page.locator('.typing-indicator')).toBeVisible({ timeout: 3_000 })
  })

  test('Enter key sends message (without Shift)', async ({ page }) => {
    const input = page.locator('.chat-input')
    await input.fill('Testar Enter')
    await input.press('Enter')
    await expect(page.locator('.chat-bubble.user')).toBeVisible({ timeout: 3_000 })
  })

  test('Shift+Enter does not send message', async ({ page }) => {
    const input = page.locator('.chat-input')
    await input.fill('Rad 1')
    await input.press('Shift+Enter')
    // No bubble should appear — input still has text
    await expect(page.locator('.chat-bubble.user')).not.toBeVisible()
  })

  test('new chat button resets conversation', async ({ page }) => {
    // Send a message first
    await page.locator('.chat-input').fill('Första meddelandet')
    await page.locator('.send-btn').click()
    await expect(page.locator('.chat-bubble.user')).toBeVisible({ timeout: 3_000 })

    // Click new chat button
    await page.locator('.icon-only-btn[title="Ny chatt"]').click()

    // Messages should be cleared, hero should show again
    await expect(page.locator('.chat-bubble')).not.toBeVisible()
    await expect(page.locator('.hero-placeholder')).toBeVisible()
  })

  test('receives AI response after sending message', async ({ page }) => {
    await page.locator('.chat-input').fill('Vad kostar ett körkort?')
    await page.locator('.send-btn').click()

    // Wait for Atlas AI response (may take a while with real backend)
    await expect(page.locator('.chat-bubble.atlas')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.chat-bubble.atlas .bubble-content')).not.toBeEmpty()
  })
})
