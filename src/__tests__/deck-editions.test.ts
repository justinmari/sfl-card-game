import { describe, it, expect, beforeAll } from 'vitest'
import { getOrCreateUser, upsertProfile, signIn, rpc, serviceSelect, serviceInsert, serviceDelete } from './rpc-helpers'

// save_deck now takes a parallel card_editions array; a player can only put a
// (card, finish) they own into a deck, and the finish is persisted.

describe('deck holo editions', () => {
  let userId: string
  let token: string
  let cardIds: string[]

  beforeAll(async () => {
    userId = await getOrCreateUser('deckedition@test.com', 'password123')
    await upsertProfile(userId, { full_name: 'Deck Editor', role: 'user', gruten: 1000 })
    token = await signIn('deckedition@test.com', 'password123')

    // Five distinct non-secret cards (deck allows at most one secret rare).
    const cards = await serviceSelect('cards', 'rarity=neq.secret_rare&select=id&limit=5')
    cardIds = cards.map((c: { id: string }) => c.id)

    // Own all five in regular; own the first ALSO in golden (but not diamond).
    await serviceDelete('user_cards', `user_id=eq.${userId}`)
    await serviceInsert('user_cards', [
      ...cardIds.map((id) => ({ user_id: userId, card_id: id, edition: 'regular', count: 1 })),
      { user_id: userId, card_id: cardIds[0], edition: 'golden', count: 1 },
    ])
  })

  it('saves a deck with a finish the player owns', async () => {
    const editions = ['golden', 'regular', 'regular', 'regular', 'regular']
    const res = await rpc(token, 'save_deck', {
      p_slot: 1, p_name: 'Holo Deck', p_card_ids: cardIds, p_card_editions: editions,
    })
    expect(res.status).toBeLessThan(300)

    const rows = await serviceSelect('decks', `user_id=eq.${userId}&slot=eq.1&select=card_ids,card_editions`)
    expect(rows[0].card_ids).toEqual(cardIds)
    expect(rows[0].card_editions).toEqual(editions)
  })

  it('rejects a deck with a finish the player does not own', async () => {
    const res = await rpc(token, 'save_deck', {
      p_slot: 1, p_name: 'Bad Deck', p_card_ids: cardIds,
      p_card_editions: ['diamond', 'regular', 'regular', 'regular', 'regular'], // diamond not owned
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
