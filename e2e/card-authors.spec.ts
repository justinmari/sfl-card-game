import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from './helpers'

const LOCAL = 'http://127.0.0.1:54321'
const SVC = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const svc = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' }

async function playerId(): Promise<string> {
  const res = await fetch(`${LOCAL}/auth/v1/admin/users?page=1&per_page=50`, { headers: svc })
  return ((await res.json()).users || []).find((u: { email: string }) => u.email === 'player@test.com').id
}

test.describe('Card authors', () => {
  test('player can submit a card anonymously', async ({ page }) => {
    const TITLE = `E2E anon submit ${Date.now()}`
    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${encodeURIComponent(TITLE)}`, { method: 'DELETE', headers: svc })

    await login(page, TEST_PLAYER)
    await page.goto('/suggest')
    await page.getByPlaceholder('Card name').fill(TITLE)
    await page.getByLabel('Submit anonymously').check()
    await page.getByRole('button', { name: 'Review & Submit' }).click()
    await expect(page.getByRole('heading', { name: 'Review Your Suggestion' })).toBeVisible()
    await expect(page.getByText('Author: Anonymous')).toBeVisible()
    await page.getByRole('button', { name: 'Confirm' }).click()
    await expect(page.getByText('Suggestion Submitted!')).toBeVisible({ timeout: 10000 })

    const rows = await (await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${encodeURIComponent(TITLE)}&select=is_anonymous`, { headers: svc })).json()
    expect(rows[0]?.is_anonymous).toBe(true)

    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${encodeURIComponent(TITLE)}`, { method: 'DELETE', headers: svc })
  })

  test('adding a credited suggestion persists the author and shows it on the card', async ({ page }) => {
    const pid = await playerId()
    const TITLE = `E2E credited card ${Date.now()}`
    const enc = encodeURIComponent(TITLE)
    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${enc}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/cards?name=eq.${enc}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/card_suggestions`, {
      method: 'POST', headers: svc,
      body: JSON.stringify({ user_id: pid, title: TITLE, status: 'pending', rarity: 'common', is_anonymous: false }),
    })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/suggestions')
    const card = page.locator('div.space-y-4 > div', { hasText: TITLE })
    await expect(card).toBeVisible({ timeout: 10000 })
    await card.getByRole('button', { name: 'Add to Game' }).click()
    await expect(page.getByText(TITLE)).toHaveCount(0, { timeout: 10000 })

    // The new card persists the real uploader and a public credit.
    await expect.poll(async () => {
      const r = await (await fetch(`${LOCAL}/rest/v1/cards?name=eq.${enc}&select=author_id,author_name,author_anonymous`, { headers: svc })).json()
      return r[0]
    }, { timeout: 10000 }).toMatchObject({ author_id: pid, author_name: 'Test Player', author_anonymous: false })

    // And it renders "by Test Player" on the trading card.
    await page.goto('/admin/cards')
    await page.getByPlaceholder('Search cards...').fill(TITLE)
    const adminCard = page.locator('[data-testid="admin-card"]', { hasText: TITLE })
    await expect(adminCard.getByTestId('card-author')).toContainText('by Test Player')

    await fetch(`${LOCAL}/rest/v1/cards?name=eq.${enc}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${enc}`, { method: 'DELETE', headers: svc })
  })

  test('Edit & Add saves the edited card, persists the author, and still awards 500', async ({ page }) => {
    const pid = await playerId()
    const stamp = Date.now()
    const ORIG = `E2E editadd orig ${stamp}`
    const NEW = `E2E editadd new ${stamp}`
    const encOrig = encodeURIComponent(ORIG)
    const encNew = encodeURIComponent(NEW)
    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${encOrig}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/cards?name=eq.${encNew}`, { method: 'DELETE', headers: svc })

    const before = (await (await fetch(`${LOCAL}/rest/v1/profiles?id=eq.${pid}&select=gruten`, { headers: svc })).json())[0].gruten as number
    await fetch(`${LOCAL}/rest/v1/card_suggestions`, {
      method: 'POST', headers: svc,
      body: JSON.stringify({ user_id: pid, title: ORIG, status: 'pending', rarity: 'common', is_anonymous: false }),
    })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/suggestions')
    const card = page.locator('div.space-y-4 > div', { hasText: ORIG })
    await expect(card).toBeVisible({ timeout: 10000 })
    await card.getByRole('button', { name: 'Edit & Add' }).click()

    // Now in edit mode: rename the card (title input is the first field), then Save & Add.
    const editCard = page.locator('div.space-y-4 > div').filter({ has: page.getByRole('button', { name: 'Save & Add' }) })
    await editCard.locator('input').first().fill(NEW)
    await editCard.getByRole('button', { name: 'Save & Add' }).click()
    await expect(page.getByText(ORIG)).toHaveCount(0, { timeout: 10000 })

    // Card created under the EDITED name, attributed to the original suggester.
    await expect.poll(async () => {
      const r = await (await fetch(`${LOCAL}/rest/v1/cards?name=eq.${encNew}&select=author_id,author_name,author_anonymous`, { headers: svc })).json()
      return r[0]
    }, { timeout: 10000 }).toMatchObject({ author_id: pid, author_name: 'Test Player', author_anonymous: false })

    // Editing the card doesn't change the reward — the suggester still gets 500G.
    await expect.poll(async () => {
      const p = await (await fetch(`${LOCAL}/rest/v1/profiles?id=eq.${pid}&select=gruten`, { headers: svc })).json()
      return p[0].gruten
    }, { timeout: 10000 }).toBe(before + 500)

    await fetch(`${LOCAL}/rest/v1/cards?name=eq.${encNew}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${encOrig}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/gruten_transactions?user_id=eq.${pid}&type=eq.suggestion_reward`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/profiles?id=eq.${pid}`, { method: 'PATCH', headers: svc, body: JSON.stringify({ gruten: before }) })
  })

  test('adding an anonymous suggestion keeps the uploader but shows Anonymous', async ({ page }) => {
    const pid = await playerId()
    const TITLE = `E2E anon card ${Date.now()}`
    const enc = encodeURIComponent(TITLE)
    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${enc}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/cards?name=eq.${enc}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/card_suggestions`, {
      method: 'POST', headers: svc,
      body: JSON.stringify({ user_id: pid, title: TITLE, status: 'pending', rarity: 'common', is_anonymous: true }),
    })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/suggestions')
    const card = page.locator('div.space-y-4 > div', { hasText: TITLE })
    await expect(card).toBeVisible({ timeout: 10000 })
    await card.getByRole('button', { name: 'Add to Game' }).click()
    await expect(page.getByText(TITLE)).toHaveCount(0, { timeout: 10000 })

    // DB keeps the real uploader; the public name is hidden.
    await expect.poll(async () => {
      const r = await (await fetch(`${LOCAL}/rest/v1/cards?name=eq.${enc}&select=author_id,author_name,author_anonymous`, { headers: svc })).json()
      return r[0]
    }, { timeout: 10000 }).toMatchObject({ author_id: pid, author_name: null, author_anonymous: true })

    await page.goto('/admin/cards')
    await page.getByPlaceholder('Search cards...').fill(TITLE)
    const adminCard = page.locator('[data-testid="admin-card"]', { hasText: TITLE })
    await expect(adminCard.getByTestId('card-author')).toContainText('by Anonymous')

    await fetch(`${LOCAL}/rest/v1/cards?name=eq.${enc}`, { method: 'DELETE', headers: svc })
    await fetch(`${LOCAL}/rest/v1/card_suggestions?title=eq.${enc}`, { method: 'DELETE', headers: svc })
  })
})
