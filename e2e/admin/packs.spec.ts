import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN } from '../helpers'

test.describe('Admin Packs', () => {
  test('admin can access manage packs page', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/packs')
    await expect(page.getByText('Manage Packs')).toBeVisible({ timeout: 10000 })
    await test.info().attach('admin-packs-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows existing packs', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/packs')
    await expect(page.getByRole('heading', { name: 'Starter Pack' }).first()).toBeVisible({ timeout: 10000 })
  })

  test('shows pack status badge', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/packs')
    await expect(page.getByRole('heading', { name: 'Starter Pack' }).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Active|Inactive/).first()).toBeVisible()
    await test.info().attach('pack-status', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('shows cards per pack info', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/packs')
    await expect(page.getByRole('heading', { name: 'Starter Pack' }).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('3 cards/pack')).toBeVisible()
  })

  test('shows drop rates section', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/packs')
    await expect(page.getByRole('heading', { name: 'Starter Pack' }).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('DROP RATES')).toBeVisible()
    await test.info().attach('drop-rates', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can deactivate and reactivate a pack', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/packs')
    await expect(page.getByRole('heading', { name: 'Starter Pack' }).first()).toBeVisible({ timeout: 10000 })

    const deactivateBtn = page.locator('button:has-text("Deactivate")')
    const activateBtn = page.locator('button:has-text("Activate")')

    if (await deactivateBtn.isVisible()) {
      await deactivateBtn.click()
      await expect(page.getByText('Inactive').first()).toBeVisible({ timeout: 10000 })
      await test.info().attach('deactivated', { body: await page.screenshot(), contentType: 'image/png' })

      await page.locator('button:has-text("Activate")').click()
      await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })
    } else if (await activateBtn.isVisible()) {
      await activateBtn.click()
      await expect(page.getByText('Active').first()).toBeVisible({ timeout: 10000 })
    }
  })

  test('has create new pack link', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/packs')
    await expect(page.getByText('Manage Packs')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('a:has-text("Create New Pack")')).toBeVisible()
  })

  test('can open edit pack modal', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/packs')
    await expect(page.getByRole('heading', { name: 'Starter Pack' }).first()).toBeVisible({ timeout: 10000 })

    await page.locator('button:has-text("Edit")').first().click()
    await expect(page.getByText('Edit Pack')).toBeVisible({ timeout: 5000 })
    await test.info().attach('edit-pack-modal', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can cancel edit pack modal', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/packs')
    await expect(page.getByRole('heading', { name: 'Starter Pack' }).first()).toBeVisible({ timeout: 10000 })

    await page.locator('button:has-text("Edit")').first().click()
    await expect(page.getByText('Edit Pack')).toBeVisible({ timeout: 5000 })
    await page.click('button:has-text("Cancel")')
    await expect(page.getByText('Edit Pack')).not.toBeVisible()
  })

  test('create pack page loads', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/packs/create')
    await expect(page.getByPlaceholder('Pack name')).toBeVisible({ timeout: 10000 })
    await test.info().attach('create-pack-page', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
