import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN } from '../helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function deleteTypeByName(name: string) {
  await fetch(`${LOCAL_URL}/rest/v1/types?name=eq.${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers,
  })
}

function typeRow(page: any, name: string) {
  return page.getByTestId('type-row').filter({ hasText: name })
}

async function ensureTypesExist() {
  const seedTypes = ['Fire', 'Ice', 'Flying']
  for (const name of seedTypes) {
    const check = await fetch(`${LOCAL_URL}/rest/v1/types?name=eq.${encodeURIComponent(name)}&select=id`, { headers })
    const data = await check.json()
    if (!Array.isArray(data) || data.length === 0) {
      await fetch(`${LOCAL_URL}/rest/v1/types`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name }),
      })
    }
  }
}

test.describe('Admin Types', () => {
  test.beforeAll(async () => {
    await ensureTypesExist()
  })

  test.afterAll(async () => {
    await deleteTypeByName('Test Type')
    await deleteTypeByName('Renamed Type')
    await ensureTypesExist()
  })

  test('admin can access manage types page', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/types')
    await expect(page.getByText('Manage Types')).toBeVisible({ timeout: 10000 })
    await test.info().attach('types-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows existing types', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/types')
    await expect(page.getByText('Fire', { exact: true })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Ice', { exact: true })).toBeVisible()
    await expect(page.getByText('Flying', { exact: true })).toBeVisible()
  })

  test('can add a new type with description', async ({ page }) => {
    await deleteTypeByName('Test Type')

    await login(page, TEST_ADMIN)
    await page.goto('/admin/types')
    await expect(page.getByText('Manage Types')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('Add a type name...').fill('Test Type')
    await page.getByPlaceholder('Description (optional)').first().fill('A test label')
    await page.click('button:has-text("Add")')

    await expect(page.getByText('Test Type')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('A test label')).toBeVisible()
    await test.info().attach('type-added', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('add button is disabled when input is empty', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/types')
    await expect(page.getByText('Manage Types')).toBeVisible({ timeout: 10000 })

    const addBtn = page.locator('button:has-text("Add")')
    await expect(addBtn).toBeDisabled()
  })

  test('can edit a type name', async ({ page }) => {
    await deleteTypeByName('Renamed Type')
    await deleteTypeByName('Test Type')

    await fetch(`${LOCAL_URL}/rest/v1/types`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Test Type' }),
    })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/types')
    await expect(page.getByText('Test Type')).toBeVisible({ timeout: 10000 })

    const row = typeRow(page, 'Test Type')
    await row.locator('button:has-text("Edit")').click()

    // After clicking Edit, the name span becomes inputs; grab the first (name) input in the row.
    const editInput = page.getByTestId('type-row').locator('input[type="text"]').first()
    await editInput.clear()
    await editInput.fill('Renamed Type')
    await page.getByTestId('type-row').locator('button:has-text("Save")').click()

    await expect(page.getByText('Renamed Type')).toBeVisible({ timeout: 10000 })
    await test.info().attach('type-renamed', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can cancel type edit', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/types')
    await expect(page.getByText('Fire', { exact: true })).toBeVisible({ timeout: 10000 })

    const row = typeRow(page, 'Fire')
    await row.locator('button:has-text("Edit")').click()
    await page.getByTestId('type-row').locator('button:has-text("Cancel")').click()
    await expect(page.getByText('Fire', { exact: true })).toBeVisible()
  })

  test('can delete a type', async ({ page }) => {
    await deleteTypeByName('Test Type')
    await fetch(`${LOCAL_URL}/rest/v1/types`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Test Type' }),
    })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/types')
    await expect(page.getByText('Test Type')).toBeVisible({ timeout: 10000 })

    page.on('dialog', dialog => dialog.accept())

    const row = typeRow(page, 'Test Type')
    await row.locator('button:has-text("Delete")').click()

    await page.waitForTimeout(2000)
    await expect(page.getByText('Test Type')).not.toBeVisible({ timeout: 10000 })
    await test.info().attach('type-deleted', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('admin card edit modal shows type selector', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/cards')
    await expect(page.getByText('Manage Cards')).toBeVisible({ timeout: 10000 })

    // Hover the first card and click Edit
    const firstCard = page.getByTestId('admin-card').first()
    await firstCard.hover()
    await firstCard.locator('button:has-text("Edit")').click()

    await expect(page.getByText('Edit Card')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Types', { exact: true })).toBeVisible()
    // Type chips render inside the modal
    await expect(page.getByTestId('edit-card-modal').locator('button:has-text("Fire")')).toBeVisible()
    await test.info().attach('card-edit-types', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
