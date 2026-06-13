import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN } from '../helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function deleteCreatureByName(name: string) {
  await fetch(`${LOCAL_URL}/rest/v1/creatures?name=eq.${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers,
  })
}

function creatureRow(page: any, name: string) {
  return page.locator('.rounded-lg.border.border-zinc-800').filter({ hasText: name })
}

async function ensureCreaturesExist() {
  const seedCreatures = ['Fire Drake', 'Ice Golem', 'Shadow Cat', 'Thunder Bird', 'Earth Worm']
  for (const name of seedCreatures) {
    const check = await fetch(`${LOCAL_URL}/rest/v1/creatures?name=eq.${encodeURIComponent(name)}&select=id`, { headers })
    const data = await check.json()
    if (!Array.isArray(data) || data.length === 0) {
      await fetch(`${LOCAL_URL}/rest/v1/creatures`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name }),
      })
    }
  }
}

test.describe('Admin Creatures', () => {
  test.beforeAll(async () => {
    await ensureCreaturesExist()
  })

  test.afterAll(async () => {
    await deleteCreatureByName('Test Creature')
    await deleteCreatureByName('Renamed Creature')
    await ensureCreaturesExist()
  })

  test('admin can access manage creatures page', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/creatures')
    await expect(page.getByText('Manage Creatures')).toBeVisible({ timeout: 10000 })
    await test.info().attach('creatures-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows existing creatures', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/creatures')
    await expect(page.getByText('Fire Drake')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Ice Golem')).toBeVisible()
    await expect(page.getByText('Shadow Cat')).toBeVisible()
    await expect(page.getByText('Thunder Bird')).toBeVisible()
    await expect(page.getByText('Earth Worm')).toBeVisible()
  })

  test('can add a new creature', async ({ page }) => {
    await deleteCreatureByName('Test Creature')

    await login(page, TEST_ADMIN)
    await page.goto('/admin/creatures')
    await expect(page.getByText('Manage Creatures')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('Add a creature name...').fill('Test Creature')
    await page.click('button:has-text("Add")')

    await expect(page.getByText('Test Creature')).toBeVisible({ timeout: 10000 })
    await test.info().attach('creature-added', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('add button is disabled when input is empty', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/creatures')
    await expect(page.getByText('Manage Creatures')).toBeVisible({ timeout: 10000 })

    const addBtn = page.locator('button:has-text("Add")')
    await expect(addBtn).toBeDisabled()
  })

  test('can edit a creature name', async ({ page }) => {
    await deleteCreatureByName('Renamed Creature')
    await deleteCreatureByName('Test Creature')

    await fetch(`${LOCAL_URL}/rest/v1/creatures`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Test Creature' }),
    })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/creatures')
    await expect(page.getByText('Test Creature')).toBeVisible({ timeout: 10000 })

    const row = creatureRow(page, 'Test Creature')
    await row.locator('button:has-text("Edit")').click()

    // After clicking Edit, the name moves from a <span> to an <input value>.
    // The hasText filter on `row` no longer matches, so locate the edit input directly.
    const editInput = page.locator('.rounded-lg.border.border-zinc-800 input[type="text"]')
    await editInput.clear()
    await editInput.fill('Renamed Creature')
    await page.locator('.rounded-lg.border.border-zinc-800 button:has-text("Save")').click()

    await expect(page.getByText('Renamed Creature')).toBeVisible({ timeout: 10000 })
    await test.info().attach('creature-renamed', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can cancel creature edit', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/creatures')
    await expect(page.getByText('Fire Drake')).toBeVisible({ timeout: 10000 })

    const row = creatureRow(page, 'Fire Drake')
    await row.locator('button:has-text("Edit")').click()
    // After Edit click, row's hasText no longer matches — locate Cancel directly
    await page.locator('.rounded-lg.border.border-zinc-800 button:has-text("Cancel")').click()
    await expect(page.getByText('Fire Drake')).toBeVisible()
  })

  test('can delete a creature', async ({ page }) => {
    await deleteCreatureByName('Test Creature')
    await fetch(`${LOCAL_URL}/rest/v1/creatures`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Test Creature' }),
    })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/creatures')
    await expect(page.getByText('Test Creature')).toBeVisible({ timeout: 10000 })

    page.on('dialog', dialog => dialog.accept())

    const row = creatureRow(page, 'Test Creature')
    await row.locator('button:has-text("Delete")').click()

    await page.waitForTimeout(2000)
    await expect(page.getByText('Test Creature')).not.toBeVisible({ timeout: 10000 })
    await test.info().attach('creature-deleted', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
