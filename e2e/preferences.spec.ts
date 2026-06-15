import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER } from './helpers'

test.describe('Preferences', () => {
  test('avatar menu has a Preferences link that opens the page', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/dashboard')

    await page.getByRole('button', { name: 'Account menu' }).click()
    const link = page.getByRole('link', { name: 'Preferences' })
    await expect(link).toBeVisible({ timeout: 5000 })
    await link.click()

    await expect(page).toHaveURL(/\/preferences/)
    await expect(page.getByRole('switch', { name: 'Compact cards' })).toBeVisible({ timeout: 10000 })
    await test.info().attach('preferences-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('compact cards toggle is off by default', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/preferences')

    const toggle = page.getByRole('switch', { name: 'Compact cards' })
    await expect(toggle).toBeVisible({ timeout: 10000 })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  test('toggling compact cards updates and persists across reload', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/preferences')

    const toggle = page.getByRole('switch', { name: 'Compact cards' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 10000 })

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    // Persisted in localStorage — survives a reload
    await page.reload()
    const toggleAfter = page.getByRole('switch', { name: 'Compact cards' })
    await expect(toggleAfter).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })
    await test.info().attach('compact-on', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('compact preference controls collection card density', async ({ page }) => {
    await login(page, TEST_PLAYER)

    // Default: collection renders regular (non-compact) cards
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('collection-cards')).toHaveAttribute('data-compact', 'false')

    // Enable compact in preferences
    await page.goto('/preferences')
    const toggle = page.getByRole('switch', { name: 'Compact cards' })
    await expect(toggle).toBeVisible({ timeout: 10000 })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    // Collection now renders compact cards
    await page.goto('/collection')
    await expect(page.locator('text=/\\d+ card/')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('collection-cards')).toHaveAttribute('data-compact', 'true')
    await test.info().attach('collection-compact', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
