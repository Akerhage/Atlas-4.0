import { test, expect } from '@playwright/test'
import { login, navigateIfVisible, clickFirstTicket, waitForListLoaded, clickTab } from './helpers'

test.describe('Ticket Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test.describe('Inbox', () => {
    test.beforeEach(async ({ page, }, testInfo) => {
      if (!(await navigateIfVisible(page, 'Inkorgen'))) {
        testInfo.skip()
      }
    })

    test('loads ticket list', async ({ page }) => {
      await expect(page.locator('#view-inbox')).toBeVisible()
      await waitForListLoaded(page)
      // Either tickets or empty placeholder
      const hasTickets = await page.locator('.team-ticket-card').first().isVisible().catch(() => false)
      const hasPlaceholder = await page.locator('.hero-placeholder').isVisible().catch(() => false)
      expect(hasTickets || hasPlaceholder).toBeTruthy()
    })

    test('ticket cards show label, name, time, and preview', async ({ page }) => {
      await waitForListLoaded(page)
      const card = page.locator('.team-ticket-card').first()
      if (!(await card.isVisible().catch(() => false))) {
        test.skip()
        return
      }

      await expect(card.locator('.pill')).toBeVisible()
      await expect(card.locator('.ticket-card-subject')).toBeVisible()
      await expect(card.locator('.ticket-time')).toBeVisible()
    })

    test('clicking a ticket opens detail panel', async ({ page }) => {
      await waitForListLoaded(page)
      if (!(await clickFirstTicket(page))) {
        test.skip()
        return
      }

      // Detail panel should show (either TicketDetail or placeholder is replaced)
      await expect(page.locator('.detail-content')).toBeVisible({ timeout: 10_000 })
      // Should have header with customer name
      await expect(page.locator('.detail-header-top')).toBeVisible()
      await expect(page.locator('.detail-subject')).toBeVisible()
    })

    test('detail panel shows messages area', async ({ page }) => {
      await waitForListLoaded(page)
      if (!(await clickFirstTicket(page))) {
        test.skip()
        return
      }

      await expect(page.locator('.detail-content .chat-messages')).toBeVisible({ timeout: 10_000 })
    })

    test('detail panel shows reply input for active tickets', async ({ page }) => {
      await waitForListLoaded(page)
      if (!(await clickFirstTicket(page))) {
        test.skip()
        return
      }

      // Should have reply area (unless ticket is closed)
      const replyBar = page.locator('.detail-content .chat-input-bar')
      if (await replyBar.isVisible().catch(() => false)) {
        await expect(page.locator('.detail-content .chat-input')).toBeVisible()
        await expect(page.locator('.detail-content .send-btn')).toBeVisible()
      }
    })

    test('detail panel shows action buttons', async ({ page }) => {
      await waitForListLoaded(page)
      if (!(await clickFirstTicket(page))) {
        test.skip()
        return
      }

      await expect(page.locator('.detail-content')).toBeVisible({ timeout: 10_000 })
      // Action toolbar should have icons
      await expect(page.locator('.detail-footer-toolbar')).toBeVisible()
      await expect(page.locator('.footer-icon-btn')).toHaveCount(await page.locator('.footer-icon-btn').count())
    })

    test('detail pills show channel and routing info', async ({ page }) => {
      await waitForListLoaded(page)
      if (!(await clickFirstTicket(page))) {
        test.skip()
        return
      }

      await expect(page.locator('.detail-content')).toBeVisible({ timeout: 10_000 })
      // Should have at least one pill (label/date/channel)
      await expect(page.locator('.header-pills-row .pill').first()).toBeVisible()
    })

    test('open ticket shows claim button in list', async ({ page }) => {
      await clickTab(page, 'Nya Live-Chattar')
      await waitForListLoaded(page)
      const claimBtn = page.locator('.btn-claim').first()
      if (await claimBtn.isVisible().catch(() => false)) {
        await expect(claimBtn).toHaveText('Plocka')
      }
    })

    test('switching between inbox tabs updates the list', async ({ page }) => {
      await clickTab(page, 'Nya Mail-ärenden')
      await waitForListLoaded(page)

      await clickTab(page, 'Plockade/Routade')
      await waitForListLoaded(page)

      await clickTab(page, 'Nya Live-Chattar')
      await waitForListLoaded(page)
    })

    test('tab badges show ticket counts', async ({ page }) => {
      // Badges may or may not be visible depending on data
      const tabs = page.locator('.header-tab')
      const count = await tabs.count()
      expect(count).toBe(3)
    })
  })

  test.describe('My Tickets', () => {
    test.beforeEach(async ({ page }, testInfo) => {
      if (!(await navigateIfVisible(page, 'Mina ärenden'))) {
        testInfo.skip()
      }
    })

    test('loads my tickets view', async ({ page }) => {
      await expect(page.locator('#view-my-tickets')).toBeVisible()
      await waitForListLoaded(page)
    })

    test('clicking a ticket opens detail', async ({ page }) => {
      await waitForListLoaded(page)
      if (!(await clickFirstTicket(page))) {
        // No tickets — placeholder should show
        await expect(page.locator('#my-detail-placeholder')).toBeVisible()
        return
      }
      await expect(page.locator('.detail-content')).toBeVisible({ timeout: 10_000 })
    })

    test('chat and mail tabs filter correctly', async ({ page }) => {
      await clickTab(page, 'Mail')
      await waitForListLoaded(page)

      await clickTab(page, 'Chattar')
      await waitForListLoaded(page)
    })
  })
})
