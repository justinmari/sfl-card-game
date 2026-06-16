import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { login, loginNewContext, TEST_ADMIN, TEST_PLAYER, cleanupArena, resetArenaEnabled, setArenaDisabled, joinLobbyFromList } from '../helpers'

async function createLobbyAndJoin(
  hostPage: Page,
  browser: any,
): Promise<{ playerPage: Page; playerContext: BrowserContext; lobbyUrl: string }> {
  await hostPage.goto('/arena')
  await hostPage.click('button:has-text("Create")')
  await hostPage.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })
  const lobbyUrl = hostPage.url()

  const player = await loginNewContext(browser, TEST_PLAYER)
  await joinLobbyFromList(player.page)
  await expect(hostPage.getByText('Test Player')).toBeVisible({ timeout: 10000 })

  return { playerPage: player.page, playerContext: player.context, lobbyUrl }
}

async function readyBothPlayers(hostPage: Page, playerPage: Page) {
  await playerPage.click('button:has-text("Player Deck")')
  await playerPage.click('button:has-text("Ready Up")')
  await expect(playerPage.getByText('Cancel Ready')).toBeVisible()

  await hostPage.click('button:has-text("Admin Deck")')

  await expect(hostPage.locator('button:has-text("Start Game"):not([disabled])')).toBeVisible({ timeout: 5000 })
}

test.describe('Arena Battle', () => {
  test.beforeEach(async () => {
    await resetArenaEnabled()
    await cleanupArena()
  })

  test.afterAll(async () => {
    await cleanupArena()
  })

  test('host can start game when all ready', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const { playerPage, playerContext } = await createLobbyAndJoin(page, browser)
    await readyBothPlayers(page, playerPage)

    await test.info().attach('lobby-host-ready', { body: await page.screenshot(), contentType: 'image/png' })
    await test.info().attach('lobby-player-ready', { body: await playerPage.screenshot(), contentType: 'image/png' })

    await page.click('button:has-text("Start Game")')

    await expect(page.getByTestId('starting-overlay')).toBeVisible({ timeout: 5000 })
    await test.info().attach('starting-overlay', { body: await page.screenshot(), contentType: 'image/png' })

    await playerContext.close()
  })

  test('cannot start game without 2 players', async ({ page }) => {
    await login(page, TEST_ADMIN)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    await page.click('button:has-text("Admin Deck")')

    await expect(page.getByText('Need 2+ players')).toBeVisible()
    await test.info().attach('need-2-players', { body: await page.screenshot(), contentType: 'image/png' })
  })

  test('cannot start game without selecting deck', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const { playerPage, playerContext } = await createLobbyAndJoin(page, browser)

    await playerPage.click('button:has-text("Player Deck")')
    await playerPage.click('button:has-text("Ready Up")')

    await expect(page.getByText('Select a deck first')).toBeVisible()
    await test.info().attach('select-deck-first', { body: await page.screenshot(), contentType: 'image/png' })

    await playerContext.close()
  })

  test('battle progresses through round phases', async ({ page, browser }) => {
    test.setTimeout(120000)
    await login(page, TEST_ADMIN)
    const { playerPage, playerContext } = await createLobbyAndJoin(page, browser)
    await readyBothPlayers(page, playerPage)

    await page.click('button:has-text("Start Game")')

    await expect(page.locator('text=/Round 1|VS|Skills|Fight/i').first()).toBeVisible({ timeout: 15000 })
    await test.info().attach('battle-round-start-host', { body: await page.screenshot(), contentType: 'image/png' })
    await test.info().attach('battle-round-start-player', { body: await playerPage.screenshot(), contentType: 'image/png' })

    await expect(page.locator('text=/HP|❤️|Test Admin|Test Player/').first()).toBeVisible({ timeout: 20000 })
    await test.info().attach('battle-scoreboard-host', { body: await page.screenshot(), contentType: 'image/png' })
    await test.info().attach('battle-scoreboard-player', { body: await playerPage.screenshot(), contentType: 'image/png' })

    await playerContext.close()
  })

  test('both players see the same round result', async ({ page, browser }) => {
    test.setTimeout(120000)
    await login(page, TEST_ADMIN)
    const { playerPage, playerContext } = await createLobbyAndJoin(page, browser)
    await readyBothPlayers(page, playerPage)

    await page.click('button:has-text("Start Game")')

    await expect(page.locator('text=/Round 1 Summary|dealt|damage/i').first()).toBeVisible({ timeout: 60000 })
    await test.info().attach('round-result-host', { body: await page.screenshot(), contentType: 'image/png' })

    await expect(playerPage.locator('text=/Round 1 Summary|dealt|damage/i').first()).toBeVisible({ timeout: 10000 })
    await test.info().attach('round-result-player', { body: await playerPage.screenshot(), contentType: 'image/png' })

    await playerContext.close()
  })

  test('game ends when a player is eliminated', async ({ page, browser }) => {
    test.setTimeout(300000)
    await login(page, TEST_ADMIN)
    const { playerPage, playerContext } = await createLobbyAndJoin(page, browser)
    await readyBothPlayers(page, playerPage)

    await page.click('button:has-text("Start Game")')

    await expect(page.locator('text=/Winner|#1|Final|Back/i').first()).toBeVisible({ timeout: 300000 })
    await test.info().attach('game-over-host', { body: await page.screenshot(), contentType: 'image/png' })
    await test.info().attach('game-over-player', { body: await playerPage.screenshot(), contentType: 'image/png' })

    await playerContext.close()
  })

  test('arena disabled mid-game redirects players', async ({ page, browser }) => {
    test.setTimeout(60000)
    await login(page, TEST_ADMIN)
    const { playerPage, playerContext } = await createLobbyAndJoin(page, browser)
    await readyBothPlayers(page, playerPage)

    await page.click('button:has-text("Start Game")')

    await expect(page.locator('text=/Round|VS|Skills/i').first()).toBeVisible({ timeout: 15000 })
    await test.info().attach('battle-in-progress', { body: await page.screenshot(), contentType: 'image/png' })

    await setArenaDisabled()

    await playerPage.waitForURL(/\/dashboard/, { timeout: 15000 })
    await test.info().attach('player-redirected', { body: await playerPage.screenshot(), contentType: 'image/png' })

    await playerContext.close()
    await resetArenaEnabled()
  })

  test('player can leave during battle', async ({ page, browser }) => {
    test.setTimeout(60000)
    await login(page, TEST_ADMIN)
    const { playerPage, playerContext } = await createLobbyAndJoin(page, browser)
    await readyBothPlayers(page, playerPage)

    await page.click('button:has-text("Start Game")')

    await expect(playerPage.locator('text=/Round|VS|Skills/i').first()).toBeVisible({ timeout: 15000 })
    await test.info().attach('battle-before-leave', { body: await playerPage.screenshot(), contentType: 'image/png' })

    await playerContext.close()

    await expect(page.locator('text=/Round|VS|Skills|HP/i').first()).toBeVisible()
    await test.info().attach('host-after-player-left', { body: await page.screenshot(), contentType: 'image/png' })
  })
})
