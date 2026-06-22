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

test.describe('Card suggestion reward', () => {
  test('adding a suggested card pays the suggester 500G', async ({ page }) => {
    const usersRes = await fetch(`${LOCAL}/auth/v1/admin/users?page=1&per_page=50`, { headers: svc })
    const player = ((await usersRes.json()).users || []).find((u: { email: string }) => u.email === 'player@test.com')

    const TITLE = 'E2E reward probe'
    const enc = encodeURIComponent(TITLE)
    // Clean up any leftovers from a prior run.
    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${enc}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/cards?name=eq.${enc}`, { method: 'DELETE', headers: svc })

    const profBefore = await (await fetch(`${LOCAL}/rest/v1/profiles?id=eq.${player.id}&select=gruten`, { headers: svc })).json()
    const before = profBefore[0].gruten as number

    await fetch(`${LOCAL}/rest/v1/card_suggestions`, {
      method: 'POST', headers: svc,
      body: JSON.stringify({ user_id: player.id, title: TITLE, status: 'pending', rarity: 'common' }),
    })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/suggestions')
    const card = page.locator('div.space-y-4 > div', { hasText: TITLE })
    await expect(card).toBeVisible({ timeout: 10000 })
    await card.getByRole('button', { name: 'Add to Game' }).click()
    // After the add, the suggestion leaves the pending list.
    await expect(page.getByText(TITLE)).toHaveCount(0, { timeout: 10000 })

    // The suggester's balance went up by exactly 500, logged as a suggestion_reward.
    await expect.poll(async () => {
      const p = await (await fetch(`${LOCAL}/rest/v1/profiles?id=eq.${player.id}&select=gruten`, { headers: svc })).json()
      return p[0].gruten
    }, { timeout: 10000 }).toBe(before + 500)

    const txns = await (await fetch(
      `${LOCAL}/rest/v1/gruten_transactions?user_id=eq.${player.id}&type=eq.suggestion_reward&order=created_at.desc&limit=1`,
      { headers: svc },
    )).json()
    expect(txns.length).toBe(1)
    expect(txns[0].amount).toBe(500)
    // The audit row carries enough context to trace it back to the card.
    expect(txns[0].metadata).toMatchObject({ title: TITLE })

    // It shows up in the admin Gruten transaction audit, labeled and filterable.
    await page.goto('/admin/transactions')
    const log = page.getByTestId('transaction-log')
    await expect(log).toBeVisible({ timeout: 10000 })
    await page.getByLabel('Filter by player').selectOption(player.id)
    await page.getByLabel('Filter by type').selectOption('suggestion_reward')
    const row = log.locator('[data-testid="txn-row"]', { hasText: 'Suggestion reward' }).first()
    await expect(row).toBeVisible()
    await expect(row).toContainText('+500')

    // Cleanup: remove the seeded suggestion + card + reward txn, restore balance.
    await fetch(`${LOCAL}/rest/v1/gruten_transactions?id=eq.${txns[0].id}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${enc}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/cards?name=eq.${enc}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/profiles?id=eq.${player.id}`, {
      method: 'PATCH', headers: svc, body: JSON.stringify({ gruten: before }),
    })
  })

  test('adding multiple suggested cards pays 500 for each', async ({ page }) => {
    const usersRes = await fetch(`${LOCAL}/auth/v1/admin/users?page=1&per_page=50`, { headers: svc })
    const player = ((await usersRes.json()).users || []).find((u: { email: string }) => u.email === 'player@test.com')
    const stamp = Date.now()
    const titles = [1, 2, 3].map((n) => `E2E multi reward ${stamp}-${n}`)

    for (const t of titles) {
      await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${encodeURIComponent(t)}`, { method: 'DELETE', headers: svc })
      await fetch(`${LOCAL}/rest/v1/cards?name=eq.${encodeURIComponent(t)}`, { method: 'DELETE', headers: svc })
    }
    const before = (await (await fetch(`${LOCAL}/rest/v1/profiles?id=eq.${player.id}&select=gruten`, { headers: svc })).json())[0].gruten as number
    await fetch(`${LOCAL}/rest/v1/card_suggestions`, {
      method: 'POST', headers: svc,
      body: JSON.stringify(titles.map((t) => ({ user_id: player.id, title: t, status: 'pending', rarity: 'common' }))),
    })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/suggestions')
    for (const t of titles) {
      const card = page.locator('div.space-y-4 > div', { hasText: t })
      await expect(card).toBeVisible({ timeout: 10000 })
      await card.getByRole('button', { name: 'Add to Game' }).click()
      await expect(page.getByText(t)).toHaveCount(0, { timeout: 10000 })
    }

    // Each add paid 500 → +1500 total, three distinct reward rows.
    await expect.poll(async () => {
      const p = await (await fetch(`${LOCAL}/rest/v1/profiles?id=eq.${player.id}&select=gruten`, { headers: svc })).json()
      return p[0].gruten
    }, { timeout: 10000 }).toBe(before + 1500)

    const txns = await (await fetch(`${LOCAL}/rest/v1/gruten_transactions?user_id=eq.${player.id}&type=eq.suggestion_reward&select=amount,metadata`, { headers: svc })).json()
    const mine = (txns as { amount: number; metadata: { title?: string } }[]).filter((t) => titles.includes(t.metadata?.title ?? ''))
    expect(mine.length).toBe(3)
    expect(mine.every((t) => t.amount === 500)).toBe(true)

    for (const t of titles) {
      await fetch(`${LOCAL}/rest/v1/cards?name=eq.${encodeURIComponent(t)}`, { method: 'DELETE', headers: svc })
      await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${encodeURIComponent(t)}`, { method: 'DELETE', headers: svc })
    }
    await fetch(`${LOCAL}/rest/v1/gruten_transactions?user_id=eq.${player.id}&type=eq.suggestion_reward`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/profiles?id=eq.${player.id}`, { method: 'PATCH', headers: svc, body: JSON.stringify({ gruten: before }) })
  })

  test('player sees a combined toast when multiple of their cards were added', async ({ page }) => {
    const usersRes = await fetch(`${LOCAL}/auth/v1/admin/users?page=1&per_page=50`, { headers: svc })
    const player = ((await usersRes.json()).users || []).find((u: { email: string }) => u.email === 'player@test.com')
    const stamp = Date.now()
    const titles = [1, 2, 3].map((n) => `E2E multi toast ${stamp}-${n}`)

    // Clean slate: mark any pre-existing rewards seen so exactly our 3 are unseen.
    await fetch(`${LOCAL}/rest/v1/card_suggestions?user_id=eq.${player.id}&status=eq.added`, {
      method: 'PATCH', headers: svc, body: JSON.stringify({ reward_seen: true }),
    })
    for (const t of titles) await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${encodeURIComponent(t)}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/card_suggestions`, {
      method: 'POST', headers: svc,
      body: JSON.stringify(titles.map((t) => ({ user_id: player.id, title: t, status: 'added', reward_paid: true, reward_seen: false }))),
    })

    await login(page, TEST_PLAYER)
    const toast = page.getByTestId('suggestion-reward-toast')
    await expect(toast).toBeVisible({ timeout: 10000 })
    await expect(toast).toContainText('3 of your cards were added to the game!')
    await expect(toast).toContainText('+1,500 Gruten')

    // All three got marked seen, so the toast won't fire again.
    await expect.poll(async () => {
      const r = await (await fetch(`${LOCAL}/rest/v1/card_suggestions?user_id=eq.${player.id}&status=eq.added&reward_paid=eq.true&reward_seen=eq.false&select=id`, { headers: svc })).json()
      return r.length
    }, { timeout: 10000 }).toBe(0)

    for (const t of titles) await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${encodeURIComponent(t)}`, { method: 'DELETE', headers: svc })
  })
})

test.describe('Card suggestion reward notification', () => {
  test('player sees a one-time toast when their card was added, then it is marked seen', async ({ page }) => {
    const usersRes = await fetch(`${LOCAL}/auth/v1/admin/users?page=1&per_page=50`, { headers: svc })
    const player = ((await usersRes.json()).users || []).find((u: { email: string }) => u.email === 'player@test.com')

    const TITLE = 'E2E toast probe'
    const enc = encodeURIComponent(TITLE)
    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${enc}`, { method: 'DELETE', headers: svc })
    // Seed an already-added, paid, but unseen reward — the state that drives the toast.
    await fetch(`${LOCAL}/rest/v1/card_suggestions`, {
      method: 'POST', headers: svc,
      body: JSON.stringify({ user_id: player.id, title: TITLE, status: 'added', reward_paid: true, reward_seen: false }),
    })

    // login() lands on /dashboard, where the navbar mounts and fires the toast.
    await login(page, TEST_PLAYER)

    const toast = page.getByTestId('suggestion-reward-toast')
    await expect(toast).toBeVisible({ timeout: 10000 })
    await expect(toast).toContainText(TITLE)
    await expect(toast).toContainText('+500 Gruten')

    // The toast marks the reward seen, so it won't fire again.
    await expect.poll(async () => {
      const r = await (await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${enc}&select=reward_seen`, { headers: svc })).json()
      return r[0]?.reward_seen
    }, { timeout: 10000 }).toBe(true)

    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${enc}`, { method: 'DELETE', headers: svc })
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
