import { test, expect, type Page } from '@playwright/test'
import { login, loginNewContext, cleanupArena, resetArenaEnabled, joinLobbyFromList } from '../helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

const DECK_CARDS = [
  'dddddddd-0001-0000-0000-000000000000',
  'dddddddd-0002-0000-0000-000000000000',
  'dddddddd-0003-0000-0000-000000000000',
  'dddddddd-0004-0000-0000-000000000000',
  'dddddddd-0005-0000-0000-000000000000',
]

type Player = { email: string; password: string; name: string; deckName: string }

const HOST: Player = { email: 'admin@test.com', password: 'password123', name: 'Test Admin', deckName: 'Admin Deck' }

const JOINERS: Player[] = [
  { email: 'player@test.com', password: 'password123', name: 'Test Player', deckName: 'Player Deck' },
  { email: 'p2@test.com', password: 'password123', name: 'Player 2', deckName: 'Battle Deck' },
  { email: 'p3@test.com', password: 'password123', name: 'Player 3', deckName: 'Battle Deck' },
  { email: 'p4@test.com', password: 'password123', name: 'Player 4', deckName: 'Battle Deck' },
  { email: 'p5@test.com', password: 'password123', name: 'Player 5', deckName: 'Battle Deck' },
  { email: 'p6@test.com', password: 'password123', name: 'Player 6', deckName: 'Battle Deck' },
  { email: 'p7@test.com', password: 'password123', name: 'Player 7', deckName: 'Battle Deck' },
]

async function getOrCreateUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${LOCAL_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const data = await res.json()
  if (data.id) return data.id

  const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers })
  const listData = await listRes.json()
  const user = listData.users?.find((u: any) => u.email === email)
  if (user?.id) return user.id
  throw new Error(`Failed to get or create user ${email}: ${JSON.stringify(data)}`)
}

async function setupPlayer(userId: string, name: string, deckName: string) {
  await fetch(`${LOCAL_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: userId, full_name: name, role: 'user', gruten: 5000 }),
  })

  await fetch(`${LOCAL_URL}/rest/v1/user_cards?user_id=eq.${userId}`, { method: 'DELETE', headers })
  await fetch(`${LOCAL_URL}/rest/v1/user_cards`, {
    method: 'POST',
    headers,
    body: JSON.stringify(DECK_CARDS.map(cardId => ({
      user_id: userId, card_id: cardId, count: 1, obtained_at: new Date().toISOString(),
    }))),
  })

  await fetch(`${LOCAL_URL}/rest/v1/decks?user_id=eq.${userId}&slot=eq.1`, { method: 'DELETE', headers })
  await fetch(`${LOCAL_URL}/rest/v1/decks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId, slot: 1, name: deckName, card_ids: DECK_CARDS }),
  })
}

// Each client records its view of every round to window.__arenaRounds (fast-mode only).
// Reading it at game-over lets us verify per-round consistency without observing the
// transient round-end screens — so the in-app round countdowns can be near-zero.
async function readRoundLog(p: Page): Promise<unknown[]> {
  return p.evaluate(() => (window as unknown as { __arenaRounds?: unknown[] }).__arenaRounds || [])
}

async function extractFinalRankings(page: Page) {
  const rows = page.locator('.mb-2.flex.items-center.justify-center.gap-3')
  const count = await rows.count()
  const rankings: { rank: string; name: string; hp: string }[] = []
  for (let i = 0; i < count; i++) {
    const spans = rows.nth(i).locator('span')
    rankings.push({
      rank: (await spans.nth(0).textContent() || '').trim(),
      name: (await spans.nth(1).textContent() || '').trim(),
      hp: (await spans.nth(2).textContent() || '').trim(),
    })
  }
  const winner = (await page.locator('h2:has-text("Wins!")').textContent() || '').trim()
  const rounds = (await page.locator('text=/Completed in/').textContent() || '').trim()
  return { winner, rounds, rankings }
}

test.describe('8-Player Full Arena Game', () => {
  test.beforeAll(async () => {
    for (const p of JOINERS.slice(1)) {
      const id = await getOrCreateUser(p.email, p.password)
      await setupPlayer(id, p.name, p.deckName)
    }
  })

  test.beforeEach(async () => {
    await resetArenaEnabled()
    await cleanupArena()
  })

  test.afterAll(async () => {
    await cleanupArena()
  })

  test('all 8 players see consistent round data — no desync', async ({ page, browser }) => {
    test.setTimeout(600000)

    // Run this game at the "instant" pace (~100ms round windows). full-game verifies
    // consistency from window.__arenaRounds at game-over, so it doesn't need observable
    // screens — unlike the interactive battle/skills specs, which stay at the normal fast pace.
    const setInstantPace = () => { try { localStorage.setItem('arena_pace', 'instant') } catch { /* ignore */ } }

    // === LOBBY SETUP ===
    await page.context().addInitScript(setInstantPace)
    await login(page, HOST)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    // Log all joiners in and join the lobby concurrently (was sequential — ~16s of UI logins)
    const contexts = await Promise.all(JOINERS.map(async (joiner) => {
      const ctx = await loginNewContext(browser, joiner)
      await ctx.context.addInitScript(setInstantPace)
      await joinLobbyFromList(ctx.page)
      return { ...ctx, info: joiner }
    }))

    await expect(page.getByText('Players (8/8)')).toBeVisible({ timeout: 30000 })
    await test.info().attach('lobby-8-players', { body: await page.screenshot(), contentType: 'image/png' })

    // === READY UP (concurrently) ===
    await Promise.all(contexts.map(async (ctx) => {
      await ctx.page.click(`button:has-text("${ctx.info.deckName}")`)
      await ctx.page.click('button:has-text("Ready Up")')
    }))
    await page.click('button:has-text("Admin Deck")')
    await expect(page.locator('button:has-text("Start Game"):not([disabled])')).toBeVisible({ timeout: 30000 })
    await test.info().attach('all-8-ready', { body: await page.screenshot(), contentType: 'image/png' })

    // === START GAME ===
    await page.click('button:has-text("Start Game")')
    await expect(page.locator('text=/Round 1|VS|Skills|Fight/i').first()).toBeVisible({ timeout: 30000 })

    // === PLAY TO COMPLETION ===
    // Rounds auto-advance (fast mode compresses the countdowns to ~100ms). Each client
    // records its view of every round to window.__arenaRounds, so we verify per-round
    // consistency by comparing those logs at game-over — no transient-screen scraping.
    await expect(page.getByText('Wins!')).toBeVisible({ timeout: 120000 })
    await Promise.all(contexts.map((c) => expect(c.page.getByText('Wins!')).toBeVisible({ timeout: 120000 })))

    // === ROUND-LOG CONSISTENCY (every round, every client) ===
    const hostLog = await readRoundLog(page)
    expect(hostLog.length, 'host recorded no rounds').toBeGreaterThan(0)
    const clientLogs = await Promise.all(contexts.map((c) => readRoundLog(c.page)))
    clientLogs.forEach((log, i) => {
      expect(log, `${contexts[i].info.name} has a different round log than host`).toEqual(hostLog)
    })

    // === FINAL GAME-OVER VERIFICATION ===
    await test.info().attach('final-host', { body: await page.screenshot(), contentType: 'image/png' })
    const hostResults = await extractFinalRankings(page)
    expect(hostResults.rankings).toHaveLength(8)

    await Promise.all(contexts.map((c, i) =>
      c.page.screenshot().then((body) => test.info().attach(`final-player-${i + 1}`, { body, contentType: 'image/png' }))
    ))
    const finalAll = await Promise.all(contexts.map((c) => extractFinalRankings(c.page)))
    finalAll.forEach((playerResults, i) => {
      expect(playerResults.winner, `Player ${i + 1} (${contexts[i].info.name}) sees different winner`).toBe(hostResults.winner)
      expect(playerResults.rounds, `Player ${i + 1} (${contexts[i].info.name}) sees different round count`).toBe(hostResults.rounds)
      expect(playerResults.rankings, `Player ${i + 1} (${contexts[i].info.name}) has different rankings`).toEqual(hostResults.rankings)
    })

    for (const ctx of contexts) {
      try { await ctx.context.close() } catch {}
    }
  })
})
