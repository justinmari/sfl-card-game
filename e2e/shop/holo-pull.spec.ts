import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER, setHoloRates, resetHoloRates } from '../helpers'

// End-to-end proof of the rate → pull → render path through the browser:
// force a finish to 100%, open a pack, and confirm the revealed card actually
// renders its holo overlay. (Rate logic itself is covered in the holo-rates
// integration test; this guards the UI wiring.)
test.describe('Holo pull', () => {
  test.afterEach(async () => {
    await resetHoloRates()
  })

  test('a forced galaxy pull renders the holo foil in the reveal', async ({ page }) => {
    test.setTimeout(60000)
    await setHoloRates(0, 0, 100) // every pulled card is galaxy

    await login(page, TEST_PLAYER)
    await page.goto('/shop')
    await page.getByText('Starter Pack').click()
    await page.click('button:has-text("Buy 1 pack")')

    // Pack rises; open it to reveal the first card.
    await expect(page.getByText(/Swipe to open|Last card!/).first()).toBeVisible({ timeout: 15000 })
    const next = page.locator('button[aria-label="Next"]')
    if (await next.isVisible().catch(() => false)) await next.click()

    // The revealed card renders a holo overlay layer. Scope to :visible to skip
    // the invisible height-sizing card FlippableCard also renders.
    await expect(page.locator('[data-testid="holo-layer"]:visible').first()).toBeVisible({ timeout: 10000 })
    await test.info().attach('holo-pull', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
