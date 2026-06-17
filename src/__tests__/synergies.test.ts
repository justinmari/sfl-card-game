import { describe, it, expect } from 'vitest'
import { computeActiveSynergies, synergyMet, metSynergies, type SynergyDef } from '@/lib/synergies'
import { buildSynergyDef, type SynergyDefRow } from '@/lib/synergies/loader'
import { resolveFaceOff, precomputeRound, type BattleCard, type BattlePlayer, type ActiveSkill } from '@/lib/battle-engine'
import { makeEffect } from '@/lib/battle-effects'
import { createSeededRng } from '@/lib/seeded-random'

const card = (rarity: string, id: string, types: string[] = []): BattleCard => ({ id, name: id, image_url: null, rarity, creature_name: null, types })

const deckOf = (types: string[][]): BattleCard[] => types.map((t, i) => card('rare', `c${i}`, t))
const playerWithDeck = (id: string, types: string[][]): BattlePlayer => ({ id, name: id, avatar_url: null, deck: deckOf(types), hp: 10, eliminated: false })

// Synergy: 3 Egg cards → dice bonus
const eggRoll: SynergyDef = {
  id: 'egg-roll', name: 'Egg Roll', description: '3 eggs',
  requirements: [{ typeId: 'egg', count: 3 }],
  effects: [{ effect: makeEffect('roll', 'Roll', 'dice_bonus', { amount: 3 }, ['dice']), scope: 'own', target: 'allies' }],
}

describe('synergyMet / recipe matching', () => {
  it('matches when the deck has enough of each required type (non-exclusive)', () => {
    expect(synergyMet(deckOf([['egg'], ['egg'], ['egg'], [], []]), eggRoll)).toBe(true)
    expect(synergyMet(deckOf([['egg'], ['egg'], [], [], []]), eggRoll)).toBe(false)
  })

  it('counts multi-type cards toward every type', () => {
    const multi: SynergyDef = {
      id: 'rainbow', name: 'Rainbow', description: '', requirements: [{ typeId: 'fire', count: 1 }, { typeId: 'water', count: 1 }], effects: [],
    }
    expect(synergyMet(deckOf([['fire', 'water'], [], [], [], []]), multi)).toBe(true) // one card has both
  })

  it('empty requirements never match', () => {
    expect(synergyMet(deckOf([[], [], [], [], []]), { id: 'x', name: '', description: '', requirements: [], effects: [] })).toBe(false)
  })
})

describe('computeActiveSynergies', () => {
  it('produces an ActiveSkill per bound effect for each player that qualifies', () => {
    const players = [
      { id: 'p1', deck: deckOf([['egg'], ['egg'], ['egg'], [], []]) },
      { id: 'p2', deck: deckOf([['egg'], [], [], [], []]) },
    ]
    const active = computeActiveSynergies(players, [eggRoll])
    expect(active.length).toBe(1)
    expect(active[0].activatedBy).toBe('p1')
    expect(active[0].skill.effects[0].scope).toBe('own')
  })

  it('metSynergies lists what a deck satisfies', () => {
    expect(metSynergies(deckOf([['egg'], ['egg'], ['egg'], [], []]), [eggRoll]).map((s) => s.id)).toEqual(['egg-roll'])
  })
})

describe('engine scoping of synergy effects', () => {
  const mkActive = (scope: 'own' | 'arena' | 'matchup' | 'synergy_cards', target: 'allies' | 'enemies' | 'everyone', ownerSide: 1 | 2, requiredTypes?: string[]): ActiveSkill => ({
    skill: { id: 'syn', name: 'Syn', description: '', usesPerBattle: 1, effects: [{ ...makeEffect('r', 'R', 'dice_bonus', { amount: 3 }, ['dice']), scope, target, requiredTypes }] },
    activatedBy: 'p1', roundActivated: 0, ownerSide,
  })

  it('scope=own/allies only buffs the owner side', () => {
    const base = resolveFaceOff(card('rare', 'a'), card('rare', 'b'), undefined, createSeededRng(42))
    const scoped = resolveFaceOff(card('rare', 'a'), card('rare', 'b'), [mkActive('own', 'allies', 1)], createSeededRng(42))
    expect(scoped.roll1).toBe(base.roll1 + 3)
    expect(scoped.roll2).toBe(base.roll2) // opponent untouched
  })

  it('scope=arena/everyone buffs both sides', () => {
    const base = resolveFaceOff(card('rare', 'a'), card('rare', 'b'), undefined, createSeededRng(42))
    const scoped = resolveFaceOff(card('rare', 'a'), card('rare', 'b'), [mkActive('arena', 'everyone', 1)], createSeededRng(42))
    expect(scoped.roll1).toBe(base.roll1 + 3)
    expect(scoped.roll2).toBe(base.roll2 + 3)
  })

  it('scope=matchup/enemies only debuffs the opponent', () => {
    const base = resolveFaceOff(card('rare', 'a'), card('rare', 'b'), undefined, createSeededRng(42))
    const scoped = resolveFaceOff(card('rare', 'a'), card('rare', 'b'), [mkActive('matchup', 'enemies', 1)], createSeededRng(42))
    expect(scoped.roll1).toBe(base.roll1)
    expect(scoped.roll2).toBe(base.roll2 + 3)
  })

  it('scope=synergy_cards only affects cards carrying a required type', () => {
    const base = resolveFaceOff(card('rare', 'a', ['egg']), card('rare', 'b', []), undefined, createSeededRng(42))
    // owner side1 card HAS egg → buffed; if owner card lacked egg it would not be
    const scoped = resolveFaceOff(card('rare', 'a', ['egg']), card('rare', 'b', []), [mkActive('synergy_cards', 'allies', 1, ['egg'])], createSeededRng(42))
    expect(scoped.roll1).toBe(base.roll1 + 3)

    const noType = resolveFaceOff(card('rare', 'a', []), card('rare', 'b', []), [mkActive('synergy_cards', 'allies', 1, ['egg'])], createSeededRng(42))
    expect(noType.roll1).toBe(base.roll1) // owner card lacks egg → not buffed
  })

  it('unscoped (skill) effects still affect both sides', () => {
    const base = resolveFaceOff(card('rare', 'a'), card('rare', 'b'), undefined, createSeededRng(42))
    const skill: ActiveSkill = { skill: { id: 's', name: 'S', description: '', usesPerBattle: 1, effects: [makeEffect('r', 'R', 'dice_bonus', { amount: 3 }, ['dice'])] }, activatedBy: 'p1', roundActivated: 0, ownerSide: 1 }
    const r = resolveFaceOff(card('rare', 'a'), card('rare', 'b'), [skill], createSeededRng(42))
    expect(r.roll1).toBe(base.roll1 + 3)
    expect(r.roll2).toBe(base.roll2 + 3)
  })
})

describe('buildSynergyDef (loader)', () => {
  it('builds a runtime synergy from a serializable row and fires it', () => {
    const row: SynergyDefRow = {
      id: 's1', name: 'Egg', description: '',
      requirements: [{ typeId: 'egg', count: 2 }],
      effects: [{ effectRow: { key: 'dice-bonus-2', name: 'Dice +2', op: 'dice_bonus', params: { amount: 2 }, kind: ['dice'] }, scope: 'own', target: 'allies' }],
    }
    const def = buildSynergyDef(row)
    expect(def.effects.length).toBe(1)
    const active = computeActiveSynergies([{ id: 'p1', deck: deckOf([['egg'], ['egg'], [], [], []]) }], [def])
    expect(active.length).toBe(1)
    expect(active[0].skill.effects[0].scope).toBe('own')
  })

  it('skips invalid effect rows (unknown op)', () => {
    const row: SynergyDefRow = {
      id: 's2', name: 'Bad', description: '',
      requirements: [{ typeId: 'egg', count: 1 }],
      effects: [{ effectRow: { key: 'x', name: 'X', op: 'nope', params: {}, kind: [] }, scope: 'own', target: 'allies' }],
    }
    expect(buildSynergyDef(row).effects.length).toBe(0)
  })
})

describe('extra dice', () => {
  it('an extra die that rolls 0 still records a bonusRoll activation (so it shows rolling)', () => {
    const fx = makeEffect('x', 'X', 'extra_dice', { min: 0, max: 0 }, ['extraDice']) // always 0
    const as: ActiveSkill = { skill: { id: 's', name: 'S', description: '', usesPerBattle: 1, effects: [fx] }, activatedBy: 'p1', roundActivated: 0, ownerSide: 1 }
    const r = resolveFaceOff(card('rare', 'a'), card('rare', 'b'), [as], createSeededRng(42))
    const act = r.activations?.find((a) => a.effectId === 'x')
    expect(act).toBeDefined()
    const ch = act!.changes.find((c) => c.side === 1 && c.field === 'bonusRoll')
    expect(ch).toBeDefined()
    expect(ch!.after).toBe(ch!.before) // rolled 0 — recorded so the die still shows
  })

  it('a min keeps the extra die from rolling 0', () => {
    const fx = makeEffect('x', 'X', 'extra_dice', { min: 1, max: 1 }, ['extraDice'])
    const out = fx.hooks.onDice!({ card1: card('rare', 'a'), card2: card('rare', 'b'), star1: 3, star2: 3, rarity1: 'rare', rarity2: 'rare', roll1: 0, roll2: 0, bonusRoll1: 0, bonusRoll2: 0, effective1: 0, effective2: 0, damage1: 0, damage2: 0, heal1: 0, heal2: 0, rand: () => 0 })
    expect(out.bonusRoll1).toBe(1)
  })
})

describe('round-level synergy scope (S1)', () => {
  const healDef = (scope: 'own' | 'arena'): SynergyDef => ({
    id: 'h', name: 'Heal', description: '',
    requirements: [{ typeId: 'egg', count: 1 }],
    effects: [{ effect: makeEffect('heal', 'Heal', 'heal_instead', {}, ['heal']), scope, target: 'everyone' }],
  })
  const players = [playerWithDeck('p1', [['egg'], [], [], [], []]), playerWithDeck('p2', [[], [], [], [], []])]

  it('skips a round-level effect scoped below arena', () => {
    const active = computeActiveSynergies(players.map((p) => ({ id: p.id, deck: p.deck })), [healDef('own')])
    const r = precomputeRound(players, { p1: 10, p2: 10 }, 1, undefined, active, createSeededRng(1))
    expect(r.flags?.healInstead).toBeUndefined()
  })

  it('applies a round-level effect at arena scope', () => {
    const active = computeActiveSynergies(players.map((p) => ({ id: p.id, deck: p.deck })), [healDef('arena')])
    const r = precomputeRound(players, { p1: 10, p2: 10 }, 1, undefined, active, createSeededRng(1))
    expect(r.flags?.healInstead).toBe(true)
  })
})

// The live "Babies R Us" skill is composed from four existing ops (no new code):
// set_rarity_if + boost_power_if for legendary and secret_rare. Guard the
// composition so it keeps demoting only the top two rarities to 1-star commons.
describe('Babies R Us skill composition', () => {
  const babies = (): ActiveSkill => ({
    skill: {
      id: 'babies-r-us', name: 'Babies R Us', description: '', usesPerBattle: 1,
      effects: [
        makeEffect('br', 'BR', 'set_rarity_if', { ifRarity: 'legendary', toRarity: 'common' }, ['rarity']),
        makeEffect('bs', 'BS', 'set_rarity_if', { ifRarity: 'secret_rare', toRarity: 'common' }, ['rarity']),
        makeEffect('pl', 'PL', 'boost_power_if', { ifRarity: 'legendary', value: 1 }, ['power']),
        makeEffect('ps', 'PS', 'boost_power_if', { ifRarity: 'secret_rare', value: 1 }, ['power']),
      ],
    },
    activatedBy: 'p1', roundActivated: 0, ownerSide: 1,
  })

  it('drops a legendary to a 1-star common and leaves a rare untouched', () => {
    const r = resolveFaceOff(card('legendary', 'a'), card('rare', 'b'), [babies()], createSeededRng(1))
    expect(r.star1).toBe(1)
    expect(r.rarity1).toBe('common')
    expect(r.star2).toBe(3) // rare is below the threshold — unchanged
    expect(r.rarity2).toBe('rare')
  })

  it('drops a secret rare to a 1-star common', () => {
    const r = resolveFaceOff(card('secret_rare', 'a'), card('common', 'b'), [babies()], createSeededRng(1))
    expect(r.star1).toBe(1)
    expect(r.rarity1).toBe('common')
  })
})
