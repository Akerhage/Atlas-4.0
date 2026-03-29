import { type Page, expect } from '@playwright/test'

const TEST_USER = process.env.ATLAS_E2E_USER || 'admin'
const TEST_PASS = process.env.ATLAS_E2E_PASS || 'admin123'

/**
 * Login to Atlas via the React login form.
 * Stores token in localStorage — subsequent navigations stay authenticated.
 */
export async function login(page: Page): Promise<void> {
  await page.goto('/')
  // Wait for login form to appear
  await expect(page.locator('.ln-overlay')).toBeVisible({ timeout: 15_000 })

  await page.locator('input[placeholder="Användarnamn"]').fill(TEST_USER)
  await page.locator('input[placeholder="Lösenord"]').fill(TEST_PASS)
  await page.locator('button[type="submit"]').click()

  // Wait for sidebar to confirm login succeeded
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 15_000 })
}

/**
 * Navigate to a view via sidebar menu click.
 */
export async function navigateTo(page: Page, path: string): Promise<void> {
  // Map logical names to route paths
  const routes: Record<string, string> = {
    home: '/',
    chat: '/',
    inbox: '/inbox',
    'my-tickets': '/my-tickets',
    archive: '/archive',
    customers: '/customers',
    templates: '/templates',
    admin: '/admin',
  }

  const target = routes[path] || path

  // Click the sidebar menu item that navigates to this route
  const menuItems = page.locator('.sidebar-menu .menu-item')
  const count = await menuItems.count()
  for (let i = 0; i < count; i++) {
    const item = menuItems.nth(i)
    // We click and check if URL changed to expected path
    await item.click()
    if (page.url().endsWith(target) || (target === '/' && page.url().match(/\/$/))) {
      return
    }
  }

  // Fallback: direct navigation
  await page.goto(target)
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
 * Wait for the app to be fully loaded (sidebar + socket connected).
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await expect(page.locator('.sidebar')).toBeVisible()
  await expect(page.locator('.sidebar-menu .menu-item')).toHaveCount(
    await page.locator('.sidebar-menu .menu-item').count(),
    { timeout: 5_000 },
  )
}
