import { type Page, expect } from '@playwright/test'

const TEST_USER = process.env.ATLAS_E2E_USER || 'admin'
const TEST_PASS = process.env.ATLAS_E2E_PASS || 'admin123'

/**
 * Login to Atlas via the React login form.
 */
export async function login(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('.ln-overlay')).toBeVisible({ timeout: 15_000 })
  await page.locator('input[placeholder="Användarnamn"]').fill(TEST_USER)
  await page.locator('input[placeholder="Lösenord"]').fill(TEST_PASS)
  await page.locator('button[type="submit"]').click()
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 15_000 })
}

/**
 * Navigate to a view via sidebar menu click by label text.
 */
export async function navigateTo(page: Page, label: string): Promise<void> {
  const item = page.locator('.sidebar-menu .menu-item', { hasText: label })
  if (await item.isVisible()) {
    await item.click()
  }
}

/**
 * Navigate only if the menu item is visible, otherwise skip.
 * Returns true if navigation happened.
 */
export async function navigateIfVisible(page: Page, label: string): Promise<boolean> {
  const item = page.locator('.sidebar-menu .menu-item', { hasText: label })
  if (await item.isVisible()) {
    await item.click()
    return true
  }
  return false
}

/**
 * Get all visible sidebar menu labels.
 */
export async function getVisibleMenuLabels(page: Page): Promise<string[]> {
  const labels: string[] = []
  const items = page.locator('.sidebar-menu .menu-item .menu-label')
  const count = await items.count()
  for (let i = 0; i < count; i++) {
    const text = await items.nth(i).textContent()
    if (text) labels.push(text.trim())
  }
  return labels
}

/**
 * Click a header tab by text and verify it becomes active.
 */
export async function clickTab(page: Page, label: string): Promise<void> {
  await page.locator('.header-tab', { hasText: label }).click()
  await expect(page.locator('.header-tab.active', { hasText: label })).toBeVisible()
}

/**
 * Wait for ticket list to load (loading spinner disappears).
 */
export async function waitForListLoaded(page: Page): Promise<void> {
  // Either spinner disappears or ticket cards appear or hero placeholder shows
  await expect(page.locator('.loading-spinner')).not.toBeVisible({ timeout: 15_000 }).catch(() => {})
}

/**
 * Click the first ticket card in the list if any exist.
 * Returns true if a card was clicked.
 */
export async function clickFirstTicket(page: Page): Promise<boolean> {
  await waitForListLoaded(page)
  const card = page.locator('.team-ticket-card').first()
  if (await card.isVisible().catch(() => false)) {
    await card.click()
    return true
  }
  return false
}

/**
 * Open a modal by clicking an element with the given title attribute.
 */
export async function clickActionButton(page: Page, title: string): Promise<void> {
  await page.locator(`[title="${title}"]`).first().click()
}

/**
 * Wait for and verify a modal is open.
 */
export async function expectModalOpen(page: Page, headerText?: string): Promise<void> {
  await expect(page.locator('.modal-overlay')).toBeVisible({ timeout: 5_000 })
  if (headerText) {
    await expect(page.locator('.glass-modal-header', { hasText: headerText })).toBeVisible()
  }
}

/**
 * Close modal via Escape key.
 */
export async function closeModal(page: Page): Promise<void> {
  await page.keyboard.press('Escape')
  await expect(page.locator('.modal-overlay')).not.toBeVisible({ timeout: 3_000 })
}

/**
 * Wait for toast notification to appear.
 */
export async function expectToast(page: Page, textMatch?: string | RegExp): Promise<void> {
  const toast = page.locator('.toast-notification')
  await expect(toast.first()).toBeVisible({ timeout: 5_000 })
  if (textMatch) {
    if (typeof textMatch === 'string') {
      await expect(toast.first()).toContainText(textMatch)
    } else {
      await expect(toast.first()).toHaveText(textMatch)
    }
  }
}
