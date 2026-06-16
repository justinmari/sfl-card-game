import { test, expect, type Page } from '@playwright/test'
import { login, loginNewContext, TEST_ADMIN, TEST_PLAYER, cleanupArena, resetArenaEnabled } from '../helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

const CARD_IDS = {
  common1: 'dddddddd-0001-0000-0000-000000000000',
  common2: 'dddddddd-0002-0000-0000-000000000000',
  common3: 'dddddddd-0003-0000-0000-000000000000',
  uncommon1: 'dddddddd-0004-0000-0000-000000000000',
  uncommon2: 'dddddddd-0005-0000-0000-000000000000',
  rare1: 'dddddddd-0006-0000-0000-000000000000',
  rare2: 'dddddddd-0007-0000-0000-000000000000',
  ultra: 'dddddddd-0008-0000-0000-000000000000',
  legendary: 'dddddddd-0009-0000-0000-000000000000',
  secret: 'dddddddd-0010-0000-0000-000000000000',
}

const ALL_SKILLS = [
  { id: 'double-edge', name: 'Double Edge', description: 'All totals are doubled this round — for both players' },
  { id: 'snake-eyes', name: 'Snake Eyes', description: 'No dice rolls this round — base stars only, for both players' },
  { id: 'loaded-dice', name: 'Loaded Dice', description: 'All dice rolls get +2 — for both players' },
  { id: 'scramble', name: 'Scramble', description: 'All card rarities are randomized — for both players' },
  { id: 'beatdown', name: 'Beatdown', description: 'Losers take 3 damage no matter the total — for both players' },
  { id: 'heal-instead', name: 'Fountain of Youth', description: 'All players heal damage taken this round instead of losing HP' },
  { id: 'leveler', name: 'Leveler', description: 'All cards are treated as commons — pure dice rolls for both' },
  { id: 'underdog', name: 'Underdog', description: 'Lower rarity cards roll 0-10 no matter what — for both players' },
  { id: 'reverse-uno', name: 'Reverse Uno', description: 'Damage is dealt to the winner of each face-off instead' },
  { id: 'all-or-nothing', name: 'All or Nothing', description: 'All damage this round is doubled — for both players' },
  { id: 'final-form', name: 'Final Form', description: 'All common cards become secret rares this round — for both players' },
  { id: 'brown-tint', name: 'Muddy Waters', description: "Adds a brown tint to all players' cards this round" },
  { id: 'gift-exchange', name: 'Gift Exchange', description: 'All cards are shuffled together and randomly dealt into new decks for this round' },
]

// Admin Deck (cards 1-5) skill assignments
const ADMIN_SKILL_ASSIGNMENTS: Record<string, string[]> = {
  [CARD_IDS.common1]: ['double-edge'],
  [CARD_IDS.common2]: ['snake-eyes'],
  [CARD_IDS.common3]: ['loaded-dice'],
  [CARD_IDS.uncommon1]: ['scramble'],
  [CARD_IDS.uncommon2]: ['beatdown', 'heal-instead'],
}

// Player Deck (cards 6-10) skill assignments
const PLAYER_SKILL_ASSIGNMENTS: Record<string, string[]> = {
  [CARD_IDS.rare1]: ['leveler'],
  [CARD_IDS.rare2]: ['underdog'],
  [CARD_IDS.ultra]: ['reverse-uno', 'brown-tint'],
  [CARD_IDS.legendary]: ['all-or-nothing'],
  [CARD_IDS.secret]: ['final-form', 'gift-exchange'],
}

async function seedSkills() {
  await fetch(`${LOCAL_URL}/rest/v1/card_skills?id=not.is.null`, { method: 'DELETE', headers })
  await fetch(`${LOCAL_URL}/rest/v1/skills?id=not.is.null`, { method: 'DELETE', headers })

  await fetch(`${LOCAL_URL}/rest/v1/skills`, {
    method: 'POST', headers,
    body: JSON.stringify(ALL_SKILLS),
  })

  const assignments: { card_id: string; skill_id: string }[] = []
  for (const [cardId, skillIds] of Object.entries({ ...ADMIN_SKILL_ASSIGNMENTS, ...PLAYER_SKILL_ASSIGNMENTS })) {
    for (const skillId of skillIds) {
      assignments.push({ card_id: cardId, skill_id: skillId })
    }
  }
  await fetch(`${LOCAL_URL}/rest/v1/card_skills`, {
    method: 'POST', headers,
    body: JSON.stringify(assignments),
  })
}

async function startBattle(hostPage: Page, playerPage: Page) {
  await hostPage.goto('/arena')
  await hostPage.click('button:has-text("Create")')
  await hostPage.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

  await playerPage.goto('/arena')
  await playerPage.click('button:has-text("Join")', { timeout: 10000 })
  await playerPage.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })
  await expect(hostPage.getByText('Test Player')).toBeVisible({ timeout: 10000 })

  await playerPage.click('button:has-text("Player Deck")')
  await playerPage.click('button:has-text("Ready Up")')
  await hostPage.click('button:has-text("Admin Deck")')
  await expect(hostPage.locator('button:has-text("Start Game"):not([disabled])')).toBeVisible({ timeout: 10000 })
  await hostPage.click('button:has-text("Start Game")')
}

test.describe('Arena Skills E2E', () => {
  test.setTimeout(180000)

  test.beforeAll(async () => {
    await seedSkills()
  })

  test.beforeEach(async () => {
    await resetArenaEnabled()
    await cleanupArena()
  })

  test.afterAll(async () => {
    await cleanupArena()
    await fetch(`${LOCAL_URL}/rest/v1/card_skills?id=not.is.null`, { method: 'DELETE', headers })
    await fetch(`${LOCAL_URL}/rest/v1/skills?id=not.is.null`, { method: 'DELETE', headers })
  })

  test('admin sees all 6 skills from their deck in skill-select phase', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await test.info().attach('admin-skill-select', { body: await page.screenshot(), contentType: 'image/png' })

    for (const name of ['Double Edge', 'Snake Eyes', 'Loaded Dice', 'Scramble', 'Beatdown', 'Fountain of Youth']) {
      await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 5000 })
    }

    await player.context.close()
  })

  test('player sees all 7 skills from their deck in skill-select phase', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(player.page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await test.info().attach('player-skill-select', { body: await player.page.screenshot(), contentType: 'image/png' })

    for (const name of ['Leveler', 'Underdog', 'Reverse Uno', 'Muddy Waters', 'All or Nothing', 'Final Form', 'Gift Exchange']) {
      await expect(player.page.getByText(name, { exact: true })).toBeVisible({ timeout: 5000 })
    }

    await player.context.close()
  })

  test('skill shows description text', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('All totals are doubled this round')).toBeVisible()
    await expect(page.getByText('No dice rolls this round')).toBeVisible()

    await player.context.close()
  })

  test('clicking a skill toggles ACTIVE badge', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })

    await page.getByText('Double Edge', { exact: true }).click()
    await expect(page.getByText('ACTIVE')).toBeVisible()
    await expect(page.getByText('double-edge activated')).toBeVisible()
    await test.info().attach('skill-activated', { body: await page.screenshot(), contentType: 'image/png' })

    await page.getByText('Double Edge', { exact: true }).click()
    await expect(page.getByText('ACTIVE')).not.toBeVisible()

    await player.context.close()
  })

  test('multiple skills can be activated simultaneously', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })

    await page.getByText('Double Edge', { exact: true }).click()
    await page.getByText('Scramble', { exact: true }).click()

    await expect(page.getByText('ACTIVE')).toHaveCount(2)
    await test.info().attach('two-skills-active', { body: await page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })

  test('skill shows "1 use left" text', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('1 use left').first()).toBeVisible()
    await test.info().attach('uses-left', { body: await page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })

  test('used skill disappears from list in next round', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    // Round 1: activate Fountain of Youth (heal-instead) — prevents elimination, guarantees round 2
    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await page.getByText('Fountain of Youth', { exact: true }).click()
    await expect(page.getByText('ACTIVE')).toBeVisible()
    await test.info().attach('round1-heal-active', { body: await page.screenshot(), contentType: 'image/png' })

    // Wait for round to complete
    await expect(page.getByText('Round 1 Complete')).toBeVisible({ timeout: 60000 })
    await test.info().attach('round1-complete', { body: await page.screenshot(), contentType: 'image/png' })

    // Wait for round 2 skill-select
    await expect(page.getByText('Round 2').first()).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 10000 })
    await test.info().attach('round2-skill-select', { body: await page.screenshot(), contentType: 'image/png' })

    // Fountain of Youth used up — should not appear; other admin skills should still be there
    await expect(page.getByText('Fountain of Youth', { exact: true })).not.toBeVisible()
    await expect(page.getByText('Double Edge', { exact: true })).toBeVisible()

    await player.context.close()
  })

  test('battle completes with faceoff skill active (double-edge)', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await page.getByText('Double Edge', { exact: true }).click()

    await expect(page.getByText(/Round 1 Complete|Wins!/)).toBeVisible({ timeout: 60000 })
    await test.info().attach('round-with-double-edge', { body: await page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })

  test('battle completes with dice-override skill active (snake-eyes)', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await page.getByText('Snake Eyes', { exact: true }).click()

    await expect(page.getByText(/Round 1 Complete|Wins!/)).toBeVisible({ timeout: 60000 })
    await test.info().attach('round-with-snake-eyes', { body: await page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })

  test('battle completes with round-level skill active (heal-instead)', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await page.getByText('Fountain of Youth', { exact: true }).click()

    await expect(page.getByText(/Round 1 Complete|Wins!/)).toBeVisible({ timeout: 60000 })
    await test.info().attach('round-with-heal', { body: await page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })

  test('battle completes with player activating gift-exchange', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(player.page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await player.page.getByText('Gift Exchange', { exact: true }).click()
    await expect(player.page.getByText('ACTIVE')).toBeVisible()

    await expect(player.page.getByText(/Round 1 Complete|Wins!/)).toBeVisible({ timeout: 60000 })
    await test.info().attach('round-with-gift-exchange', { body: await player.page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })

  test('both players activate skills simultaneously', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await page.getByText('Beatdown', { exact: true }).click()

    await expect(player.page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await player.page.getByText('Reverse Uno', { exact: true }).click()

    await expect(page.getByText(/Round 1 Complete|Wins!/)).toBeVisible({ timeout: 60000 })
    await expect(player.page.getByText(/Round 1 Complete|Wins!/)).toBeVisible({ timeout: 30000 })
    await test.info().attach('both-skills-host', { body: await page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })

  test('all 13 skills appear correctly across both players', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await expect(player.page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })

    for (const name of ['Double Edge', 'Snake Eyes', 'Loaded Dice', 'Scramble', 'Beatdown', 'Fountain of Youth']) {
      await expect(page.getByText(name, { exact: true }), `Admin should see ${name}`).toBeVisible()
    }

    for (const name of ['Leveler', 'Underdog', 'Reverse Uno', 'Muddy Waters', 'All or Nothing', 'Final Form', 'Gift Exchange']) {
      await expect(player.page.getByText(name, { exact: true }), `Player should see ${name}`).toBeVisible()
    }

    await test.info().attach('all-13-admin', { body: await page.screenshot(), contentType: 'image/png' })
    await test.info().attach('all-13-player', { body: await player.page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })

  // --- Skill-effect rendering during the battle (animation trace) ---

  test('total-manipulation (Double Edge) renders a labeled effect on the face-off', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await page.getByText('Double Edge', { exact: true }).click()
    // Also heal-instead so nobody is eliminated early — guarantees all 5 face-offs
    // run, so the (brief, per-face-off) total chip reliably appears.
    await page.getByText('Fountain of Youth', { exact: true }).click()

    // During the face-off, a 'total' effect chip labeled with the skill appears.
    const effect = page.locator('[data-testid="skill-effect"][data-kind="total"]').first()
    await expect(effect).toBeVisible({ timeout: 30000 })
    await expect(effect).toHaveAttribute('data-skill', 'Double Edge')
    await test.info().attach('effect-total', { body: await page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })

  test('rarity-change (Final Form) renders a rarity effect on common cards', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    // Player activates Final Form (commons -> secret rares); admin holds commons.
    await expect(player.page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await player.page.getByText('Final Form', { exact: true }).click()

    await expect(page.locator('[data-testid="skill-effect"][data-kind="rarity"]').first()).toBeVisible({ timeout: 30000 })
    await test.info().attach('effect-rarity', { body: await page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })

  test('deck-manipulation (Gift Exchange) renders the pre-round deck transform', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(player.page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await player.page.getByText('Gift Exchange', { exact: true }).click()

    await expect(player.page.getByTestId('deck-transform')).toBeVisible({ timeout: 30000 })
    await test.info().attach('effect-deck-transform', { body: await player.page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })

  test('dice-manipulation (Loaded Dice) renders a dice effect', async ({ page, browser }) => {
    await login(page, TEST_ADMIN)
    const player = await loginNewContext(browser, TEST_PLAYER)
    await startBattle(page, player.page)

    await expect(page.getByText('Skills').first()).toBeVisible({ timeout: 30000 })
    await page.getByText('Loaded Dice', { exact: true }).click()
    await page.getByText('Fountain of Youth', { exact: true }).click()

    await expect(page.locator('[data-testid="skill-effect"][data-kind="dice"]').first()).toBeVisible({ timeout: 30000 })
    await test.info().attach('effect-dice', { body: await page.screenshot(), contentType: 'image/png' })

    await player.context.close()
  })
})
