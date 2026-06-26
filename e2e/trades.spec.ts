import { test, expect, type Page, type Browser } from '@playwright/test'
import { login, loginNewContext, TEST_PLAYER, TEST_PLAYER_TWO, TEST_ADMIN } from './helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }

async function cleanupSessions() {
  const all = 'id=neq.00000000-0000-0000-0000-000000000000'
  await fetch(`${LOCAL_URL}/rest/v1/trade_sessions?${all}`, { method: 'DELETE', headers })
  await fetch(`${LOCAL_URL}/rest/v1/trade_audit?${all}`, { method: 'DELETE', headers })
}

// Drive a full create → join → stage → lock → confirm between the two players.
async function completeTrade(page: Page, browser: Browser): Promise<Page> {
  await login(page, TEST_PLAYER)
  await page.goto('/trades')
  await page.getByRole('button', { name: 'Trade Partner' }).click()
  await page.waitForURL(/\/trades\/[0-9a-f-]+$/, { timeout: 10000 })
  const { page: p2 } = await loginNewContext(browser, TEST_PLAYER_TWO)
  await p2.goto('/trades')
  await p2.getByRole('link', { name: 'Join trade' }).click()
  await p2.waitForURL(/\/trades\/[0-9a-f-]+$/, { timeout: 10000 })
  await stageFirst(page)
  await stageFirst(p2)
  await page.getByRole('button', { name: 'Lock my offer' }).click()
  await p2.getByRole('button', { name: 'Lock my offer' }).click()
  await page.getByRole('button', { name: /Confirm trade/ }).click({ timeout: 15000 })
  await p2.getByRole('button', { name: /Confirm trade/ }).click({ timeout: 15000 })
  await expect(page.getByRole('button', { name: 'View All' })).toBeVisible({ timeout: 20000 })
  return p2
}

// Stage the first available card on a side. (Staging resets locks, so both
// players stage before anyone locks.)
async function stageFirst(page: Page) {
  await expect(page.getByTestId('card-picker').first().locator('button').first()).toBeVisible({ timeout: 10000 })
  await page.getByTestId('card-picker').first().locator('button').first().click()
}

test.describe('Live trading', () => {
  test.beforeEach(cleanupSessions)
  test.afterAll(cleanupSessions)

  test('two players complete a trade and each sees the received cards', async ({ page, browser }) => {
    // A starts a trade with Trade Partner.
    await login(page, TEST_PLAYER)
    await page.goto('/trades')
    await page.getByRole('button', { name: 'Trade Partner' }).click()
    await page.waitForURL(/\/trades\/[0-9a-f-]+$/, { timeout: 10000 })

    // B joins from the invite on the trades landing.
    const { page: p2 } = await loginNewContext(browser, TEST_PLAYER_TWO)
    await p2.goto('/trades')
    await p2.getByRole('link', { name: 'Join trade' }).click()
    await p2.waitForURL(/\/trades\/[0-9a-f-]+$/, { timeout: 10000 })

    // Both stage first (staging resets locks), then both lock in.
    await stageFirst(page)
    await stageFirst(p2)
    await page.getByRole('button', { name: 'Lock my offer' }).click()
    await p2.getByRole('button', { name: 'Lock my offer' }).click()

    // Once both are locked, both confirm (Realtime + poll surface the other's lock).
    await page.getByRole('button', { name: /Confirm trade/ }).click({ timeout: 15000 })
    await p2.getByRole('button', { name: /Confirm trade/ }).click({ timeout: 15000 })

    // Both land on the coverless reveal; drive it to the "You received:" summary.
    for (const pg of [page, p2]) {
      await expect(pg.getByRole('button', { name: 'View All' })).toBeVisible({ timeout: 20000 })
      await pg.getByRole('button', { name: 'View All' }).click()
      await expect(pg.getByTestId('reveal-summary-desktop').getByText('You received:')).toBeVisible({ timeout: 10000 })
    }
  })

  test('a player can cancel a trade from the room', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/trades')
    await page.getByRole('button', { name: 'Trade Partner' }).click()
    await page.waitForURL(/\/trades\/[0-9a-f-]+$/, { timeout: 10000 })
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.waitForURL(/\/trades$/, { timeout: 10000 })
    // Back to the start-a-trade picker (no active session).
    await expect(page.getByText('Start a trade')).toBeVisible({ timeout: 10000 })
  })

  test('the recipient gets a realtime toast the instant an invite is created', async ({ page, browser }) => {
    // B is sitting in the app (dashboard) with the global listener mounted.
    const { page: p2 } = await loginNewContext(browser, TEST_PLAYER_TWO)
    await p2.goto('/dashboard')
    await expect(p2.getByText(/Welcome/)).toBeVisible({ timeout: 10000 })

    // A opens a trade room with B.
    await login(page, TEST_PLAYER)
    await page.goto('/trades')
    await page.getByRole('button', { name: 'Trade Partner' }).click()
    await page.waitForURL(/\/trades\/[0-9a-f-]+$/, { timeout: 10000 })

    // B sees the toast with a join link, no refresh.
    await expect(p2.getByTestId('trade-invite-toast')).toBeVisible({ timeout: 15000 })
    await expect(p2.getByRole('link', { name: /join the trade room/ })).toBeVisible()
  })

  test('shows whether the partner is in the room', async ({ page, browser }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/trades')
    await page.getByRole('button', { name: 'Trade Partner' }).click()
    await page.waitForURL(/\/trades\/[0-9a-f-]+$/, { timeout: 10000 })
    // Alone in the room.
    await expect(page.getByTestId('partner-presence')).toContainText('joined yet', { timeout: 10000 })

    // Partner joins → status flips to "In the room".
    const { page: p2 } = await loginNewContext(browser, TEST_PLAYER_TWO)
    await p2.goto('/trades')
    await p2.getByRole('link', { name: 'Join trade' }).click()
    await p2.waitForURL(/\/trades\/[0-9a-f-]+$/, { timeout: 10000 })
    await expect(page.getByTestId('partner-presence')).toContainText('In the room', { timeout: 15000 })
  })

  test('the partner is told who cancelled the trade', async ({ page, browser }) => {
    const { page: p2 } = await loginNewContext(browser, TEST_PLAYER_TWO)
    await p2.goto('/dashboard')
    await expect(p2.getByText(/Welcome/)).toBeVisible({ timeout: 10000 })

    await login(page, TEST_PLAYER)
    await page.goto('/trades')
    await page.getByRole('button', { name: 'Trade Partner' }).click()
    await page.waitForURL(/\/trades\/[0-9a-f-]+$/, { timeout: 10000 })
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.waitForURL(/\/trades$/, { timeout: 10000 })

    await expect(p2.getByTestId('trade-cancel-toast')).toBeVisible({ timeout: 15000 })
    await expect(p2.getByText(/Test Player cancelled the trade/)).toBeVisible()
  })

  test('a completed trade appears in the admin trade log', async ({ page, browser }) => {
    await completeTrade(page, browser)

    const { page: admin } = await loginNewContext(browser, TEST_ADMIN)
    await admin.goto('/admin/trade-logs')
    await expect(admin.getByText('Completed Trades')).toBeVisible({ timeout: 10000 })
    await expect(admin.getByTestId('trade-log-row').first()).toBeVisible({ timeout: 10000 })
    await expect(admin.getByTestId('trade-log-row').first()).toContainText('Test Player')
  })

  test('the invite shows a dashboard badge for the recipient', async ({ page, browser }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/trades')
    await page.getByRole('button', { name: 'Trade Partner' }).click()
    await page.waitForURL(/\/trades\/[0-9a-f-]+$/, { timeout: 10000 })

    const { page: p2 } = await loginNewContext(browser, TEST_PLAYER_TWO)
    await p2.goto('/dashboard')
    await expect(p2.locator('a[href="/trades"]').getByTestId('notif-badge')).toBeVisible({ timeout: 10000 })
  })
})
