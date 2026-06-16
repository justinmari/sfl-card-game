import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  getOrCreateUser, upsertProfile, signIn, rpc, getGruten, serviceSelect, serviceUpdate, serviceDelete,
  serviceInsert, anonRpc,
} from './rpc-helpers'

// Coverage for previously-untested RPCs with real business logic.

describe('save_deck (integration)', () => {
  let userId: string, token: string
  let ownedIds: string[] = []
  let unownedId: string

  beforeAll(async () => {
    userId = await getOrCreateUser('deck-user@test.com', 'password123')
    await upsertProfile(userId, { full_name: 'Deck User', role: 'user', gruten: 0 })
    token = await signIn('deck-user@test.com', 'password123')

    const cards = await serviceSelect('cards', 'select=id&limit=6')
    const ids = cards.map((c: { id: string }) => c.id)
    ownedIds = ids.slice(0, 5)
    unownedId = ids[5]

    // Grant ownership of the first five cards.
    await serviceDelete('user_cards', `user_id=eq.${userId}`)
    for (const cardId of ownedIds) {
      await serviceInsert('user_cards', { user_id: userId, card_id: cardId, count: 1 })
    }
  })

  it('saves a 5-card deck to a slot', async () => {
    const res = await rpc(token, 'save_deck', { p_slot: 1, p_name: 'My Deck', p_card_ids: ownedIds })
    expect(res.status).toBeLessThan(300)
    const decks = await serviceSelect('decks', `user_id=eq.${userId}&slot=eq.1&select=name,card_ids`)
    expect(decks[0].name).toBe('My Deck')
    expect(decks[0].card_ids).toHaveLength(5)
  })

  it('rejects a deck containing an unowned card', async () => {
    const res = await rpc(token, 'save_deck', {
      p_slot: 2,
      p_name: 'Cheating',
      p_card_ids: [...ownedIds.slice(0, 4), unownedId],
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects an invalid slot', async () => {
    const res = await rpc(token, 'save_deck', { p_slot: 9, p_name: 'Bad', p_card_ids: ownedIds })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects duplicate cards in a deck', async () => {
    const dupe = [ownedIds[0], ownedIds[0], ownedIds[1], ownedIds[2], ownedIds[3]]
    const res = await rpc(token, 'save_deck', { p_slot: 3, p_name: 'Dupes', p_card_ids: dupe })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

describe('get_players (integration)', () => {
  let visibleId: string, hiddenId: string, viewerToken: string

  beforeAll(async () => {
    visibleId = await getOrCreateUser('gp-visible@test.com', 'password123')
    hiddenId = await getOrCreateUser('gp-hidden@test.com', 'password123')
    const viewerId = await getOrCreateUser('gp-viewer@test.com', 'password123')
    await upsertProfile(visibleId, { full_name: 'GP Visible', role: 'user', hidden: false })
    await upsertProfile(hiddenId, { full_name: 'GP Hidden', role: 'user', hidden: true })
    await upsertProfile(viewerId, { full_name: 'GP Viewer', role: 'user', hidden: false })
    viewerToken = await signIn('gp-viewer@test.com', 'password123')
  })

  it('returns visible named profiles and excludes hidden ones', async () => {
    const res = await rpc(viewerToken, 'get_players', {})
    expect(res.status).toBe(200)
    const ids = (res.data as { id: string }[]).map((p) => p.id)
    expect(ids).toContain(visibleId)
    expect(ids).not.toContain(hiddenId)
  })

  it('requires authentication', async () => {
    // anon (no user JWT) → should fail the auth.uid() check.
    const res = await anonRpc('get_players', {})
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})

describe('claim_daily_gruten (integration)', () => {
  let userId: string, token: string

  beforeAll(async () => {
    userId = await getOrCreateUser('daily-user@test.com', 'password123')
    token = await signIn('daily-user@test.com', 'password123')
  })

  beforeEach(async () => {
    await upsertProfile(userId, { full_name: 'Daily User', role: 'user', gruten: 0, last_daily_claim: null })
  })

  it('grants 500 G on first claim then blocks a second claim the same day', async () => {
    const first = await rpc(token, 'claim_daily_gruten', {})
    expect(first.status).toBe(200)
    expect(await getGruten(userId)).toBe(500)

    const second = await rpc(token, 'claim_daily_gruten', {})
    expect(second.status).toBeGreaterThanOrEqual(400)
    expect(await getGruten(userId)).toBe(500) // not granted twice
  })

  it('allows a claim again once last_daily_claim is a prior day', async () => {
    await serviceUpdate('profiles', `id=eq.${userId}`, { gruten: 0, last_daily_claim: '2020-01-01' })
    const res = await rpc(token, 'claim_daily_gruten', {})
    expect(res.status).toBe(200)
    expect(await getGruten(userId)).toBe(500)
  })

  it('does not let admins claim', async () => {
    await upsertProfile(userId, { full_name: 'Daily User', role: 'admin', gruten: 0, last_daily_claim: null })
    const res = await rpc(token, 'claim_daily_gruten', {})
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
