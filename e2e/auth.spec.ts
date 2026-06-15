import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from './helpers'

test.describe('Authentication', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })

  test('admin can log in and reach dashboard', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText('Welcome, Test Admin!')).toBeVisible()
  })

  test('player can log in and reach dashboard', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByText('Welcome, Test Player!')).toBeVisible()
  })

  test('shows error for wrong password', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', TEST_ADMIN.email)
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 5000 })
  })

  test('admin sees admin section on dashboard', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible()
    await expect(page.getByText('Feature Settings')).toBeVisible()
  })

  test('player does not see admin section', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await expect(page.getByText('Feature Settings')).not.toBeVisible()
  })
})
