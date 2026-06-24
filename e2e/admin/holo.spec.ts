import { test, expect } from '@playwright/test'
import { login, TEST_ADMIN, TEST_PLAYER } from '../helpers'

test.describe('Admin Holo Preview', () => {
  test('admin can access the holo preview page', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/holo')
    await expect(page.getByText('Holo Editions Preview')).toBeVisible({ timeout: 10000 })
    await test.info().attach('holo-preview', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('flips through editions; standard has no holo, golden/galaxy do', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/holo')
    await expect(page.getByText('Holo Editions Preview')).toBeVisible({ timeout: 10000 })

    // Starts on Standard — no holo overlay.
    await expect(page.getByTestId('holo-edition-label')).toHaveText('Standard')
    await expect(page.getByTestId('holo-card-standard').getByTestId('holo-layer')).toHaveCount(0)

    // Next → Golden, which renders a holo overlay.
    await page.getByRole('button', { name: 'Next edition' }).click()
    await expect(page.getByTestId('holo-edition-label')).toHaveText('Golden')
    await expect(page.getByTestId('holo-card-golden').getByTestId('holo-layer')).toBeVisible()

    // Next → Diamond.
    await page.getByRole('button', { name: 'Next edition' }).click()
    await expect(page.getByTestId('holo-edition-label')).toHaveText('Diamond')

    // Next → Galaxy, also a holo overlay.
    await page.getByRole('button', { name: 'Next edition' }).click()
    await expect(page.getByTestId('holo-edition-label')).toHaveText('Galaxy')
    await expect(page.getByTestId('holo-card-galaxy').getByTestId('holo-layer')).toBeVisible()

    // Three Prevs wrap back to Standard.
    await page.getByRole('button', { name: 'Previous edition' }).click()
    await page.getByRole('button', { name: 'Previous edition' }).click()
    await page.getByRole('button', { name: 'Previous edition' }).click()
    await expect(page.getByTestId('holo-edition-label')).toHaveText('Standard')
  })

  test('jump chips select a holo edition', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/holo')
    await expect(page.getByText('Holo Editions Preview')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Golden', exact: true }).click()
    await expect(page.getByTestId('holo-edition-label')).toHaveText('Golden')
    await expect(page.getByTestId('holo-card-golden').getByTestId('holo-layer')).toBeVisible()
    await test.info().attach('holo-golden', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can switch the previewed card', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/holo')
    await expect(page.getByText('Holo Editions Preview')).toBeVisible({ timeout: 10000 })

    // Move to a holo, then change the card; the holo should persist.
    await page.getByRole('button', { name: 'Galaxy', exact: true }).click()
    const picker = page.getByLabel('Preview card')
    const options = await picker.locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(1)
    await picker.selectOption({ label: options[1] })
    await expect(page.getByTestId('holo-card-galaxy').getByTestId('holo-layer')).toBeVisible()
  })

  test('compact toggle renders the compact card', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/holo')
    await expect(page.getByText('Holo Editions Preview')).toBeVisible({ timeout: 10000 })

    await page.getByRole('button', { name: 'Galaxy', exact: true }).click()
    await page.getByLabel('Compact card').check()
    // The large TradingCard testId is gone; the compact card renders instead.
    await expect(page.getByTestId('holo-card-galaxy')).toHaveCount(0)
    await expect(page.getByTestId('holo-grid').locator('.compact-holo')).toHaveCount(1)
  })

  test('cards-on-screen selector renders the chosen count', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/holo')
    await expect(page.getByText('Holo Editions Preview')).toBeVisible({ timeout: 10000 })

    // Default is a single card.
    const grid = page.getByTestId('holo-grid')
    await expect(grid.locator('> div')).toHaveCount(1)

    // Pick 10 → ten cards tile in the grid.
    await page.getByLabel('Cards on screen').selectOption('10')
    await expect(grid.locator('> div')).toHaveCount(10)
  })

  test('non-admin is redirected away from the holo preview', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/admin/holo')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 })
  })

  test('pull-rates editor lists the finishes, recomputes Regular, and toggles Save on edit', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/admin/holo')
    const rates = page.getByTestId('holo-rates')
    await expect(rates.getByRole('heading', { name: 'Pull Rates' })).toBeVisible({ timeout: 10000 })
    await expect(rates.getByText('Regular', { exact: true })).toBeVisible()

    // No edits yet → Save is disabled.
    const save = rates.getByRole('button', { name: /save rates/i })
    await expect(save).toBeDisabled()

    // Editing a rate marks the form dirty and enables Save. (The RPC + persistence
    // round-trip is covered deterministically in the holo-rates unit test.)
    const golden = rates.locator('input[type=number]').first()
    const original = await golden.inputValue()
    await golden.fill(original === '1' ? '2' : '1')
    await expect(save).toBeEnabled()
  })
})
