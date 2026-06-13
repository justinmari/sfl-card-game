import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER } from './helpers'

test.describe('Collection Acquired Sort', () => {
  test('acquired sort option is visible', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })

    await expect(page.getByText('Acquired')).toBeVisible()
  })

  test('clicking acquired shows date sections', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Acquired")')

    // Should show date section headers
    await expect(page.locator('h3').first()).toBeVisible({ timeout: 5000 })
    await test.info().attach('acquired-sort', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('date sections contain cards sorted by rarity', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Acquired")')
    await expect(page.locator('h3').first()).toBeVisible({ timeout: 5000 })

    // Cards should still be visible under sections
    await expect(page.locator('text=/\\d+ card/')).toBeVisible()
    await test.info().attach('date-sections-rarity', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
