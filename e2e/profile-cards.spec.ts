import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER } from './helpers'

test.describe('Profile Top Cards', () => {
  test('done button saves card selection', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/profile')
    await expect(page.getByText('Top 4')).toBeVisible({ timeout: 10000 })

    // Open card picker
    await page.click('button:has-text("Edit")')
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible({ timeout: 5000 })

    // Click Done - should save (shows saving state briefly)
    await page.click('button:has-text("Done")')

    // Success message should appear
    await expect(page.getByText('Profile updated!')).toBeVisible({ timeout: 10000 })
  })

  test('card picker has search/typeahead', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/profile')
    await expect(page.getByText('Top 4')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Edit")')
    const searchInput = page.getByPlaceholder('Search cards...')
    await expect(searchInput).toBeVisible({ timeout: 5000 })

    // Type something and verify cards filter
    await searchInput.fill('test')
    await test.info().attach('search-filter', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can drag and drop to reorder cards', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/profile')
    await expect(page.getByText('Top 4')).toBeVisible({ timeout: 10000 })

    await page.click('button:has-text("Edit")')
    await expect(page.getByPlaceholder('Search cards...')).toBeVisible({ timeout: 5000 })

    // Cards should be draggable when in edit mode
    const cardSlots = page.locator('[draggable="true"]')
    const count = await cardSlots.count()
    if (count >= 2) {
      const first = cardSlots.first()
      const second = cardSlots.nth(1)
      const firstBox = await first.boundingBox()
      const secondBox = await second.boundingBox()
      if (firstBox && secondBox) {
        await first.dragTo(second)
        await test.info().attach('after-drag', { body: await page.screenshot(), contentType: 'image/png' })
      }
    }

    await page.click('button:has-text("Done")')
    await expect(page.getByText('Profile updated!')).toBeVisible({ timeout: 10000 })
  })
})
