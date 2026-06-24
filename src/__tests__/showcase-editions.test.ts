import { describe, it, expect, beforeAll } from 'vitest'
import { getOrCreateUser, upsertProfile, signIn, rpc, serviceSelect, serviceInsert, serviceDelete } from './rpc-helpers'

// update_profile now takes a parallel top_card_editions array; a player can only
// showcase a (card, finish) they own, and get_players returns the chosen finish.

describe('showcase holo editions', () => {
  let userId: string
  let token: string
  let cardId: string

  beforeAll(async () => {
    userId = await getOrCreateUser('showcase@test.com', 'password123')
    await upsertProfile(userId, { full_name: 'Showcase Tester', role: 'user', gruten: 1000 })
    token = await signIn('showcase@test.com', 'password123')

    const cards = await serviceSelect('cards', 'select=id&limit=1')
    cardId = cards[0].id

    // Own this card in regular + golden, but NOT diamond.
    await serviceDelete('user_cards', `user_id=eq.${userId}`)
    await serviceInsert('user_cards', [
      { user_id: userId, card_id: cardId, edition: 'regular', count: 1 },
      { user_id: userId, card_id: cardId, edition: 'golden', count: 1 },
    ])
  })

  it('lets a player showcase a finish they own, and stores it', async () => {
    const res = await rpc(token, 'update_profile', {
      p_full_name: 'Showcase Tester',
      p_top_cards: [cardId],
      p_top_card_editions: ['golden'],
    })
    expect(res.status).toBeLessThan(300)

    const rows = await serviceSelect('profiles', `id=eq.${userId}&select=top_cards,top_card_editions`)
    expect(rows[0].top_cards).toEqual([cardId])
    expect(rows[0].top_card_editions).toEqual(['golden'])
  })

  it('returns the chosen finish from get_players', async () => {
    const res = await rpc(token, 'get_players', {})
    expect(res.status).toBe(200)
    const me = (res.data as Array<{ id: string; top_cards: Array<{ id: string; edition: string }> }>).find((p) => p.id === userId)
    expect(me).toBeTruthy()
    expect(me!.top_cards[0].id).toBe(cardId)
    expect(me!.top_cards[0].edition).toBe('golden')
  })

  it('rejects showcasing a finish the player does not own', async () => {
    const res = await rpc(token, 'update_profile', {
      p_full_name: 'Showcase Tester',
      p_top_cards: [cardId],
      p_top_card_editions: ['diamond'], // not owned
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
