import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from '../helpers'

test.describe('Admin Holo Preview', () => {
  test('admin can access the holo preview page', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/holo')
    await expect(page.getByText('Holo Editions Preview')).toBeVisible({ timeout: 10000 })
    await test.info().attach('holo-preview', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('flips through editions; standard has no finish, others do', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/holo')
    await expect(page.getByText('Holo Editions Preview')).toBeVisible({ timeout: 10000 })

    // Starts on Standard — no holo overlay.
    await expect(page.getByTestId('holo-edition-label')).toHaveText('Standard')
    await expect(page.getByTestId('holo-card-standard').getByTestId('holo-layer')).toHaveCount(0)

    // Next → Foil, which renders a holo overlay.
    await page.getByRole('button', { name: 'Next edition' }).click()
    await expect(page.getByTestId('holo-edition-label')).toHaveText('Foil')
    const foilLayer = page.getByTestId('holo-card-foil').getByTestId('holo-layer')
    await expect(foilLayer).toBeVisible()
    await expect(foilLayer).toHaveAttribute('data-edition', 'foil')

    // Prev wraps back to Standard.
    await page.getByRole('button', { name: 'Previous edition' }).click()
    await expect(page.getByTestId('holo-edition-label')).toHaveText('Standard')
  })

  test('jump chips select a specific edition', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/holo')
    await expect(page.getByText('Holo Editions Preview')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Diamond', exact: true }).click()
    await expect(page.getByTestId('holo-edition-label')).toHaveText('Diamond')
    const layer = page.getByTestId('holo-card-diamond').getByTestId('holo-layer')
    await expect(layer).toBeVisible()
    await expect(layer).toHaveAttribute('data-edition', 'diamond')
    await test.info().attach('holo-diamond', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can switch the previewed card', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/holo')
    await expect(page.getByText('Holo Editions Preview')).toBeVisible({ timeout: 10000 })

    // Move to a finish, then change the card; the finish should persist.
    await page.getByRole('button', { name: 'Polychrome', exact: true }).click()
    const picker = page.getByLabel('Preview card')
    const options = await picker.locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(1)
    await picker.selectOption({ label: options[1] })
    await expect(page.getByTestId('holo-card-polychrome').getByTestId('holo-layer')).toBeVisible()
  })

  test('non-admin is redirected away from the holo preview', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/admin/holo')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })
})
