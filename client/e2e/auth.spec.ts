import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Authentication', () => {
  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.ln-overlay')).toBeVisible()
    await expect(page.locator('.ln-app-name')).toHaveText('ATLAS')
    await expect(page.locator('input[placeholder="Användarnamn"]')).toBeVisible()
    await expect(page.locator('input[placeholder="Lösenord"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/')
    await page.locator('input[placeholder="Användarnamn"]').fill('invalid_user')
    await page.locator('input[placeholder="Lösenord"]').fill('wrong_password')
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('.ln-error')).toBeVisible({ timeout: 10_000 })
  })

  test('logs in successfully and shows sidebar', async ({ page }) => {
    await login(page)
    await expect(page.locator('.sidebar')).toBeVisible()
    await expect(page.locator('#user-profile-container')).toBeVisible()
    // Should show at least "Hem" in sidebar
    await expect(page.locator('.sidebar-menu .menu-item').first()).toBeVisible()
  })

  test('redirects to login after logout', async ({ page }) => {
    await login(page)
    await expect(page.locator('.sidebar')).toBeVisible()
    // Click logout button
    await page.locator('.logout-btn').click()
    // Should show login again
    await expect(page.locator('.ln-overlay')).toBeVisible({ timeout: 10_000 })
  })
})
