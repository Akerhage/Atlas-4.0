import { test, expect } from '@playwright/test'
import { login, navigateIfVisible, clickFirstTicket, waitForListLoaded, expectModalOpen, closeModal } from './helpers'

test.describe('Modals', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test.describe('Profile Modal', () => {
    test('opens on profile container click', async ({ page }) => {
      await page.locator('#user-profile-container').click()
      await expectModalOpen(page)
      await expect(page.locator('.glass-modal-body')).toBeVisible()
    })

    test('shows avatar picker grid', async ({ page }) => {
      await page.locator('#user-profile-container').click()
      await expectModalOpen(page)
      // Avatar grid should have 15 avatars (5 cols)
      const avatars = page.locator('.glass-modal-body div[style*="grid"]').first().locator('> div')
      expect(await avatars.count()).toBeGreaterThanOrEqual(10)
    })

    test('shows color picker', async ({ page }) => {
      await page.locator('#user-profile-container').click()
      await expectModalOpen(page)
      await expect(page.locator('input[type="color"]')).toBeVisible()
    })

    test('shows display name input', async ({ page }) => {
      await page.locator('#user-profile-container').click()
      await expectModalOpen(page)
      const nameInput = page.locator('.glass-modal-body input[type="text"]').first()
      await expect(nameInput).toBeVisible()
      // Should have existing name value
      const value = await nameInput.inputValue()
      expect(value.length).toBeGreaterThan(0)
    })

    test('shows password change section', async ({ page }) => {
      await page.locator('#user-profile-container').click()
      await expectModalOpen(page)
      await expect(page.locator('.glass-modal-body input[type="password"]').first()).toBeVisible()
    })

    test('has save and cancel buttons', async ({ page }) => {
      await page.locator('#user-profile-container').click()
      await expectModalOpen(page)
      await expect(page.locator('.btn-modal-confirm', { hasText: 'Spara' })).toBeVisible()
      await expect(page.locator('.btn-modal-cancel', { hasText: 'Avbryt' })).toBeVisible()
    })

    test('closes on Escape', async ({ page }) => {
      await page.locator('#user-profile-container').click()
      await expectModalOpen(page)
      await closeModal(page)
    })

    test('closes on cancel button', async ({ page }) => {
      await page.locator('#user-profile-container').click()
      await expectModalOpen(page)
      await page.locator('.btn-modal-cancel', { hasText: 'Avbryt' }).click()
      await expect(page.locator('.modal-overlay')).not.toBeVisible()
    })

    test('password mismatch shows error indicator', async ({ page }) => {
      await page.locator('#user-profile-container').click()
      await expectModalOpen(page)

      const passwords = page.locator('.glass-modal-body input[type="password"]')
      // Fill old password
      await passwords.nth(0).fill('oldpass')
      // Fill new passwords that don't match
      await passwords.nth(1).fill('newpass1')
      await passwords.nth(2).fill('newpass2')

      // Should show mismatch indicator
      await expect(page.locator('text=Matchar inte')).toBeVisible()
    })

    test('matching passwords show success indicator', async ({ page }) => {
      await page.locator('#user-profile-container').click()
      await expectModalOpen(page)

      const passwords = page.locator('.glass-modal-body input[type="password"]')
      await passwords.nth(1).fill('newpass123')
      await passwords.nth(2).fill('newpass123')

      await expect(page.locator('text=Matchar')).toBeVisible()
    })
  })

  test.describe('Notes Modal', () => {
    test('opens from ticket detail', async ({ page }, testInfo) => {
      if (!(await navigateIfVisible(page, 'Inkorgen'))) {
        if (!(await navigateIfVisible(page, 'Mina ärenden'))) {
          testInfo.skip()
          return
        }
      }
      await waitForListLoaded(page)
      if (!(await clickFirstTicket(page))) {
        testInfo.skip()
        return
      }

      await expect(page.locator('.detail-content')).toBeVisible({ timeout: 10_000 })
      await page.locator('[title="Anteckningar"]').click()
      await expectModalOpen(page, 'Anteckningar')
    })

    test('shows note input and save button', async ({ page }, testInfo) => {
      if (!(await navigateIfVisible(page, 'Inkorgen'))) {
        if (!(await navigateIfVisible(page, 'Mina ärenden'))) {
          testInfo.skip()
          return
        }
      }
      await waitForListLoaded(page)
      if (!(await clickFirstTicket(page))) {
        testInfo.skip()
        return
      }

      await expect(page.locator('.detail-content')).toBeVisible({ timeout: 10_000 })
      await page.locator('[title="Anteckningar"]').click()
      await expectModalOpen(page, 'Anteckningar')

      await expect(page.locator('textarea[placeholder="Ny anteckning..."]')).toBeVisible()
      await expect(page.locator('.glass-modal-footer .btn-modal-confirm', { hasText: 'Spara' })).toBeVisible()
    })

    test('closes on Escape', async ({ page }, testInfo) => {
      if (!(await navigateIfVisible(page, 'Inkorgen'))) {
        if (!(await navigateIfVisible(page, 'Mina ärenden'))) {
          testInfo.skip()
          return
        }
      }
      await waitForListLoaded(page)
      if (!(await clickFirstTicket(page))) {
        testInfo.skip()
        return
      }

      await expect(page.locator('.detail-content')).toBeVisible({ timeout: 10_000 })
      await page.locator('[title="Anteckningar"]').click()
      await expectModalOpen(page)
      await closeModal(page)
    })
  })

  test.describe('Assign Modal', () => {
    test('opens from ticket detail', async ({ page }, testInfo) => {
      if (!(await navigateIfVisible(page, 'Inkorgen'))) {
        if (!(await navigateIfVisible(page, 'Mina ärenden'))) {
          testInfo.skip()
          return
        }
      }
      await waitForListLoaded(page)
      if (!(await clickFirstTicket(page))) {
        testInfo.skip()
        return
      }

      await expect(page.locator('.detail-content')).toBeVisible({ timeout: 10_000 })
      await page.locator('[title="Tilldela"]').click()
      await expectModalOpen(page, 'Tilldela ärende')
    })

    test('shows agent list', async ({ page }, testInfo) => {
      if (!(await navigateIfVisible(page, 'Inkorgen'))) {
        if (!(await navigateIfVisible(page, 'Mina ärenden'))) {
          testInfo.skip()
          return
        }
      }
      await waitForListLoaded(page)
      if (!(await clickFirstTicket(page))) {
        testInfo.skip()
        return
      }

      await expect(page.locator('.detail-content')).toBeVisible({ timeout: 10_000 })
      await page.locator('[title="Tilldela"]').click()
      await expectModalOpen(page, 'Tilldela ärende')

      // Should show at least one agent card
      await expect(page.locator('.glass-modal-body .admin-mini-card').first()).toBeVisible({ timeout: 10_000 })
    })
  })
})
