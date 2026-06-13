import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from '../helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function resetPlayerGruten() {
  const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers })
  const listData = await listRes.json()
  const user = listData.users?.find((u: any) => u.email === 'player@test.com')
  if (user?.id) {
    await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ gruten: 5000 }),
    })
  }
}

async function resetPlayerPassword() {
  const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers })
  const listData = await listRes.json()
  const user = listData.users?.find((u: any) => u.email === 'player@test.com')
  if (user?.id) {
    await fetch(`${LOCAL_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password: 'password123' }),
    })
  }
}

async function resetPlayerHidden() {
  const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers })
  const listData = await listRes.json()
  const user = listData.users?.find((u: any) => u.email === 'player@test.com')
  if (user?.id) {
    await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ hidden: false }),
    })
  }
}

async function deleteTestUser(email: string) {
  const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers })
  const listData = await listRes.json()
  const user = listData.users?.find((u: any) => u.email === email)
  if (user?.id) {
    await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${user.id}`, { method: 'DELETE', headers })
    await fetch(`${LOCAL_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers })
  }
}

function userRow(page: any, name: string) {
  return page.locator('.rounded-xl.border.border-zinc-800').filter({ hasText: name })
}

test.describe('Admin Users', () => {
  test.afterAll(async () => {
    await resetPlayerGruten()
    await resetPlayerHidden()
    await deleteTestUser('newuser@test.com')
  })

  test('admin can access manage users page', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/users')
    await expect(page.getByText('Manage Users')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Test Admin')).toBeVisible({ timeout: 5000 })
    await test.info().attach('admin-users-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('users list shows all profiles', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/users')
    await expect(page.getByText('Test Admin')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Test Player')).toBeVisible()
  })

  test('admin badge is shown for admin users', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/users')
    const adminRow = userRow(page, 'Test Admin')
    await expect(adminRow.getByText('Admin', { exact: true })).toBeVisible({ timeout: 10000 })
  })

  test('can open invite user form', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/users')
    await expect(page.getByText('Manage Users')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Invite User")')
    await expect(page.getByText('Invite New User')).toBeVisible({ timeout: 5000 })
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
    await test.info().attach('invite-form', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can cancel invite form', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/users')
    await expect(page.getByText('Manage Users')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Invite User")')
    await expect(page.getByText('Invite New User')).toBeVisible({ timeout: 5000 })
    await page.click('button:has-text("Cancel")')
    await expect(page.getByText('Invite New User')).not.toBeVisible()
  })

  test('can create a new user', async ({ page }) => {
    await deleteTestUser('newuser@test.com')

    await login(page, TEST_ADMIN)
    await page.goto('/admin/users')
    await expect(page.getByText('Manage Users')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Invite User")')
    await page.getByPlaceholder('Email').fill('newuser@test.com')
    await page.getByPlaceholder('Password').fill('testpass123')
    await page.click('button:has-text("Create Account")')

    await page.waitForTimeout(3000)
    await page.reload()
    await expect(page.getByText('Manage Users')).toBeVisible({ timeout: 10000 })
    await test.info().attach('user-created', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can edit user gruten', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/users')
    const row = userRow(page, 'Test Player')
    await expect(row).toBeVisible({ timeout: 10000 })

    await row.locator('button:has-text("Edit")').click()
    const grutenInput = row.locator('input[type="number"]')
    await expect(grutenInput).toBeVisible({ timeout: 5000 })
    await grutenInput.clear()
    await grutenInput.fill('9999')
    await row.locator('button:has-text("Save")').click()

    await expect(row.getByText('9,999')).toBeVisible({ timeout: 10000 })
    await test.info().attach('gruten-edited', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can toggle user hidden status', async ({ page }) => {
    await resetPlayerHidden()
    await login(page, TEST_ADMIN)
    await page.goto('/admin/users')
    const row = userRow(page, 'Test Player')
    await expect(row).toBeVisible({ timeout: 10000 })

    await row.locator('button:has-text("Hide")').click()
    await expect(row.getByText('Hidden')).toBeVisible({ timeout: 10000 })
    await test.info().attach('user-hidden', { body: await page.screenshot(), contentType: 'image/png' })

    await row.locator('button:has-text("Show")').click()
    await expect(row.getByText('Hidden')).not.toBeVisible({ timeout: 10000 })
  })

  test('can reset user password', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/users')
    const row = userRow(page, 'Test Player')
    await expect(row).toBeVisible({ timeout: 10000 })

    page.on('dialog', dialog => dialog.accept())
    await row.locator('button:has-text("Reset PW")').click()
    await expect(row.getByText('Temp password:')).toBeVisible({ timeout: 10000 })
    await expect(row.locator('button:has-text("Copy")')).toBeVisible()
    await test.info().attach('password-reset', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('non-admin cannot access admin users page', async ({ page }) => {
    await resetPlayerPassword()
    await login(page, TEST_PLAYER)
    await page.goto('/admin/users')
    await page.waitForTimeout(3000)
    const url = page.url()
    expect(url).not.toContain('/admin/users')
    await test.info().attach('access-denied', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
