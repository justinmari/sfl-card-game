import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN } from '../helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }

test.describe('Admin Skills', () => {
  test('admin can access manage skills page', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/skills')
    await expect(page.getByText('Manage Skills')).toBeVisible({ timeout: 10000 })
    await test.info().attach('skills-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows empty state when no skills exist', async ({ page }) => {
    // Establish the precondition: no skills (seed.sql seeds the built-ins).
    await fetch(`${LOCAL_URL}/rest/v1/card_skills?id=not.is.null`, { method: 'DELETE', headers })
    await fetch(`${LOCAL_URL}/rest/v1/skills?id=not.is.null`, { method: 'DELETE', headers })

    await login(page, TEST_ADMIN)
    await page.goto('/admin/skills')
    await expect(page.getByText('Manage Skills')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('No skills defined yet.')).toBeVisible({ timeout: 5000 })
    await test.info().attach('no-skills', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
