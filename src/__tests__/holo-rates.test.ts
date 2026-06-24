import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  getOrCreateUser, upsertProfile, signIn, rpc, serviceSelect, serviceUpdate, serviceDelete, serviceInsert,
} from './rpc-helpers'

// Holo pull rates live in app_settings as a GLOBAL singleton, so every test
// that changes them must live in THIS one file — Vitest runs files in parallel
// against a shared DB, and two files mutating the same rows would race. All
// rate changes here go through the admin RPC and run sequentially.

describe('holo rates (admin RPC + buy_pack finish roll)', () => {
  let adminToken: string
  let playerToken: string
  let playerId: string
  let packId: string
  let cardsPerPack: number

  const readRates = async () => {
    const rows = await serviceSelect('holo_rates', 'select=edition,rate')
    return Object.fromEntries(rows.map((r: { edition: string; rate: number }) => [r.edition, Number(r.rate)]))
  }

  // Set rates via the real admin RPC (exercises the write path too).
  const setRates = (golden: number, diamond: number, galaxy: number) =>
    rpc(adminToken, 'rpc_admin_set_holo_rates', { p_golden: golden, p_diamond: diamond, p_galaxy: galaxy })

  beforeAll(async () => {
    const adminId = await getOrCreateUser('holo-admin@test.com', 'password123')
    await upsertProfile(adminId, { full_name: 'Holo Admin', role: 'admin', gruten: 1000 })
    adminToken = await signIn('holo-admin@test.com', 'password123')

    playerId = await getOrCreateUser('holo-player@test.com', 'password123')
    await upsertProfile(playerId, { full_name: 'Holo Player', role: 'user', gruten: 1000 })
    playerToken = await signIn('holo-player@test.com', 'password123')

    const packs = await serviceSelect('packs', 'is_active=eq.true&select=id,cards_per_pack&limit=1')
    packId = packs[0].id
    cardsPerPack = packs[0].cards_per_pack
  })

  afterAll(async () => {
    await setRates(0.1, 0.05, 0.01) // restore production defaults
  })

  describe('rpc_admin_set_holo_rates', () => {
    it('lets an admin update the rates, and they persist', async () => {
      const res = await setRates(0.2, 0.1, 0.02)
      expect(res.status).toBeLessThan(300)
      const rates = await readRates()
      expect(rates.golden).toBe(0.2)
      expect(rates.diamond).toBe(0.1)
      expect(rates.galaxy).toBe(0.02)
    })

    it('rejects a non-admin caller and leaves the rates unchanged', async () => {
      await setRates(0.2, 0.1, 0.02)
      const before = await readRates()
      const res = await rpc(playerToken, 'rpc_admin_set_holo_rates', { p_golden: 9, p_diamond: 9, p_galaxy: 9 })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(await readRates()).toEqual(before)
    })

    it('rejects rates that sum to more than 100%', async () => {
      await setRates(0.2, 0.1, 0.02)
      const before = await readRates()
      const res = await setRates(60, 30, 20)
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(await readRates()).toEqual(before)
    })

    it('rejects a negative or out-of-range rate', async () => {
      const res = await setRates(-1, 0, 0)
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('buy_pack finish roll', () => {
    // Forcing one finish to 100% (others 0) makes the roll deterministic.
    it('stamps every pulled card with the forced finish and stores it as its own edition row', async () => {
      await serviceDelete('user_cards', `user_id=eq.${playerId}`)
      await serviceUpdate('profiles', `id=eq.${playerId}`, { last_pack_purchase: null })
      await setRates(100, 0, 0) // every card becomes golden

      const res = await rpc(playerToken, 'buy_pack', { p_pack_id: packId, p_quantity: 1 })
      expect(res.status).toBe(200)
      const cards = res.data.cards as Array<{ edition: string }>
      expect(cards.length).toBe(cardsPerPack)
      expect(cards.every((c) => c.edition === 'golden')).toBe(true)

      const rows = await serviceSelect('user_cards', `user_id=eq.${playerId}&select=edition`)
      expect(rows.length).toBeGreaterThan(0)
      expect(rows.every((r: { edition: string }) => r.edition === 'golden')).toBe(true)
    })

    it('defaults to regular when all holo rates are zero', async () => {
      await serviceDelete('user_cards', `user_id=eq.${playerId}`)
      await serviceUpdate('profiles', `id=eq.${playerId}`, { last_pack_purchase: null })
      await setRates(0, 0, 0)

      const res = await rpc(playerToken, 'buy_pack', { p_pack_id: packId, p_quantity: 1 })
      expect(res.status).toBe(200)
      const cards = res.data.cards as Array<{ edition: string }>
      expect(cards.every((c) => c.edition === 'regular')).toBe(true)
    })

    it('flags a holo as new even when the card is already owned as regular', async () => {
      await serviceDelete('user_cards', `user_id=eq.${playerId}`)
      // Own every card in the pack pool as a REGULAR copy.
      const pool = await serviceSelect('pack_cards', `pack_id=eq.${packId}&select=card_id`)
      await serviceInsert(
        'user_cards',
        pool.map((r: { card_id: string }) => ({ user_id: playerId, card_id: r.card_id, edition: 'regular', count: 1 }))
      )
      await serviceUpdate('profiles', `id=eq.${playerId}`, { last_pack_purchase: null })
      await setRates(100, 0, 0) // every pulled card is golden

      const res = await rpc(playerToken, 'buy_pack', { p_pack_id: packId, p_quantity: 1 })
      expect(res.status).toBe(200)
      const cards = res.data.cards as Array<{ edition: string; is_new: boolean }>
      // The golden finish is brand new even though the regular is owned.
      expect(cards.every((c) => c.edition === 'golden' && c.is_new === true)).toBe(true)
    })

    it('does not flag a holo as new when that exact finish is already owned', async () => {
      await serviceDelete('user_cards', `user_id=eq.${playerId}`)
      // Own every pack-pool card as a GOLDEN copy already.
      const pool = await serviceSelect('pack_cards', `pack_id=eq.${packId}&select=card_id`)
      await serviceInsert(
        'user_cards',
        pool.map((r: { card_id: string }) => ({ user_id: playerId, card_id: r.card_id, edition: 'golden', count: 1 }))
      )
      await serviceUpdate('profiles', `id=eq.${playerId}`, { last_pack_purchase: null })
      await setRates(100, 0, 0)

      const res = await rpc(playerToken, 'buy_pack', { p_pack_id: packId, p_quantity: 1 })
      expect(res.status).toBe(200)
      const cards = res.data.cards as Array<{ edition: string; is_new: boolean }>
      expect(cards.every((c) => c.edition === 'golden' && c.is_new === false)).toBe(true)
    })

    it('keeps the same card in different finishes as separate rows', async () => {
      await serviceDelete('user_cards', `user_id=eq.${playerId}`)

      await serviceUpdate('profiles', `id=eq.${playerId}`, { last_pack_purchase: null })
      await setRates(100, 0, 0)
      await rpc(playerToken, 'buy_pack', { p_pack_id: packId, p_quantity: 1 })

      await serviceUpdate('profiles', `id=eq.${playerId}`, { last_pack_purchase: null })
      await setRates(0, 100, 0)
      await rpc(playerToken, 'buy_pack', { p_pack_id: packId, p_quantity: 1 })

      const rows = await serviceSelect('user_cards', `user_id=eq.${playerId}&select=edition`)
      const editions = new Set(rows.map((r: { edition: string }) => r.edition))
      expect(editions.has('golden')).toBe(true)
      expect(editions.has('diamond')).toBe(true)
    })
  })
})
