import { describe, it, expect } from 'vitest'
import { resolveFaceOff, precomputeRound, type BattleCard, type BattlePlayer, type ActiveSkill } from '@/lib/battle-engine'
import { computeActiveSynergies, type SynergyDef } from '@/lib/synergies'
import { buildEffectFromRow } from '@/lib/battle-effects/loader'
import { makeEffect } from '@/lib/battle-effects'
import { parseRangeMax } from '@/lib/dice-display'
import { createSeededRng } from '@/lib/seeded-random'

const card = (rarity: string, id: string, types: string[] = []): BattleCard => ({ id, name: id, image_url: null, rarity, creature_name: null, types })

// One synergy effect as a ready-to-fire ActiveSkill (owner = side `ownerSide`).
const active = (
  op: string,
  params: Record<string, unknown>,
  scope: ActiveSkill['skill']['effects'][number]['scope'],
  target: ActiveSkill['skill']['effects'][number]['target'],
  ownerSide: 1 | 2,
  requiredTypes?: string[],
  kind: Parameters<typeof makeEffect>[4] = ['heal'],
): ActiveSkill => ({
  skill: { id: 'syn', name: 'Syn', description: '', usesPerBattle: 1, effects: [{ ...makeEffect('fx', 'FX', op, params, kind), scope, target, requiredTypes }] },
  activatedBy: 'p1', roundActivated: 0, ownerSide,
})

describe('lifesteal op', () => {
  const SEED = 7
  // secret_rare (6★) vs common (1★): side 1 reliably wins this seed and deals damage.
  const dealer = () => card('secret_rare', 'a', ['ent'])
  const victim = () => card('common', 'b', [])

  it('heals the dealing side a flat amount, scoped to the owner only', () => {
    const r = resolveFaceOff(dealer(), victim(), [active('lifesteal', { mode: 'flat', amount: 1, chance: 100 }, 'synergy_cards', 'allies', 1, ['ent'])], createSeededRng(SEED))
    expect(r.damage2).toBeGreaterThan(0) // side 1 dealt damage
    expect(r.heal1).toBe(1)
    expect(r.heal2).toBe(0)
  })

  it('does not heal when the owner card deals no damage (it lost)', () => {
    // Owner side 1 is now the common card — it loses, so no lifesteal.
    const r = resolveFaceOff(card('common', 'a', ['ent']), card('secret_rare', 'b', []), [active('lifesteal', { mode: 'flat', amount: 1, chance: 100 }, 'synergy_cards', 'allies', 1, ['ent'])], createSeededRng(SEED))
    expect(r.damage1).toBeGreaterThan(0) // side 1 took damage
    expect(r.heal1).toBe(0)
    expect(r.heal2).toBe(0)
  })

  it('full mode heals exactly the damage dealt', () => {
    const r = resolveFaceOff(dealer(), victim(), [active('lifesteal', { mode: 'full', amount: 1, chance: 100 }, 'synergy_cards', 'allies', 1, ['ent'])], createSeededRng(SEED))
    expect(r.heal1).toBe(r.damage2)
  })

  it('percent mode floors the fraction of damage dealt', () => {
    const r = resolveFaceOff(dealer(), victim(), [active('lifesteal', { mode: 'percent', amount: 50, chance: 100 }, 'synergy_cards', 'allies', 1, ['ent'])], createSeededRng(SEED))
    expect(r.heal1).toBe(Math.floor(r.damage2 / 2))
  })

  it('chance 0 never heals', () => {
    const r = resolveFaceOff(dealer(), victim(), [active('lifesteal', { mode: 'flat', amount: 5, chance: 0 }, 'synergy_cards', 'allies', 1, ['ent'])], createSeededRng(SEED))
    expect(r.heal1).toBe(0)
  })

  it('a 100%-chance lifesteal leaves the dice stream identical (no RNG perturbation)', () => {
    const base = resolveFaceOff(dealer(), victim(), undefined, createSeededRng(SEED))
    const withFx = resolveFaceOff(dealer(), victim(), [active('lifesteal', { mode: 'flat', amount: 1, chance: 100 }, 'synergy_cards', 'allies', 1, ['ent'])], createSeededRng(SEED))
    expect(withFx.roll1).toBe(base.roll1)
    expect(withFx.roll2).toBe(base.roll2)
    expect(withFx.damage2).toBe(base.damage2)
  })

  it('lifesteal raises the owner HP across a round (integration)', () => {
    const dealerDeck = Array.from({ length: 5 }, (_, i) => card('secret_rare', `p1-${i}`, ['ent']))
    const victimDeck = Array.from({ length: 5 }, (_, i) => card('common', `p2-${i}`, []))
    const players: BattlePlayer[] = [
      { id: 'p1', name: 'p1', avatar_url: null, deck: dealerDeck, hp: 5, eliminated: false },
      { id: 'p2', name: 'p2', avatar_url: null, deck: victimDeck, hp: 5, eliminated: false },
    ]
    const pairings = { pairs: [['p1', 'p2']] as [string, string][], byeId: null }
    const syn = computeActiveSynergies(
      [{ id: 'p1', deck: dealerDeck }],
      [{ id: 's', name: 'Vamp', description: '', requirements: [{ typeId: 'ent', count: 5 }], effects: [{ effect: makeEffect('ls', 'LS', 'lifesteal', { mode: 'full', amount: 1, chance: 100 }, ['heal']), scope: 'synergy_cards', target: 'allies' }] }],
    )
    const withHeal = precomputeRound(players, { p1: 5, p2: 5 }, 1, pairings, syn, createSeededRng(3))
    const without = precomputeRound(players, { p1: 5, p2: 5 }, 1, pairings, [], createSeededRng(3))
    const finalHp = (r: typeof withHeal) => r.matches[0].hpSnapshots[r.matches[0].hpSnapshots.length - 1].p1
    expect(finalHp(withHeal)).toBeGreaterThan(finalHp(without))
    expect(finalHp(withHeal)).toBeLessThanOrEqual(10) // capped
  })
})

describe('drowsy / non_synergy_cards scope', () => {
  // extra_dice from -1..0, applied to cards WITHOUT the 'schlept' type, everyone.
  const drowsy = (ownerSide: 1 | 2) => active('extra_dice', { min: -1, max: 0 }, 'non_synergy_cards', 'everyone', ownerSide, ['schlept'], ['extraDice'])

  it('saps a non-schlept card and spares a schlept card in the same face-off', () => {
    const r = resolveFaceOff(card('rare', 'a', ['schlept']), card('rare', 'b', []), [drowsy(1)], createSeededRng(9))
    expect(r.bonusRoll1).toBe(0)            // schlept card untouched
    expect([-1, 0]).toContain(r.bonusRoll2) // non-schlept card gets the penalty die
  })

  it('penalizes non-schlept cards on BOTH sides (everyone)', () => {
    const r = resolveFaceOff(card('rare', 'a', []), card('rare', 'b', []), [drowsy(1)], createSeededRng(9))
    expect([-1, 0]).toContain(r.bonusRoll1)
    expect([-1, 0]).toContain(r.bonusRoll2)
  })

  it('does nothing when both cards are schlept', () => {
    const r = resolveFaceOff(card('rare', 'a', ['schlept']), card('rare', 'b', ['schlept']), [drowsy(1)], createSeededRng(9))
    expect(r.bonusRoll1).toBe(0)
    expect(r.bonusRoll2).toBe(0)
  })

  it('computeActiveSynergies carries requiredTypes for non_synergy_cards bindings', () => {
    const def: SynergyDef = {
      id: 'd', name: 'Drowsy', description: '',
      requirements: [{ typeId: 'schlept', count: 3 }],
      effects: [{ effect: makeEffect('dz', 'Dz', 'extra_dice', { min: -1, max: 0 }, ['extraDice']), scope: 'non_synergy_cards', target: 'everyone' }],
    }
    const out = computeActiveSynergies([{ id: 'p1', deck: [card('rare', 'x', ['schlept']), card('rare', 'y', ['schlept']), card('rare', 'z', ['schlept'])] }], [def])
    expect(out.length).toBe(1)
    expect(out[0].skill.effects[0].requiredTypes).toEqual(['schlept'])
  })
})

describe('battle-effect rows + range labels', () => {
  it('builds lifesteal and drowsy from DB-style rows', () => {
    expect(buildEffectFromRow({ key: 'lifesteal', name: 'Lifesteal', op: 'lifesteal', params: { mode: 'flat', amount: 1, chance: 100 }, kind: ['heal'] })).not.toBeNull()
    expect(buildEffectFromRow({ key: 'drowsy', name: 'Drowsy', op: 'extra_dice', params: { min: -1, max: 0 }, kind: ['extraDice'] })).not.toBeNull()
  })

  it('a negative extra die renders an unambiguous signed range label', () => {
    const drowsy = makeEffect('drowsy', 'Drowsy', 'extra_dice', { min: -1, max: 0 }, ['extraDice'])
    expect(drowsy.rangeLabel).toBe('-1 to 0')
    expect(parseRangeMax('-1 to 0')).toBe(0)
    // positive labels are unchanged
    expect(makeEffect('x', 'X', 'extra_dice', { min: 0, max: 2 }).rangeLabel).toBe('0-2')
    expect(parseRangeMax('0-10')).toBe(10)
  })
})
