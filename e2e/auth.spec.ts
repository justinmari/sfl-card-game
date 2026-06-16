import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from './helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

test.describe('Authentication', () => {
  test('login page shows a tagline from the database (anon-readable)', async ({ page }) => {
    // The set is readable with the anon key (login is pre-auth).
    const res = await fetch(`${LOCAL_URL}/rest/v1/login_taglines?select=text`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    })
    const taglines = ((await res.json()) as { text: string }[]).map((t) => t.text)
    expect(taglines.length).toBeGreaterThan(0)

    await page.goto('/login')
    const tagline = page.getByTestId('login-tagline')
    await expect(tagline).toBeVisible()
    // Renders one of the seeded taglines (the default fallback is also in the set).
    await expect.poll(async () => taglines.includes(((await tagline.textContent()) || '').trim())).toBe(true)
  })

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
