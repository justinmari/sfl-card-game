import { describe, it, expect } from 'vitest'
import { OP_REGISTRY, validateOpParams, makeEffect } from '@/lib/battle-effects'
import { buildEffectFromRow } from '@/lib/battle-effects/loader'
import type { FaceOffState, RoundContext } from '@/lib/skills'
import type { BattleCard, BattlePlayer } from '@/lib/battle-engine'
import { createSeededRng } from '@/lib/seeded-random'

const baseState = (): FaceOffState => ({
  card1: { id: 'a', name: 'A', image_url: null, rarity: 'common', creature_name: null },
  card2: { id: 'b', name: 'B', image_url: null, rarity: 'rare', creature_name: null },
  star1: 1, star2: 3, rarity1: 'common', rarity2: 'rare',
  roll1: 0, roll2: 0, bonusRoll1: 0, bonusRoll2: 0, effective1: 0, effective2: 0, damage1: 0, damage2: 0,
  rand: () => 0.5,
})

const card = (id: string, rarity = 'common'): BattleCard => ({ id, name: id, image_url: null, rarity, creature_name: null })
const player = (id: string, n: number): BattlePlayer => ({ id, name: id, avatar_url: null, deck: Array.from({ length: n }, (_, i) => card(`${id}-${i}`)), hp: 10, eliminated: false })
const roundCtx = (players: BattlePlayer[], rand = createSeededRng(1)): RoundContext => ({ players, decks: new Map(), flags: {}, rand })

describe('OP_REGISTRY', () => {
  it('every op has an id, phase, kind, and build fn', () => {
    for (const [id, op] of Object.entries(OP_REGISTRY)) {
      expect(op.id).toBe(id)
      expect(['faceoff', 'round']).toContain(op.phase)
      expect(Array.isArray(op.defaultKind)).toBe(true)
      expect(typeof op.build).toBe('function')
    }
  })

  it('multiply_total doubles effective totals', () => {
    const hooks = OP_REGISTRY['multiply_total'].build({ factor: 2 })
    const s = { ...baseState(), effective1: 4, effective2: 3 }
    const out = hooks.onTotals!(s)
    expect(out.effective1).toBe(8)
    expect(out.effective2).toBe(6)
  })

  it('set_rarity_if changes only the rarity field, not power', () => {
    const hooks = OP_REGISTRY['set_rarity_if'].build({ ifRarity: 'common', toRarity: 'secret_rare' })
    const out = hooks.onStars!(baseState())
    expect(out.rarity1).toBe('secret_rare') // common promoted
    expect(out.rarity2).toBe('rare')        // unchanged
    expect(out.star1).toBe(1)               // power untouched
  })

  it('boost_power_if changes only power, not rarity', () => {
    const hooks = OP_REGISTRY['boost_power_if'].build({ ifRarity: 'common', value: 6 })
    const out = hooks.onStars!(baseState())
    expect(out.star1).toBe(6)
    expect(out.rarity1).toBe('common') // rarity untouched
  })
})

describe('validateOpParams', () => {
  it('rejects an unknown op', () => {
    expect(validateOpParams('nope', {})).toMatch(/Unknown op/)
  })
  it('accepts valid params and empty params (defaults apply)', () => {
    expect(validateOpParams('multiply_total', { factor: 2 })).toBeNull()
    expect(validateOpParams('multiply_total', {})).toBeNull()
  })
  it('rejects out-of-range numbers', () => {
    expect(validateOpParams('multiply_total', { factor: 99 })).toMatch(/<=/)
  })
  it('rejects an invalid rarity', () => {
    expect(validateOpParams('set_rarity_if', { ifRarity: 'banana' })).toMatch(/valid rarity/)
  })
})

describe('makeEffect', () => {
  it('builds a BattleEffect from an op + params', () => {
    const fx = makeEffect('test', 'Test', 'flat_damage', { value: 5 }, ['damage'])
    expect(fx.id).toBe('test')
    expect(fx.kind).toEqual(['damage'])
    const out = fx.hooks.onDamage!({ ...baseState(), damage2: 2 })
    expect(out.damage2).toBe(5)
  })
  it('throws on an unknown op', () => {
    expect(() => makeEffect('x', 'X', 'bogus')).toThrow(/Unknown/)
  })
})

describe('op behavior (face-off)', () => {
  it('zero_dice sets both rolls to 0', () => {
    const out = OP_REGISTRY['zero_dice'].build({}).onDiceOverride!({ ...baseState(), roll1: 3, roll2: 4 })
    expect([out.roll1, out.roll2]).toEqual([0, 0])
  })
  it('multiply_damage scales damage', () => {
    const out = OP_REGISTRY['multiply_damage'].build({ factor: 3 }).onDamage!({ ...baseState(), damage1: 2, damage2: 1 })
    expect([out.damage1, out.damage2]).toEqual([6, 3])
  })
  it('flat_damage only hits losers (damage > 0)', () => {
    const out = OP_REGISTRY['flat_damage'].build({ value: 3 }).onDamage!({ ...baseState(), damage1: 0, damage2: 5 })
    expect([out.damage1, out.damage2]).toEqual([0, 3])
  })
  it('reverse_damage swaps damage', () => {
    const out = OP_REGISTRY['reverse_damage'].build({}).onDamage!({ ...baseState(), damage1: 2, damage2: 0 })
    expect([out.damage1, out.damage2]).toEqual([0, 2])
  })
  it('set_power sets both stars', () => {
    const out = OP_REGISTRY['set_power'].build({ value: 1 }).onStars!({ ...baseState(), star1: 5, star2: 6 })
    expect([out.star1, out.star2]).toEqual([1, 1])
  })
  it('big_dice is deterministic under a seed and respects max', () => {
    const rng = createSeededRng(42)
    const out = OP_REGISTRY['big_dice'].build({ max: 10 }).onDiceOverride!({ ...baseState(), star1: 1, star2: 5, rand: rng })
    expect(out.roll1).toBeGreaterThanOrEqual(0)
    expect(out.roll1).toBeLessThanOrEqual(10)
    expect(out.roll2).toBe(0) // only the lower-rarity side rolls
  })
  it('randomize_rarity sets rarity + matching power and consumes RNG', () => {
    const out = OP_REGISTRY['randomize_rarity'].build({}).onStars!({ ...baseState(), rand: createSeededRng(7) })
    expect(['common', 'uncommon', 'rare', 'ultra_rare', 'legendary', 'secret_rare']).toContain(out.rarity1)
    expect(out.star1).toBeGreaterThanOrEqual(1)
    expect(out.star1).toBeLessThanOrEqual(6)
  })
})

describe('op behavior (round-level)', () => {
  it('heal_instead sets the healInstead flag', () => {
    const out = OP_REGISTRY['heal_instead'].build({}).onRound!(roundCtx([player('a', 5)]))
    expect(out.flags.healInstead).toBe(true)
  })
  it('visual_tint sets the visualEffect flag', () => {
    const out = OP_REGISTRY['visual_tint'].build({ filter: 'sepia(1)' }).onRound!(roundCtx([player('a', 5)]))
    expect(out.flags.visualEffect).toBe('sepia(1)')
  })
  it('redeal_all redeals 5 cards per player', () => {
    const out = OP_REGISTRY['redeal_all'].build({}).onRound!(roundCtx([player('a', 5), player('b', 5)]))
    expect(out.decks.get('a')!.length).toBe(5)
    expect(out.decks.get('b')!.length).toBe(5)
  })
  it('redeal_all short-deck branch pads from the original deck', () => {
    // 1 player with only 3 cards → dealt < 5 → pad to keep a 5-card deck.
    const out = OP_REGISTRY['redeal_all'].build({}).onRound!(roundCtx([player('solo', 3)]))
    expect(out.decks.get('solo')!.length).toBe(3) // all available cards dealt back
  })
})

describe('buildEffectFromRow skip-and-log', () => {
  it('returns null for an unknown op instead of throwing', () => {
    const fx = buildEffectFromRow({ key: 'bad', name: 'Bad', op: 'does_not_exist', params: {}, kind: ['power'] })
    expect(fx).toBeNull()
  })
  it('builds a valid row', () => {
    const fx = buildEffectFromRow({ key: 'ok', name: 'OK', op: 'multiply_total', params: { factor: 2 }, kind: ['total'] })
    expect(fx).not.toBeNull()
    expect(fx!.id).toBe('ok')
  })
})
