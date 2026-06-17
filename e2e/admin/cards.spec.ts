import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN } from '../helpers'

test.describe('Admin Cards', () => {
  test('admin can access manage cards page', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/cards')
    await expect(page.getByText('Manage Cards')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=/All Cards.*\\(\\d+\\)/')).toBeVisible()
    await test.info().attach('admin-cards-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows card count', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/cards')
    await expect(page.locator('text=/All Cards.*\\(10\\)/')).toBeVisible({ timeout: 10000 })
  })

  test('shows upload cards section', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/cards')
    await expect(page.getByText('Upload Cards')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Drag & drop images here, or click to browse')).toBeVisible()
    await test.info().attach('upload-section', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can search cards by name', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/cards')
    await expect(page.locator('text=/All Cards/')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('Search cards...').fill('Fire')
    await page.waitForTimeout(500)
    await test.info().attach('search-fire', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can filter cards by rarity', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/cards')
    await expect(page.locator('text=/All Cards/')).toBeVisible({ timeout: 10000 })

    const raritySelect = page.locator('select').first()
    if (await raritySelect.isVisible()) {
      await raritySelect.selectOption({ index: 1 })
      await test.info().attach('rarity-filter', { body: await page.screenshot(), contentType: 'image/png' })
    }
  })

  test('can sort cards by name', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/cards')
    await expect(page.locator('text=/All Cards/')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Name")')
    await test.info().attach('sort-by-name', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can sort cards by rarity', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/cards')
    await expect(page.locator('text=/All Cards/')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Rarity")')
    await test.info().attach('sort-by-rarity', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can filter cards not in any pack', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/cards')
    await expect(page.locator('text=/All Cards/')).toBeVisible({ timeout: 10000 })

    const filterBtn = page.locator('button:has-text("Not in any pack")')
    if (await filterBtn.isVisible()) {
      await filterBtn.click()
      await test.info().attach('not-in-pack-filter', { body: await page.screenshot(), contentType: 'image/png' })
    }
  })

  test('card shows edit and delete on hover', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/cards')
    await expect(page.locator('text=/All Cards/')).toBeVisible({ timeout: 10000 })

    // Hover over the first card to reveal edit/delete buttons
    const firstCard = page.locator('[class*="cursor-pointer"]').first()
    if (await firstCard.isVisible()) {
      await firstCard.hover()
      await test.info().attach('card-hover', { body: await page.screenshot(), contentType: 'image/png' })
    }
  })

  test('manage cards respects the compact-cards preference', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sfl-preferences', JSON.stringify({ compactCards: true })))
    await login(page, TEST_ADMIN)
    await page.goto('/admin/cards')
    await expect(page.getByTestId('admin-cards')).toHaveAttribute('data-compact', 'true', { timeout: 10000 })
  })
})
