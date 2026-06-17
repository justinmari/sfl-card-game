import { test, expect } from '@playwright/test'
import { login, loginNewContext, TEST_ADMIN, TEST_PLAYER } from './helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }

async function clearPackages() {
  await fetch(`${LOCAL_URL}/rest/v1/gruten_packages?id=not.is.null`, { method: 'DELETE', headers })
}

test.describe('Care packages', () => {
  test.beforeEach(async () => {
    await clearPackages()
  })
  test.afterAll(async () => {
    await clearPackages()
  })

  test('admin sends a care package; player opens it from the navbar', async ({ page, browser }) => {
    // Admin sends 1,000 G to Test Player
    await login(page, TEST_ADMIN)
    await page.goto('/admin/care-packages')
    await expect(page.getByText('Send a Care Package')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: '1,000 G' }).click()
    await page.getByLabel('Recipient').selectOption({ label: 'Test Player' })
    await page.getByRole('button', { name: /Send 1,000 G/ }).click()
    await expect(page.getByText(/Sent 1 care package/)).toBeVisible({ timeout: 10000 })

    // Player sees the 📦 in the navbar and opens it
    const player = await loginNewContext(browser, TEST_PLAYER)
    await player.page.goto('/dashboard')
    const pkgBtn = player.page.locator('button[title*="care package"]')
    await expect(pkgBtn).toBeVisible({ timeout: 10000 })
    await pkgBtn.click({ force: true }) // navbar 📦 has animate-bounce; skip the stability wait
    await expect(player.page.getByText('Care Package Opened!')).toBeVisible({ timeout: 10000 })
    await player.context.close()
  })

  test('player with no packages sees no 📦 button', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/dashboard')
    await expect(page.getByText(/Welcome,/)).toBeVisible({ timeout: 10000 })
    await expect(page.locator('button[title*="care package"]')).toHaveCount(0)
  })

  test('non-admin cannot reach the care-packages admin page', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/admin/care-packages')
    await page.waitForTimeout(2000)
    expect(page.url()).not.toContain('/admin/care-packages')
  })

  test('recipient defaults to a placeholder; Send is gated until a player is chosen', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/care-packages')
    await expect(page.getByText('Send a Care Package')).toBeVisible({ timeout: 10000 })

    // Nothing chosen by default → can't accidentally send to everyone.
    await expect(page.getByRole('button', { name: 'Select a recipient' })).toBeDisabled()

    // Choosing a player enables Send and shows their confirmation card.
    await page.getByLabel('Recipient').selectOption({ label: 'Test Player' })
    await expect(page.getByRole('button', { name: /Send .* to Test Player/ })).toBeEnabled()
  })
})
