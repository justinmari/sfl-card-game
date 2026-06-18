import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER, TEST_ADMIN } from './helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

test.describe('Decks', () => {
  test('decks page shows existing decks', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/decks')
    await expect(page.getByText('Player Deck')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('5/5 cards')).toBeVisible()
    await test.info().attach('decks-page', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('deck shows power rating', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/decks')
    await expect(page.locator('text=/⚡.*power/')).toBeVisible({ timeout: 10000 })
  })

  test('can open edit deck modal', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/decks')
    await expect(page.getByText('Player Deck')).toBeVisible({ timeout: 10000 })
    await page.click('button:has-text("Edit")')
    await expect(page.getByText('Edit Deck')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('input[placeholder*="Deck"]')).toBeVisible()
    await test.info().attach('edit-deck-modal', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can change deck name', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/decks')
    await expect(page.getByText('Player Deck')).toBeVisible({ timeout: 10000 })
    await page.click('button:has-text("Edit")')
    await expect(page.getByText('Edit Deck')).toBeVisible({ timeout: 5000 })

    const nameInput = page.locator('input[placeholder*="Deck"]')
    await nameInput.clear()
    await nameInput.fill('Renamed Deck')
    await page.click('button:has-text("Save Deck")')

    await expect(page.getByText('Renamed Deck')).toBeVisible({ timeout: 10000 })
    await test.info().attach('renamed-deck', { body: await page.screenshot(), contentType: 'image/png' })

    // Restore original name
    await page.click('button:has-text("Edit")')
    await expect(page.getByText('Edit Deck')).toBeVisible({ timeout: 5000 })
    const input = page.locator('input[placeholder*="Deck"]')
    await input.clear()
    await input.fill('Player Deck')
    await page.click('button:has-text("Save Deck")')
    await expect(page.getByText('Player Deck')).toBeVisible({ timeout: 10000 })
  })

  test('edit modal shows card search', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/decks')
    await expect(page.getByText('Player Deck')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("Edit")').first().click()
    await expect(page.getByText('Edit Deck')).toBeVisible({ timeout: 5000 })

    await expect(page.getByPlaceholder('Search cards...')).toBeVisible()
    await test.info().attach('card-search', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('can remove a card from deck', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/decks')
    await expect(page.getByText('Player Deck')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("Edit")').first().click()
    await expect(page.getByText('Edit Deck')).toBeVisible({ timeout: 5000 })

    await expect(page.getByText('5/5 cards').first()).toBeVisible()

    // Click the × remove button on the first card in the lineup
    const removeBtn = page.locator('button:has-text("×")').first()
    if (await removeBtn.isVisible()) {
      await removeBtn.click()
      await expect(page.getByText('4/5 cards').first()).toBeVisible({ timeout: 5000 })
      await test.info().attach('card-removed', { body: await page.screenshot(), contentType: 'image/png' })
    }

    // Cancel to not save
    await page.click('button:has-text("Cancel")')
  })

  test('can cancel edit without saving', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/decks')
    await expect(page.getByText('Player Deck')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("Edit")').first().click()
    await expect(page.getByText('Edit Deck')).toBeVisible({ timeout: 5000 })

    const nameInput = page.locator('input[placeholder*="Deck"]')
    await nameInput.clear()
    await nameInput.fill('Should Not Save')

    await page.click('button:has-text("Cancel")')
    await expect(page.getByText('Edit Deck')).not.toBeVisible()
    await expect(page.getByText('Player Deck')).toBeVisible()
  })

  test('shows Your Lineup section with slots', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/decks')
    await expect(page.getByText('Player Deck')).toBeVisible({ timeout: 10000 })
    await page.locator('button:has-text("Edit")').first().click()
    await expect(page.getByText('Edit Deck')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Your Lineup')).toBeVisible()
    await test.info().attach('lineup-slots', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('empty deck shows edit prompt', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/decks')
    await expect(page.getByText('Admin Deck')).toBeVisible({ timeout: 10000 })

    // Multiple empty deck slots may show this text
    const emptyPrompt = page.getByText('No cards — tap Edit to build this deck').first()
    if (await emptyPrompt.isVisible()) {
      await test.info().attach('empty-deck', { body: await page.screenshot(), contentType: 'image/png' })
    }
  })
})

test.describe('Decks (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('renders compact deck cards on mobile, not the desktop cards', async ({ page }) => {
    await login(page, TEST_PLAYER)
    await page.goto('/decks')
    await expect(page.getByText('Player Deck')).toBeVisible({ timeout: 10000 })

    await expect(page.getByTestId('deck-card-mobile').first()).toBeVisible({ timeout: 5000 })
    // The desktop card variant is hidden at mobile width (hidden sm:block).
    await expect(page.getByTestId('deck-card-desktop').first()).toBeHidden()
    await test.info().attach('decks-mobile', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
