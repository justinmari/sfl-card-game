import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER } from './helpers'

test.describe('Settings', () => {
  test('settings page loads with change password form', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/settings')
    await expect(page.getByText('Settings')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Change Password')).toBeVisible()
    await expect(page.getByPlaceholder('At least 6 characters')).toBeVisible()
    await expect(page.getByPlaceholder('Repeat password')).toBeVisible()
    await test.info().attach('settings-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('short password is blocked by browser validation', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/settings')
    await expect(page.getByText('Change Password')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('At least 6 characters').fill('abc')
    await page.getByPlaceholder('Repeat password').fill('abc')
    await page.click('button:has-text("Update Password")')

    // Browser native minLength validation prevents form submission — no success message should appear
    await expect(page.getByText('Password updated successfully!')).not.toBeVisible({ timeout: 2000 })
    await test.info().attach('short-password-blocked', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows error for mismatched passwords', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/settings')
    await expect(page.getByText('Change Password')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('At least 6 characters').fill('newpassword123')
    await page.getByPlaceholder('Repeat password').fill('differentpassword')
    await page.click('button:has-text("Update Password")')

    await expect(page.getByText('Passwords do not match')).toBeVisible({ timeout: 5000 })
    await test.info().attach('mismatch-error', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can change password successfully', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/settings')
    await expect(page.getByText('Change Password')).toBeVisible({ timeout: 10000 })

    // Change to a new password
    await page.getByPlaceholder('At least 6 characters').fill('temppass999')
    await page.getByPlaceholder('Repeat password').fill('temppass999')
    await page.click('button:has-text("Update Password")')

    await expect(page.getByText('Password updated successfully!')).toBeVisible({ timeout: 10000 })
    await test.info().attach('password-changed', { body: await page.screenshot(), contentType: 'image/png' })

    // Change back to original
    await page.getByPlaceholder('At least 6 characters').fill('password123')
    await page.getByPlaceholder('Repeat password').fill('password123')
    await page.click('button:has-text("Update Password")')
    await expect(page.getByText('Password updated successfully!')).toBeVisible({ timeout: 10000 })
  })

  test('inputs are cleared after successful password change', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/settings')
    await expect(page.getByText('Change Password')).toBeVisible({ timeout: 10000 })

    await page.getByPlaceholder('At least 6 characters').fill('temppass888')
    await page.getByPlaceholder('Repeat password').fill('temppass888')
    await page.click('button:has-text("Update Password")')

    await expect(page.getByText('Password updated successfully!')).toBeVisible({ timeout: 10000 })
    await expect(page.getByPlaceholder('At least 6 characters')).toHaveValue('')
    await expect(page.getByPlaceholder('Repeat password')).toHaveValue('')

    // Restore original password
    await page.getByPlaceholder('At least 6 characters').fill('password123')
    await page.getByPlaceholder('Repeat password').fill('password123')
    await page.click('button:has-text("Update Password")')
    await expect(page.getByText('Password updated successfully!')).toBeVisible({ timeout: 10000 })
  })
})
