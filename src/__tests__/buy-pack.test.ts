import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  getOrCreateUser, upsertProfile, signIn, rpc, getGruten, serviceSelect, serviceUpdate, serviceDelete,
} from './rpc-helpers'

// Integration tests for buy_pack: the currency/economy guards that the existing
// gruten-transactions suite does NOT cover (it only asserts the logged transaction).

describe('buy_pack (integration)', () => {
  let userId: string
  let token: string
  let packId: string
  let packPrice: number
  let cardsPerPack: number

  beforeAll(async () => {
    userId = await getOrCreateUser('bp-user@test.com', 'password123')
    await upsertProfile(userId, { full_name: 'BP User', role: 'user', gruten: 1000 })
    token = await signIn('bp-user@test.com', 'password123')

    const packs = await serviceSelect('packs', 'is_active=eq.true&select=id,price,cards_per_pack&limit=1')
    packId = packs[0].id
    packPrice = packs[0].price
    cardsPerPack = packs[0].cards_per_pack
  })

  beforeEach(async () => {
    // Reset balance and clear the cooldown before each test.
    await upsertProfile(userId, { full_name: 'BP User', role: 'user', gruten: 1000 })
    await serviceUpdate('profiles', `id=eq.${userId}`, { last_pack_purchase: null })
  })

  it('rejects a purchase when the balance is below the total cost (and leaves the balance unchanged)', async () => {
    await serviceUpdate('profiles', `id=eq.${userId}`, { gruten: Math.max(0, packPrice - 1) })
    const res = await rpc(token, 'buy_pack', { p_pack_id: packId, p_quantity: 1 })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(await getGruten(userId)).toBe(Math.max(0, packPrice - 1))
  })

  it('deducts exactly price × quantity on a successful purchase', async () => {
    const res = await rpc(token, 'buy_pack', { p_pack_id: packId, p_quantity: 2 })
    expect(res.status).toBe(200)
    expect(await getGruten(userId)).toBe(1000 - packPrice * 2)
  })

  it('enforces the 2-second cooldown between purchases', async () => {
    const first = await rpc(token, 'buy_pack', { p_pack_id: packId, p_quantity: 1 })
    expect(first.status).toBe(200)
    const balanceAfterFirst = await getGruten(userId)
    // Immediate second purchase is within the cooldown window.
    const second = await rpc(token, 'buy_pack', { p_pack_id: packId, p_quantity: 1 })
    expect(second.status).toBeGreaterThanOrEqual(400)
    expect(await getGruten(userId)).toBe(balanceAfterFirst) // not double-charged
  })

  it('inserts cards_per_pack cards and increments user_cards.count (single row per card)', async () => {
    // Clear any owned cards from previous tests.
    await serviceDelete('user_cards', `user_id=eq.${userId}`)

    const sumCounts = async () => {
      const rows = await serviceSelect('user_cards', `user_id=eq.${userId}&select=card_id,count`)
      return {
        rows: rows.length,
        total: rows.reduce((s: number, r: { count: number }) => s + r.count, 0),
      }
    }

    await rpc(token, 'buy_pack', { p_pack_id: packId, p_quantity: 1 })
    const after1 = await sumCounts()
    expect(after1.total).toBeGreaterThanOrEqual(cardsPerPack)

    await serviceUpdate('profiles', `id=eq.${userId}`, { last_pack_purchase: null })
    await rpc(token, 'buy_pack', { p_pack_id: packId, p_quantity: 1 })
    const after2 = await sumCounts()
    // Counts increased by another pack's worth, with no duplicate (user,card) rows.
    expect(after2.total).toBe(after1.total + cardsPerPack)
    const distinct = await serviceSelect('user_cards', `user_id=eq.${userId}&select=card_id`)
    const ids = distinct.map((r: { card_id: string }) => r.card_id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
