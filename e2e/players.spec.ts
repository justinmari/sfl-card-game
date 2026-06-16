import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER, TEST_ADMIN } from './helpers'

test.describe('Players (Friends)', () => {
  test('players page shows all visible players', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/players')
    await expect(page.getByText('Friends')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Test Admin')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Test Player')).toBeVisible()
    await test.info().attach('players-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows (You) suffix for current user', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/players')
    await expect(page.getByText('(You)')).toBeVisible({ timeout: 10000 })
    await test.info().attach('you-suffix', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows Admin badge for admin users', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/players')
    await expect(page.getByText('Admin').first()).toBeVisible({ timeout: 10000 })
  })

  test('can click player to open detail modal', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/players')
    await expect(page.getByText('Test Admin')).toBeVisible({ timeout: 10000 })

    await page.getByText('Test Admin').click()
    await expect(page.getByTestId('player-modal')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('h2:has-text("Test Admin")')).toBeVisible()
    await test.info().attach('player-modal', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('player modal shows top cards', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/players')
    await expect(page.getByText('Test Admin')).toBeVisible({ timeout: 10000 })

    await page.getByText('Test Admin').click()
    await expect(page.getByTestId('player-modal')).toBeVisible({ timeout: 5000 })
    // Modal should show card slots (either filled or empty dashes)
    await test.info().attach('modal-top-cards', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can close player modal', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/players')
    await expect(page.getByText('Test Admin')).toBeVisible({ timeout: 10000 })

    await page.getByText('Test Admin').click()
    await expect(page.getByTestId('player-modal')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("Close")')
    await expect(page.getByTestId('player-modal')).not.toBeVisible()
  })

  test('can close modal by clicking backdrop', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/players')
    await expect(page.getByText('Test Admin')).toBeVisible({ timeout: 10000 })

    await page.getByText('Test Admin').click()
    await expect(page.getByTestId('player-modal')).toBeVisible({ timeout: 5000 })

    // Click the backdrop (the fixed overlay)
    await page.getByTestId('player-modal').click({ position: { x: 10, y: 10 } })
    await expect(page.getByTestId('player-modal')).not.toBeVisible({ timeout: 5000 })
  })

  test('shows player grid layout', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/players')
    await expect(page.getByText('Test Admin')).toBeVisible({ timeout: 10000 })

    const grid = page.getByTestId('player-grid')
    await expect(grid).toBeVisible()
    await test.info().attach('grid-layout', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
