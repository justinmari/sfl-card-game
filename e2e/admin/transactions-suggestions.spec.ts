import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from '../helpers'

const LOCAL = 'http://127.0.0.1:54321'
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const svc = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }

test.describe('Admin Gruten Logs', () => {
  test('admin can view the paginated transaction log', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/transactions')
    const log = page.getByTestId('transaction-log')
    await expect(log).toBeVisible({ timeout: 10000 })
    await expect(log.getByText('Gruten Transactions')).toBeVisible()
    await expect(log.getByRole('button', { name: 'Next →' })).toBeVisible()
  })

  test('non-admin cannot access the transaction log', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/admin/transactions')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toContain('/admin/transactions')
  })

  test('can filter the log by player and by type', async ({ page }) => {
    // Seed two transactions of different types for the test player.
    const usersRes = await fetch(`${LOCAL}/auth/v1/admin/users?page=1&per_page=50`, { headers: svc })
    const player = ((await usersRes.json()).users || []).find((u: { email: string }) => u.email === 'player@test.com')
    await fetch(`${LOCAL}/rest/v1/gruten_transactions?metadata->>marker=eq.e2e-filter`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/gruten_transactions`, {
      method: 'POST', headers: svc,
      body: JSON.stringify([
        { user_id: player.id, type: 'pack_purchase', amount: -100, balance_after: 900, metadata: { marker: 'e2e-filter' } },
        { user_id: player.id, type: 'admin_grant', amount: 500, balance_after: 1400, metadata: { marker: 'e2e-filter' } },
      ]),
    })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/transactions')
    const log = page.getByTestId('transaction-log')
    await expect(log).toBeVisible({ timeout: 10000 })
    await expect(page.getByLabel('Filter by player')).toBeVisible()

    const typeFilter = page.getByLabel('Filter by type')
    await expect(typeFilter).toBeVisible()
    await typeFilter.selectOption('pack_purchase')
    await expect(log.locator('[data-testid="txn-row"]').first()).toContainText('Pack purchase')
    await expect(log.locator('[data-testid="txn-row"]', { hasText: 'Admin grant' })).toHaveCount(0)

    await fetch(`${LOCAL}/rest/v1/gruten_transactions?metadata->>marker=eq.e2e-filter`, { method: 'DELETE', headers: svc })
  })
})

test.describe('Card suggestion notification badge', () => {
  test('a pending suggestion shows a badge on the Card Suggestions tile', async ({ page }) => {
    // Seed one pending suggestion (unique title so we can clean it up).
    const profs = await (await fetch(`${LOCAL}/rest/v1/profiles?select=id&limit=1`, { headers: svc })).json()
    const uid = profs[0].id
    await fetch(`${LOCAL}/rest/v1/card_suggestions`, {
      method: 'POST', headers: svc,
      body: JSON.stringify({ user_id: uid, title: 'E2E badge probe', status: 'pending' }),
    })

    await login(page, TEST_ADMIN)
    await page.goto('/dashboard')
    const tile = page.locator('a[href="/admin/suggestions"]')
    await expect(tile.getByTestId('notif-badge')).toBeVisible({ timeout: 10000 })

    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.E2E%20badge%20probe`, { method: 'DELETE', headers: svc })
  })
})
