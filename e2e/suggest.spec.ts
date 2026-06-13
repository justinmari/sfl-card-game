import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER, TEST_ADMIN } from './helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function cleanupSuggestions() {
  await fetch(`${LOCAL_URL}/rest/v1/card_suggestions?id=neq.00000000-0000-0000-0000-000000000000`, {
    method: 'DELETE',
    headers,
  })
}

async function setSuggestionsEnabled(enabled: boolean) {
  await fetch(`${LOCAL_URL}/rest/v1/app_settings?key=eq.suggestions_enabled`, {
    method: 'DELETE',
    headers,
  })
  await fetch(`${LOCAL_URL}/rest/v1/app_settings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ key: 'suggestions_enabled', value: enabled }),
  })
}

async function resetSuggestionsEnabled() {
  await fetch(`${LOCAL_URL}/rest/v1/app_settings?key=eq.suggestions_enabled`, {
    method: 'DELETE',
    headers,
  })
}

test.describe('Card Suggestions', () => {
  test.beforeAll(async () => {
    await cleanupSuggestions()
  })

  test.afterAll(async () => {
    await cleanupSuggestions()
  })

  test('suggest page loads with form', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/suggest')
    await expect(page.getByText('Suggest a Card')).toBeVisible({ timeout: 10000 })
    await expect(page.getByPlaceholder('Card name')).toBeVisible()
    await expect(page.getByText('Review & Submit')).toBeVisible()
    await test.info().attach('suggest-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows remaining suggestions count', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/suggest')
    await expect(page.getByText(/suggestion.*remaining/)).toBeVisible({ timeout: 10000 })
  })

  test('card preview updates as form is filled', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/suggest')
    await expect(page.getByPlaceholder('Card name')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('Card name').fill('My Cool Card')
    await expect(page.getByText('My Cool Card')).toBeVisible()
    await test.info().attach('preview-update', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('review modal appears before submission', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/suggest')
    await expect(page.getByPlaceholder('Card name')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('Card name').fill('Test Suggestion')
    await page.click('button:has-text("Review & Submit")')

    await expect(page.getByText('Review Your Suggestion')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('You will not be able to remove this submission')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Go Back' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeVisible()
    await test.info().attach('review-modal', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can go back from review modal', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/suggest')
    await expect(page.getByPlaceholder('Card name')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('Card name').fill('Test Suggestion')
    await page.click('button:has-text("Review & Submit")')
    await expect(page.getByText('Review Your Suggestion')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("Go Back")')
    await expect(page.getByText('Review Your Suggestion')).not.toBeVisible()
  })

  test('can submit a card suggestion', async ({ page }) => {
    await cleanupSuggestions()
    await login(page, TEST_PLAYER)
    await page.goto('/suggest')
    await expect(page.getByPlaceholder('Card name')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('Card name').fill('E2E Test Card')
    await page.getByPlaceholder('Optional flavor text').fill('A test card from e2e')
    await page.click('button:has-text("Review & Submit")')
    await expect(page.getByText('Review Your Suggestion')).toBeVisible({ timeout: 5000 })
    await page.click('button:has-text("Confirm")')

    await expect(page.getByText('Suggestion Submitted!')).toBeVisible({ timeout: 10000 })
    await test.info().attach('submitted', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('submit button disabled without title', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/suggest')
    await expect(page.getByPlaceholder('Card name')).toBeVisible({ timeout: 10000 })

    const submitBtn = page.locator('button:has-text("Review & Submit")')
    await expect(submitBtn).toBeDisabled()
  })

  test('dashboard has suggest a card button', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/dashboard')
    await expect(page.getByText('Suggest a Card')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Admin Can Submit Suggestions', () => {
  test.beforeAll(async () => {
    await cleanupSuggestions()
    await resetSuggestionsEnabled()
  })

  test.afterAll(async () => {
    await cleanupSuggestions()
  })

  test('admin can submit a card suggestion', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/suggest')
    await expect(page.getByPlaceholder('Card name')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('Card name').fill('Admin Suggestion')
    await page.click('button:has-text("Review & Submit")')
    await expect(page.getByText('Review Your Suggestion')).toBeVisible({ timeout: 5000 })
    await page.click('button:has-text("Confirm")')

    await expect(page.getByText('Suggestion Submitted!')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Suggestions Feature Toggle', () => {
  test.afterAll(async () => {
    await resetSuggestionsEnabled()
  })

  test('suggest button hidden when feature disabled', async ({ page }) => {
    await setSuggestionsEnabled(false)
    await login(page, TEST_PLAYER)
    await page.goto('/dashboard')
    await expect(page.getByText('Shop')).toBeVisible({ timeout: 10000 })

    const suggestLink = page.locator('a[href="/suggest"]')
    await expect(suggestLink).toHaveCount(0)
  })

  test('suggest page redirects when feature disabled', async ({ page }) => {
    await setSuggestionsEnabled(false)
    await login(page, TEST_PLAYER)
    await page.goto('/suggest')
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
  })

  test('suggest button visible when feature enabled', async ({ page }) => {
    await setSuggestionsEnabled(true)
    await login(page, TEST_PLAYER)
    await page.goto('/dashboard')
    await expect(page.locator('a[href="/suggest"]')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Admin Card Suggestions', () => {
  test.beforeAll(async () => {
    await cleanupSuggestions()
    // Create a test suggestion via API
    const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers })
    const listData = await listRes.json()
    const player = listData.users?.find((u: any) => u.email === 'player@test.com')
    if (player) {
      await fetch(`${LOCAL_URL}/rest/v1/card_suggestions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: player.id,
          title: 'Admin Review Test',
          description: 'Test description',
          rarity: 'rare',
          status: 'pending',
        }),
      })
    }
  })

  test.afterAll(async () => {
    await cleanupSuggestions()
  })

  test('admin can access suggestions page', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/suggestions')
    await expect(page.getByText('Card Suggestions')).toBeVisible({ timeout: 10000 })
    await test.info().attach('admin-suggestions', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows pending suggestions', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/suggestions')
    await expect(page.getByText('Admin Review Test').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Add to Game' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Edit & Add' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible()
  })

  test('can archive a suggestion', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/suggestions')
    await expect(page.getByText('Admin Review Test').first()).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Archive', exact: true }).click()
    await page.waitForTimeout(2000)

    // Switch to archived tab to verify
    await page.getByRole('button', { name: /^Archived/ }).click()
    await expect(page.getByText('Admin Review Test').first()).toBeVisible({ timeout: 10000 })
    await test.info().attach('archived', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('dashboard has card suggestions admin button', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/dashboard')
    await expect(page.getByText('Card Suggestions')).toBeVisible({ timeout: 10000 })
  })
})
