import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER } from './helpers'

test.describe('Collection', () => {
  test('collection page shows owned cards', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.getByText('My Collection')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 5000 })
    await test.info().attach('collection-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('collection shows card count', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card.*unique/')).toBeVisible({ timeout: 10000 })
  })

  test('can sort by rarity', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })
    await page.click('button:has-text("Rarity")')
    await test.info().attach('sort-rarity', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can sort by name', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })
    await page.click('button:has-text("Name")')
    await test.info().attach('sort-name', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can sort by quantity', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })
    await page.click('button:has-text("Quantity")')
    await test.info().attach('sort-quantity', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can click a card to see detail modal', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })

    // Cards have mobile (sm:hidden) and desktop (hidden sm:block) versions
    // Click on the desktop version's container
    const desktopCard = page.locator('div.hidden.sm\\:block').first()
    await desktopCard.click()
    await expect(page.getByText(/Owned: x\d+/)).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button:has-text("Close")')).toBeVisible()
    await test.info().attach('card-detail-modal', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can close card detail modal', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })

    const desktopCard = page.locator('div.hidden.sm\\:block').first()
    await desktopCard.click()
    await expect(page.getByText(/Owned: x\d+/)).toBeVisible({ timeout: 5000 })
    await page.click('button:has-text("Close")')
    await expect(page.getByText(/Owned: x\d+/)).not.toBeVisible()
  })

  test('can filter by creature', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('All creatures').click()
    // Dropdown opens; pick first available creature from the list
    const creatureBtn = page.locator('.absolute.z-30 button').nth(1)
    await expect(creatureBtn).toBeVisible({ timeout: 5000 })
    await creatureBtn.click()
    await test.info().attach('filter-creature', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can filter by pack', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('All packs').click()
    await expect(page.locator('button:has-text("Starter Pack")')).toBeVisible({ timeout: 5000 })
    await page.locator('button:has-text("Starter Pack")').click()
    await test.info().attach('filter-pack', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows type labels on cards', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })

    // Seeded cards carry types (e.g. Fire Drake Common -> Fire). Type chips render in cyan.
    // Cards render both a mobile (sm:hidden) and desktop (hidden sm:block) copy, so target a visible one.
    await expect(page.locator('span.text-cyan-300:visible').first()).toBeVisible({ timeout: 5000 })
    await test.info().attach('collection-types', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can filter by type', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('All types').click()
    // Dropdown opens; pick first available type from the list (index 0 is "All types")
    const typeBtn = page.locator('.absolute.z-30 button').nth(1)
    await expect(typeBtn).toBeVisible({ timeout: 5000 })
    await typeBtn.click()
    await expect(page.locator('text=/\\d+ card/')).toBeVisible()
    await test.info().attach('filter-type', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
