import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER, resetArenaEnabled, setArenaDisabled, cleanupArena } from '../helpers'

test.describe('Arena Toggle', () => {
  test.beforeEach(async () => {
    await resetArenaEnabled()
    await cleanupArena()
  })

  test.afterAll(async () => {
    await resetArenaEnabled()
  })

  test('admin can access feature settings page', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/arena')
    await expect(page.getByRole('heading', { name: 'Feature Settings' })).toBeVisible()
    await expect(page.getByText('Arena', { exact: true })).toBeVisible()
    await expect(page.getByText('Enabled', { exact: true }).first()).toBeVisible()
  })

  test('player cannot access feature settings page', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/admin/arena')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('admin can disable arena with confirmation', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/arena')

    await page.click('text=Disable Arena')
    await expect(page.getByText('Are you sure?')).toBeVisible()

    await page.click('text=Yes, Disable Arena')
    await expect(page.getByText('Disabled', { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('admin can re-enable arena', async ({ page }) => {
    await setArenaDisabled()
    await login(page, TEST_ADMIN)
    await page.goto('/admin/arena')

    await expect(page.getByText('Disabled', { exact: true })).toBeVisible()
    await page.click('text=Enable Arena')
    await expect(page.getByText('Enabled', { exact: true }).first()).toBeVisible({ timeout: 5000 })
  })

  test('admin can cancel disable', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/arena')

    await page.click('text=Disable Arena')
    await expect(page.getByText('Are you sure?')).toBeVisible()

    await page.click('text=Cancel')
    await expect(page.getByText('Are you sure?')).not.toBeVisible()
    await expect(page.getByText('Enabled', { exact: true }).first()).toBeVisible()
  })

  test('arena tile is disabled on dashboard when arena is off', async ({ page }) => {
    await setArenaDisabled()
    await login(page, TEST_PLAYER)
    await expect(page.locator('div.cursor-not-allowed:has-text("Arena")')).toBeVisible()
  })

  test('arena tile is clickable on dashboard when arena is on', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await expect(page.locator('a[href="/arena"]:has-text("Arena")')).toBeVisible()
  })

  test('player sees disabled page when navigating to /arena via URL', async ({ page }) => {
    await setArenaDisabled()
    await login(page, TEST_PLAYER)
    await page.goto('/arena')
    await expect(page.getByText('Arena Disabled')).toBeVisible()
  })

  test('player can access arena when enabled', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/arena')
    await expect(page.getByRole('heading', { name: 'Arena' })).toBeVisible()
    await expect(page.getByText('Arena Disabled')).not.toBeVisible()
  })
})
