import { test, expect } from '@playwright/test'
import { login, loginNewContext, TEST_ADMIN, TEST_PLAYER, cleanupArena, resetArenaEnabled, joinLobbyFromList } from '../helpers'

test.describe('Arena Lobby', () => {
  test.beforeEach(async () => {
    await resetArenaEnabled()
    await cleanupArena()
  })

  test.afterAll(async () => {
    await cleanupArena()
  })

  test('arena page shows lobby list when user has a legal deck', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await expect(page.getByText('Create or join a lobby to battle')).toBeVisible()
    await expect(page.getByPlaceholder(/Lobby/)).toBeVisible()
  })

  test('create lobby and appear in lobby room', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })
    await expect(page.getByText('Test Admin')).toBeVisible()
  })

  test('create lobby with custom name', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.fill('input[placeholder*="obby"]', 'My Battle Room')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })
    await expect(page.getByText('My Battle Room')).toBeVisible()
  })

  test('second player can join lobby', async ({ page, browser }) => {
    // Admin creates lobby
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    // Player joins via lobby list
    const player = await loginNewContext(browser, TEST_PLAYER)
    await joinLobbyFromList(player.page)
    await expect(player.page.getByText('Test Player')).toBeVisible()

    // Admin sees player joined via Realtime
    await expect(page.getByText('Test Player')).toBeVisible({ timeout: 10000 })

    await player.context.close()
  })

  test('player can select a deck', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    // Click on the deck to select it — button exposes aria-pressed=true when selected
    await page.click('button:has-text("Admin Deck")')
    const deckBtn = page.locator('button:has-text("Admin Deck")')
    await expect(deckBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('player can ready up after selecting deck', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    // Player joins via lobby list
    const player = await loginNewContext(browser, TEST_PLAYER)
    await joinLobbyFromList(player.page)

    // Player selects deck and readies up
    await player.page.click('button:has-text("Player Deck")')
    await player.page.click('button:has-text("Ready Up")')

    // Admin sees player ready
    await expect(page.getByText('Ready').first()).toBeVisible({ timeout: 10000 })

    await player.context.close()
  })

  test('player can cancel ready', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    const player = await loginNewContext(browser, TEST_PLAYER)
    await joinLobbyFromList(player.page)
    await player.page.click('button:has-text("Player Deck")')
    await player.page.click('button:has-text("Ready Up")')
    await expect(player.page.getByText('Cancel Ready')).toBeVisible()

    await player.page.click('button:has-text("Cancel Ready")')
    await expect(player.page.getByText('Ready Up')).toBeVisible()

    await player.context.close()
  })

  test('host sees start game button when player is ready', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    const player = await loginNewContext(browser, TEST_PLAYER)
    await joinLobbyFromList(player.page)
    await player.page.click('button:has-text("Player Deck")')
    await player.page.click('button:has-text("Ready Up")')

    // Host selects deck — start game button should become enabled
    await page.click('button:has-text("Admin Deck")')
    await expect(page.locator('button:has-text("Start Game"):not([disabled])')).toBeVisible({ timeout: 10000 })

    await player.context.close()
  })

  test('host can kick a player', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    const player = await loginNewContext(browser, TEST_PLAYER)
    await joinLobbyFromList(player.page)
    await expect(page.getByText('Test Player')).toBeVisible({ timeout: 10000 })

    // Host kicks player
    await page.click('button:has-text("Kick")')

    // Player is redirected to arena page
    await player.page.waitForURL(/\/arena$/, { timeout: 10000 })

    await player.context.close()
  })

  test('player can leave lobby', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    const player = await loginNewContext(browser, TEST_PLAYER)
    await joinLobbyFromList(player.page)
    await expect(page.getByText('Test Player')).toBeVisible({ timeout: 10000 })

    // Player leaves
    await player.page.click('button:has-text("Leave Lobby")')
    await player.page.waitForURL(/\/arena$/, { timeout: 10000 })

    await player.context.close()
  })

  test('host can close lobby', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    await page.click('button:has-text("Close Lobby")')
    await page.waitForURL(/\/arena$/, { timeout: 10000 })
  })

  test('lobby appears in lobby list for other players', async ({ page, browser }) => {
    // Admin creates lobby
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.fill('input[placeholder*="obby"]', 'Visible Lobby')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    // Player sees lobby in list
    const player = await loginNewContext(browser, TEST_PLAYER)
    await player.page.goto('/arena')
    await expect(player.page.getByText('Visible Lobby')).toBeVisible({ timeout: 5000 })
    await expect(player.page.getByRole('button', { name: 'Join' })).toBeVisible()

    await player.context.close()
  })

  test('player can join from lobby list', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    const player = await loginNewContext(browser, TEST_PLAYER)
    await player.page.goto('/arena')
    await player.page.click('button:has-text("Join")')
    await player.page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })
    await expect(player.page.getByText('Test Admin')).toBeVisible()

    await player.context.close()
  })
})
