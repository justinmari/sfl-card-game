import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER, setHoloRates, resetHoloRates } from './helpers'

// Rate → pull → collection display path: pull a holo, then confirm it surfaces
// on the collection tile (finish + count badge), the finishes filter appears,
// and the detail modal opens on that finish.
test.describe('Holo collection display', () => {
  test.afterEach(async () => {
    await resetHoloRates()
  })

  test('a pulled holo shows its finish on the collection tile, with a finishes filter and modal', async ({ page }) => {
    test.setTimeout(60000)
    await setHoloRates(0, 0, 100) // every pulled card is galaxy

    await login(page, TEST_PLAYER)
    await page.goto('/shop')
    await page.getByText('Starter Pack').click()
    await page.click('button:has-text("Buy 1 pack")')
    await expect(page.getByText(/Swipe to open|Last card!/).first()).toBeVisible({ timeout: 15000 })

    await page.goto('/collection')
    await expect(page.getByTestId('collection-card-desktop').first()).toBeVisible({ timeout: 10000 })

    // Owning a holo surfaces the finishes filter...
    await expect(page.getByLabel('Filter by holo')).toBeVisible()
    // ...and a tile renders the holo overlay (default pref = show rarest finish).
    await expect(page.locator('[data-testid="holo-layer"]:visible').first()).toBeVisible({ timeout: 10000 })

    // The detail modal opens (on the shown finish) and reports an owned count.
    await page.getByTestId('collection-card-desktop').first().click()
    await expect(page.getByText(/Owned: x\d+/)).toBeVisible({ timeout: 5000 })
  })
})
