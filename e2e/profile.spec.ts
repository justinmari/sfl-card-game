import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER } from './helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function resetPlayerName() {
  const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers })
  const listData = await listRes.json()
  const user = listData.users?.find((u: any) => u.email === 'player@test.com')
  if (user?.id) {
    await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ full_name: 'Test Player' }),
    })
  }
}

test.describe('Profile', () => {
  test.afterAll(async () => {
    await resetPlayerName()
  })

  test('profile page loads with current display name', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/profile')
    await expect(page.getByText('Display Name')).toBeVisible({ timeout: 10000 })

    const nameInput = page.locator('input[type="text"]').first()
    await expect(nameInput).toHaveValue('Test Player', { timeout: 5000 })
    await test.info().attach('profile-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can change display name', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/profile')
    await expect(page.getByText('Display Name')).toBeVisible({ timeout: 10000 })

    const nameInput = page.locator('input[type="text"]')
    await nameInput.clear()
    await nameInput.fill('New Name')
    await page.click('button:has-text("Save Profile")')

    await expect(page.getByText('Profile updated!')).toBeVisible({ timeout: 10000 })
    await test.info().attach('name-changed', { body: await page.screenshot(), contentType: 'image/png' })

    // Restore
    await nameInput.clear()
    await nameInput.fill('Test Player')
    await page.click('button:has-text("Save Profile")')
    await expect(page.getByText('Profile updated!')).toBeVisible({ timeout: 10000 })
  })

  test('shows top 4 cards section', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/profile')
    await expect(page.locator('text=/Top 4/')).toBeVisible({ timeout: 10000 })
    await test.info().attach('top-4-section', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can toggle top 4 cards edit mode', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/profile')
    await expect(page.locator('text=/Top 4/')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Edit")')
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible({ timeout: 5000 })
    await test.info().attach('top4-edit-mode', { body: await page.screenshot(), contentType: 'image/png' })

    await page.click('button:has-text("Done")')
    await expect(page.getByPlaceholder('Search cards...')).not.toBeVisible()
  })

  test('shows avatar section', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/profile')
    await expect(page.getByText('Change Avatar')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="file"]')).toBeAttached()
    await test.info().attach('avatar-section', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('save button shows saving state', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/profile')
    await expect(page.getByText('Display Name')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Save Profile")')
    await expect(page.getByText(/Profile updated!|Saving.../)).toBeVisible({ timeout: 10000 })
  })
})
