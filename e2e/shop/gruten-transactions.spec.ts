import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from '../helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function getPlayerId(): Promise<string> {
  const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers })
  const listData = await listRes.json()
  return listData.users?.find((u: any) => u.email === 'player@test.com')?.id
}

async function resetPlayer(playerId: string) {
  await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${playerId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ gruten: 5000, last_daily_claim: null, last_pack_purchase: null }),
  })
  await fetch(`${LOCAL_URL}/rest/v1/gruten_transactions?user_id=eq.${playerId}`, {
    method: 'DELETE',
    headers,
  })
}

async function getTransactions(playerId: string) {
  const res = await fetch(
    `${LOCAL_URL}/rest/v1/gruten_transactions?user_id=eq.${playerId}&order=created_at.asc`,
    { headers },
  )
  return res.json()
}

test.describe('Gruten Transactions', () => {
  let playerId: string

  test.beforeAll(async () => {
    playerId = await getPlayerId()
  })

  test.beforeEach(async () => {
    await resetPlayer(playerId)
  })

  test.afterAll(async () => {
    if (playerId) await resetPlayer(playerId)
  })

  test('pack purchase creates a transaction log entry', async ({ page }) => {
    test.setTimeout(60000)
    await login(page, TEST_PLAYER)
    await page.goto('/shop')
    await page.getByText('Starter Pack').click()
    await page.click('button:has-text("Buy 1 pack")')
    await expect(page.getByText(/Swipe to open|Swipe to see next|Last card!|You pulled:/).first()).toBeVisible({ timeout: 15000 })

    const txns = await getTransactions(playerId)
    expect(txns).toHaveLength(1)
    expect(txns[0].type).toBe('pack_purchase')
    expect(txns[0].amount).toBe(-100)
    expect(txns[0].balance_after).toBe(4900)
    expect(txns[0].metadata.pack_name).toBe('Starter Pack')
    expect(txns[0].metadata.quantity).toBe(1)
  })

  test('daily claim creates a transaction log entry', async ({ page }) => {
    test.setTimeout(60000)
    await login(page, TEST_PLAYER)
    await page.goto('/dashboard')

    const claimBtn = page.locator('button:has-text("Claim")')
    if (await claimBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await claimBtn.click()
      await page.waitForTimeout(2000)

      const txns = await getTransactions(playerId)
      const dailyTxn = txns.find((t: any) => t.type === 'daily_claim')
      expect(dailyTxn).toBeTruthy()
      expect(dailyTxn.amount).toBe(500)
      expect(dailyTxn.balance_after).toBe(5500)
    }
  })

  test('admin gruten edit creates a transaction log entry', async ({ page }) => {
    test.setTimeout(60000)
    await login(page, TEST_ADMIN)
    await page.goto('/admin/users')

    const row = page.getByTestId('user-row').filter({ hasText: 'Test Player' })
    await expect(row).toBeVisible({ timeout: 10000 })

    await row.locator('button:has-text("Edit")').click()
    const grutenInput = row.locator('input[type="number"]')
    await expect(grutenInput).toBeVisible({ timeout: 5000 })
    await grutenInput.clear()
    await grutenInput.fill('9000')
    await row.locator('button:has-text("Save")').click()
    await expect(row.getByText('9,000')).toBeVisible({ timeout: 10000 })

    const txns = await getTransactions(playerId)
    expect(txns).toHaveLength(1)
    expect(txns[0].type).toBe('admin_grant')
    expect(txns[0].amount).toBe(4000)
    expect(txns[0].balance_after).toBe(9000)
    expect(txns[0].metadata.admin_name).toBe('Test Admin')
  })

  test('multiple transactions create a valid chain', async ({ page }) => {
    test.setTimeout(90000)

    // 1. Admin grants gruten
    await login(page, TEST_ADMIN)
    await page.goto('/admin/users')
    const row = page.getByTestId('user-row').filter({ hasText: 'Test Player' })
    await expect(row).toBeVisible({ timeout: 10000 })
    await row.locator('button:has-text("Edit")').click()
    const grutenInput = row.locator('input[type="number"]')
    await grutenInput.clear()
    await grutenInput.fill('8000')
    await row.locator('button:has-text("Save")').click()
    await expect(row.getByText('8,000')).toBeVisible({ timeout: 10000 })

    // 2. Player buys a pack
    await login(page, TEST_PLAYER)
    await page.goto('/shop')
    await page.getByText('Starter Pack').click()
    await page.click('button:has-text("Buy 1 pack")')
    await expect(page.getByText(/Swipe to open|Swipe to see next|Last card!|You pulled:/).first()).toBeVisible({ timeout: 15000 })

    // Verify chain
    const txns = await getTransactions(playerId)
    expect(txns).toHaveLength(2)

    expect(txns[0].type).toBe('admin_grant')
    expect(txns[0].amount).toBe(3000)
    expect(txns[0].balance_after).toBe(8000)

    expect(txns[1].type).toBe('pack_purchase')
    expect(txns[1].amount).toBe(-100)
    expect(txns[1].balance_after).toBe(7900)

    // Verify chain integrity
    expect(txns[1].balance_after).toBe(txns[0].balance_after + txns[1].amount)
  })
})
