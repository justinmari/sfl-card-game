import { test, expect, type Page, type BrowserContext } from '@playwright/test'
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

async function extractScoreboard(page: Page): Promise<{ name: string; hp: string }[]> {
  return page.evaluate(() => {
    const roundHeaders = document.querySelectorAll('h3')
    for (const h of roundHeaders) {
      if (!h.textContent?.startsWith('Round')) continue
      const container = h.closest('.mb-6')
      if (!container) continue
      const grid = container.querySelector('.grid')
      if (!grid) continue

      return Array.from(grid.children)
        .map(cell => {
          const name = cell.querySelector('p')?.textContent?.trim() || ''
          const spans = Array.from(cell.querySelectorAll('span'))
          const hpSpan = spans.find(s =>
            s.classList.contains('font-bold') && /^\d+$/.test(s.textContent?.trim() || '')
          )
          return { name, hp: hpSpan?.textContent?.trim() || '' }
        })
        .filter(e => e.name && e.hp)
        .sort((a, b) => a.name.localeCompare(b.name))
    }
    return []
  })
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

    // === LOBBY SETUP ===
    await login(page, HOST)
    await page.goto('/arena')
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })

    const contexts: { page: Page; context: BrowserContext; info: Player }[] = []
    for (const joiner of JOINERS) {
      const ctx = await loginNewContext(browser, joiner)
      await joinLobbyFromList(ctx.page)
      contexts.push({ ...ctx, info: joiner })
    }

    await expect(page.getByText('Players (8/8)')).toBeVisible({ timeout: 30000 })
    await test.info().attach('lobby-8-players', { body: await page.screenshot(), contentType: 'image/png' })

    // === READY UP ===
    for (const ctx of contexts) {
      await ctx.page.click(`button:has-text("${ctx.info.deckName}")`)
      await ctx.page.click('button:has-text("Ready Up")')
    }
    await page.click('button:has-text("Admin Deck")')
    await expect(page.locator('button:has-text("Start Game"):not([disabled])')).toBeVisible({ timeout: 30000 })
    await test.info().attach('all-8-ready', { body: await page.screenshot(), contentType: 'image/png' })

    // === START GAME ===
    await page.click('button:has-text("Start Game")')
    await expect(page.locator('text=/Round 1|VS|Skills|Fight/i').first()).toBeVisible({ timeout: 30000 })

    // === ROUND-BY-ROUND VERIFICATION ===
    const allPages = [{ page, label: 'host' }, ...contexts.map((c, i) => ({ page: c.page, label: `player-${i + 1}` }))]
    let round = 0

    while (true) {
      round++

      // Wait for host to reach round-end or game-over
      await expect(
        page.getByText(/Next round in|Final results in|Wins!/).first()
      ).toBeVisible({ timeout: 120000 })

      if (await page.getByText('Wins!').isVisible()) break

      // Wait for all players to also reach round-end
      for (const ctx of contexts) {
        try {
          await expect(
            ctx.page.getByText(/Next round in|Final results in|Wins!/).first()
          ).toBeVisible({ timeout: 15000 })
        } catch {}
      }

      // Screenshot all 8 perspectives at this round's end
      for (const p of allPages) {
        try {
          await test.info().attach(`round-${round}-${p.label}`, {
            body: await p.page.screenshot(), contentType: 'image/png',
          })
        } catch {}
      }

      // Extract scoreboard HP from all 8 and verify they match
      const hostBoard = await extractScoreboard(page)
      if (hostBoard.length > 0) {
        for (let i = 0; i < contexts.length; i++) {
          try {
            const playerBoard = await extractScoreboard(contexts[i].page)
            expect(playerBoard, `Round ${round}: player ${i + 1} (${contexts[i].info.name}) scoreboard differs from host`).toEqual(hostBoard)
          } catch (e) {
            if (String(e).includes('scoreboard differs')) throw e
          }
        }
      }

      // Wait for the round to advance on the host
      await expect(page.getByText(/Next round in|Final results in/).first()).not.toBeVisible({ timeout: 25000 })
    }

    // === FINAL GAME-OVER VERIFICATION ===
    await test.info().attach('final-host', { body: await page.screenshot(), contentType: 'image/png' })

    const hostResults = await extractFinalRankings(page)
    expect(hostResults.rankings).toHaveLength(8)

    for (let i = 0; i < contexts.length; i++) {
      await expect(contexts[i].page.getByText('Wins!')).toBeVisible({ timeout: 60000 })
      await test.info().attach(`final-player-${i + 1}`, {
        body: await contexts[i].page.screenshot(), contentType: 'image/png',
      })

      const playerResults = await extractFinalRankings(contexts[i].page)
      expect(playerResults.winner, `Player ${i + 1} (${contexts[i].info.name}) sees different winner`).toBe(hostResults.winner)
      expect(playerResults.rounds, `Player ${i + 1} (${contexts[i].info.name}) sees different round count`).toBe(hostResults.rounds)
      expect(playerResults.rankings, `Player ${i + 1} (${contexts[i].info.name}) has different rankings`).toEqual(hostResults.rankings)
    }

    for (const ctx of contexts) {
      try { await ctx.context.close() } catch {}
    }
  })
})
