import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from '../helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function resetGruten(userId: string, amount: number) {
  const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers })
  const listData = await listRes.json()
  const user = listData.users?.find((u: any) => u.email === (amount === 10000 ? 'admin@test.com' : 'player@test.com'))
  if (user?.id) {
    await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ gruten: amount, last_pack_purchase: null }),
    })
  }
}

async function getPlayerId(): Promise<string> {
  const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers })
  const listData = await listRes.json()
  const user = listData.users?.find((u: any) => u.email === 'player@test.com')
  return user?.id
}

test.describe('Shop', () => {
  test.beforeEach(async () => {
    const id = await getPlayerId()
    if (id) await resetGruten(id, 5000)
  })

  test('shop page shows available packs', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/shop')
    await expect(page.getByText('Starter Pack')).toBeVisible({ timeout: 10000 })
    await test.info().attach('shop-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('clicking a pack opens buy modal', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/shop')
    await page.getByText('Starter Pack').click()
    await expect(page.getByText('Buy 1 pack')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Buy 5 packs')).toBeVisible()
    await expect(page.getByText('Buy 10 packs')).toBeVisible()
    await expect(page.getByText('Drop Rates')).toBeVisible()
    await test.info().attach('buy-modal', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('buy modal shows the pack card grid, with blanks for undiscovered cards', async ({ page }) => {
    const id = await getPlayerId()
    const SECRET_CARD = 'dddddddd-0010-0000-0000-000000000000' // Earth Worm Secret (secret_rare)
    // Make one card undiscovered by removing it from the player's collection.
    await fetch(`${LOCAL_URL}/rest/v1/user_cards?user_id=eq.${id}&card_id=eq.${SECRET_CARD}`, { method: 'DELETE', headers })
    try {
      await login(page, TEST_PLAYER)
      await page.goto('/shop')
      await page.getByText('Starter Pack').click()

      const grid = page.getByTestId('pack-card-grid')
      await expect(grid).toBeVisible({ timeout: 5000 })

      // Every card in the pack is represented (Starter Pack seeds all 10 cards).
      const tiles = grid.getByTestId('tiny-card')
      expect(await tiles.count()).toBe(10)

      // The removed card shows as a blank: present as a tile, but with no <img>.
      const blanks = grid.locator('[data-testid="tiny-card"][data-owned="false"]')
      expect(await blanks.count()).toBeGreaterThanOrEqual(1)
      await expect(blanks.first().locator('img')).toHaveCount(0)

      // DOM-leak guard: the undiscovered card's name appears NOWHERE in the
      // modal, but an owned card's name IS present (in its hover tooltip).
      const modal = page.locator('div.surface').filter({ hasText: 'Cards in this pack' })
      await expect(modal).not.toContainText('Earth Worm Secret')
      await expect(modal).toContainText('Fire Drake Common') // owned, in this pack

      const owned = grid.locator('[data-testid="tiny-card"][data-owned="true"]')
      expect(await owned.count()).toBeGreaterThanOrEqual(1)

      await test.info().attach('pack-card-grid', { body: await page.screenshot(), contentType: 'image/png' })
    } finally {
      // Restore so other specs still see the player owning everything.
      await fetch(`${LOCAL_URL}/rest/v1/user_cards`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id: id, card_id: SECRET_CARD, count: 1 }),
      })
    }
  })

  test('buy modal shows correct prices', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/shop')
    await page.getByText('Starter Pack').click()
    await expect(page.getByText('Buy 1 pack')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button:has-text("Buy 1 pack") >> text="100 G"')).toBeVisible()
    await expect(page.locator('button:has-text("Buy 5 packs") >> text="500 G"')).toBeVisible()
    await expect(page.locator('button:has-text("Buy 10 packs") >> text="1,000 G"')).toBeVisible()
    await test.info().attach('prices', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can cancel buy modal', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/shop')
    await page.getByText('Starter Pack').click()
    await expect(page.getByText('Buy 1 pack')).toBeVisible({ timeout: 5000 })
    await page.click('button:has-text("Cancel")')
    await expect(page.getByText('Buy 1 pack')).not.toBeVisible()
  })

  test('buying a pack shows card reveal', async ({ page }) => {
    test.setTimeout(60000)
    await login(page, TEST_PLAYER)
    await page.goto('/shop')
    await page.getByText('Starter Pack').click()
    await page.click('button:has-text("Buy 1 pack")')

    await expect(page.getByText(/Swipe to see next|Last card!|You pulled:/)).toBeVisible({ timeout: 15000 })
    await test.info().attach('card-reveal', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can skip to view all pulled cards', async ({ page }) => {
    test.setTimeout(60000)
    await login(page, TEST_PLAYER)
    await page.goto('/shop')
    await page.getByText('Starter Pack').click()
    await page.click('button:has-text("Buy 1 pack")')

    await expect(page.getByText(/Swipe to see next|Last card!/)).toBeVisible({ timeout: 15000 })

    // Skip/View All buttons are in the swipe view (no mobile/desktop split)
    const skipBtn = page.locator('button:has-text("Skip & View All")')
    const viewAllBtn = page.locator('button:has-text("View All")')
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click()
    } else if (await viewAllBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewAllBtn.click()
    }

    // Summary "You pulled:" has mobile/desktop versions — use the desktop container
    const desktop = page.getByTestId('reveal-summary-desktop')
    await expect(desktop.getByText('You pulled:')).toBeVisible({ timeout: 10000 })
    await test.info().attach('view-all', { body: await page.screenshot(), contentType: 'image/png' })

    await desktop.locator('button:has-text("Done")').click()
    await expect(page.getByText('Starter Pack')).toBeVisible({ timeout: 10000 })
  })

  test('gruten is deducted after purchase', async ({ page }) => {
    test.setTimeout(60000)
    await login(page, TEST_PLAYER)
    await page.goto('/shop')

    const grutenBefore = await page.locator('text=/\\d+\\s*G/').first().textContent()
    await page.getByText('Starter Pack').click()
    await page.click('button:has-text("Buy 1 pack")')
    await expect(page.getByText(/Swipe to see next|Last card!|You pulled:/)).toBeVisible({ timeout: 15000 })

    // Skip through the reveal
    const skipBtn = page.locator('button:has-text("Skip & View All")')
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click()
    }

    // Done button is inside the desktop summary container
    const desktop = page.getByTestId('reveal-summary-desktop')
    await expect(desktop.getByText('You pulled:')).toBeVisible({ timeout: 15000 })
    await desktop.locator('button:has-text("Done")').click()
    await expect(page.getByText('Starter Pack')).toBeVisible({ timeout: 10000 })

    // Reload to get fresh gruten from server (Next.js caches server components)
    await page.reload()
    await expect(page.getByText('Starter Pack')).toBeVisible({ timeout: 10000 })
    const grutenAfter = await page.locator('text=/\\d+\\s*G/').first().textContent()
    expect(grutenBefore).not.toBe(grutenAfter)
    await test.info().attach('gruten-deducted', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('insufficient funds disables expensive buy options', async ({ page }) => {
    const id = await getPlayerId()
    if (id) {
      await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ gruten: 50 }),
      })
    }

    await login(page, TEST_PLAYER)
    await page.goto('/shop')
    await page.getByText('Starter Pack').click()
    await expect(page.getByText('Buy 1 pack')).toBeVisible({ timeout: 5000 })

    const buy1Btn = page.locator('button:has-text("Buy 1 pack")')
    await expect(buy1Btn).toBeDisabled()
    await test.info().attach('insufficient-funds', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
