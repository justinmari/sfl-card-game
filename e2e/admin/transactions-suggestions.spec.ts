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
