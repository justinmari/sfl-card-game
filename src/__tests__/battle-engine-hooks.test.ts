import { describe, it, expect } from 'vitest'
import {
  resolveFaceOff,
  precomputeRound,
  faceOffAtStep,
  starCount,
  type BattleCard,
  type BattlePlayer,
  type ActiveSkill,
} from '@/lib/battle-engine'
import type { Skill, BattleEffectHooks, EffectKind } from '@/lib/skills'
import { SKILL_REGISTRY } from '@/lib/skills'
import { createSeededRng } from '@/lib/seeded-random'

const makeCard = (rarity: string, id: string): BattleCard => ({
  id, name: `Test ${rarity}`, image_url: null, rarity, creature_name: null,
})

const makePlayer = (id: string, rarity: string, hp: number = 10): BattlePlayer => ({
  id, name: `Player ${id}`, avatar_url: null,
  deck: Array.from({ length: 5 }, (_, i) => makeCard(rarity, `${id}-card-${i}`)),
  hp, eliminated: false,
})

const makeActiveSkill = (skill: Skill, activatedBy: string): ActiveSkill => ({
  skill, activatedBy, roundActivated: 1,
})

// Build a one-effect test skill from a hook bundle.
const fxSkill = (id: string, hooks: BattleEffectHooks, kind: EffectKind[] = ['power']): Skill => ({
  id, name: 'Test', description: '', usesPerBattle: 1,
  effects: [{ id: `${id}-fx`, name: 'Test FX', kind, hooks }],
})

// All hook names defined across a skill's effects.
const skillHookNames = (skill: Skill): Set<string> =>
  new Set(skill.effects.flatMap((e) => Object.keys(e.hooks).filter((k) => e.hooks[k as keyof BattleEffectHooks])))

describe('faceOffAtStep (stepped reveal)', () => {
  it('step 0 is the pre-skill base; the final step is the full face-off', () => {
    const skill = makeActiveSkill(SKILL_REGISTRY['double-edge'], 'p1') // onTotals: doubles effective
    const fo = resolveFaceOff(makeCard('rare', 'a'), makeCard('rare', 'b'), [skill], createSeededRng(42))
    expect(fo.activations?.length).toBe(1)

    const base = faceOffAtStep(fo, 0)
    expect(base.activations).toEqual([])
    expect(base.effective1).toBe(base.star1 + base.roll1) // pre-double total
    expect(base.effective2).toBe(base.star2 + base.roll2)

    const final = faceOffAtStep(fo, fo.activations!.length)
    expect(final.effective1).toBe(fo.effective1) // doubled
    expect(final.activations?.length).toBe(1)
  })

  it('reveals Final Form rarity + power changes progressively', () => {
    const skill = makeActiveSkill(SKILL_REGISTRY['final-form'], 'p1')
    const fo = resolveFaceOff(makeCard('common', 'a'), makeCard('rare', 'b'), [skill], createSeededRng(7))
    const base = faceOffAtStep(fo, 0)
    expect(base.star1).toBe(1) // common, before Final Form
    expect(base.rarity1).toBe('common')
    const final = faceOffAtStep(fo, fo.activations!.length)
    expect(final.star1).toBe(starCount['secret_rare']) // power boosted
    expect(final.rarity1).toBe('secret_rare') // rarity promoted
  })

  it('returns the same face-off unchanged when there are no activations', () => {
    const fo = resolveFaceOff(makeCard('rare', 'a'), makeCard('common', 'b'), undefined, createSeededRng(1))
    expect(faceOffAtStep(fo, 0)).toBe(fo)
    expect(faceOffAtStep(fo, 5)).toBe(fo)
  })
})

describe('Skill activation trace', () => {
  it('records total manipulation (Double Edge) as onTotals with doubled effective', () => {
    const skill = makeActiveSkill(SKILL_REGISTRY['double-edge'], 'p1')
    const fo = resolveFaceOff(makeCard('rare', 'a'), makeCard('rare', 'b'), [skill], createSeededRng(42))
    const act = fo.activations?.find((a) => a.skillId === 'double-edge')
    expect(act).toBeDefined()
    expect(act!.phase).toBe('onTotals')
    expect(act!.kind).toEqual(['total'])
    expect(act!.changes.length).toBeGreaterThan(0)
    for (const ch of act!.changes) {
      expect(ch.field).toBe('effective')
      expect(ch.after).toBe((ch.before as number) * 2)
    }
  })

  it('records Final Form as two onStars effects (rarity + power) for common cards', () => {
    const skill = makeActiveSkill(SKILL_REGISTRY['final-form'], 'p1')
    const fo = resolveFaceOff(makeCard('common', 'a'), makeCard('rare', 'b'), [skill], createSeededRng(7))
    const acts = fo.activations?.filter((a) => a.skillId === 'final-form') ?? []
    expect(acts.length).toBe(2)
    const rarityAct = acts.find((a) => a.effectId === 'ascend-rarity')
    const powerAct = acts.find((a) => a.effectId === 'ascend-power')
    expect(rarityAct!.phase).toBe('onStars')
    expect(rarityAct!.kind).toEqual(['rarity'])
    expect(powerAct!.kind).toEqual(['power'])
    expect(rarityAct!.changes.find((c) => c.side === 1)).toMatchObject({ field: 'rarity', before: 'common', after: 'secret_rare' })
    expect(powerAct!.changes.find((c) => c.side === 1)).toMatchObject({ field: 'star', before: 1, after: starCount['secret_rare'] })
    // the rare card (side 2) is unchanged, so no side-2 change is recorded
    expect(rarityAct!.changes.find((c) => c.side === 2)).toBeUndefined()
    expect(powerAct!.changes.find((c) => c.side === 2)).toBeUndefined()
  })

  it('produces no activations when no skills are active', () => {
    const fo = resolveFaceOff(makeCard('rare', 'a'), makeCard('common', 'b'), undefined, createSeededRng(1))
    expect(fo.activations).toBeUndefined()
  })
})

describe('Effect interface', () => {
  it('every registered skill has at least one effect with at least one hook', () => {
    for (const [id, skill] of Object.entries(SKILL_REGISTRY)) {
      expect(skill.effects.length, `${id} should have effects`).toBeGreaterThan(0)
      expect(skillHookNames(skill).size, `${id} should have at least one hook`).toBeGreaterThan(0)
    }
  })

  it('faceoff-level skills have only faceoff hooks (no onRound)', () => {
    const faceoffSkillIds = ['double-edge', 'loaded-dice', 'snake-eyes', 'all-or-nothing',
      'scramble', 'leveler', 'beatdown', 'reverse-uno', 'underdog', 'final-form']
    for (const id of faceoffSkillIds) {
      expect(skillHookNames(SKILL_REGISTRY[id]).has('onRound'), `${id} should NOT have onRound`).toBe(false)
    }
  })

  it('round-level skills have only onRound hooks', () => {
    const roundSkillIds = ['heal-instead', 'brown-tint', 'gift-exchange']
    for (const id of roundSkillIds) {
      const names = skillHookNames(SKILL_REGISTRY[id])
      expect(names.has('onRound'), `${id} should have onRound`).toBe(true)
      for (const faceoffHook of ['onStars', 'onDice', 'onDiceOverride', 'onTotals', 'onDamage']) {
        expect(names.has(faceoffHook), `${id} should NOT have ${faceoffHook}`).toBe(false)
      }
    }
  })

  it('dice-replacing skills use onDiceOverride, not onDice', () => {
    for (const id of ['snake-eyes', 'underdog']) {
      const names = skillHookNames(SKILL_REGISTRY[id])
      expect(names.has('onDiceOverride')).toBe(true)
      expect(names.has('onDice')).toBe(false)
    }
  })

  it('dice-modifying skills use onDice, not onDiceOverride', () => {
    const names = skillHookNames(SKILL_REGISTRY['loaded-dice'])
    expect(names.has('onDice')).toBe(true)
    expect(names.has('onDiceOverride')).toBe(false)
  })
})

describe('Phase isolation', () => {
  it('onStars hooks only affect star values', () => {
    const skill = makeActiveSkill(fxSkill('test-triple', { onStars: (s) => ({ ...s, star1: s.star1 * 3, star2: s.star2 * 3 }) }), 'p1')
    const r = resolveFaceOff(makeCard('common', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(r.star1).toBe(3)
    expect(r.star2).toBe(3)
  })

  it('onTotals hooks only affect effective totals', () => {
    const skill = makeActiveSkill(fxSkill('test-zero', { onTotals: (s) => ({ ...s, effective1: 0, effective2: 0 }) }, ['total']), 'p1')
    const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(r.effective1).toBe(0)
    expect(r.effective2).toBe(0)
    expect(r.damage1).toBe(0)
    expect(r.damage2).toBe(0)
  })

  it('onDamage hooks only affect damage values', () => {
    const skill = makeActiveSkill(fxSkill('test-fixed', { onDamage: (s) => ({ ...s, damage1: 99, damage2: 99 }) }, ['damage']), 'p1')
    const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(r.damage1).toBe(99)
    expect(r.damage2).toBe(99)
    expect(r.star1).toBe(3)
    expect(r.star2).toBe(1)
  })
})

describe('Hook composability', () => {
  it('multiple onStars hooks compose in order', () => {
    const addOne = fxSkill('add-one', { onStars: (s) => ({ ...s, star1: s.star1 + 1, star2: s.star2 + 1 }) })
    const double = fxSkill('double', { onStars: (s) => ({ ...s, star1: s.star1 * 2, star2: s.star2 * 2 }) })
    const skills = [makeActiveSkill(addOne, 'p1'), makeActiveSkill(double, 'p1')]
    const r = resolveFaceOff(makeCard('common', 'a'), makeCard('common', 'b'), skills, createSeededRng(42))
    // common = 1 star. +1 = 2. *2 = 4.
    expect(r.star1).toBe(4)
    expect(r.star2).toBe(4)
  })

  it('multiple onDamage hooks compose in order', () => {
    const doubleDmg = fxSkill('double-dmg', { onDamage: (s) => ({ ...s, damage1: s.damage1 * 2, damage2: s.damage2 * 2 }) }, ['damage'])
    const addDmg = fxSkill('add-dmg', { onDamage: (s) => ({ ...s, damage1: s.damage1 + 1, damage2: s.damage2 + 1 }) }, ['damage'])
    const skills = [makeActiveSkill(doubleDmg, 'p1'), makeActiveSkill(addDmg, 'p1')]
    const r = resolveFaceOff(makeCard('legendary', 'a'), makeCard('common', 'b'), skills, createSeededRng(42))
    const baseResult = resolveFaceOff(makeCard('legendary', 'a'), makeCard('common', 'b'), undefined, createSeededRng(42))
    expect(r.damage2).toBe(baseResult.damage2 * 2 + 1)
  })

  it('onRound hooks compose — multiple round skills set multiple flags', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'rare')]
    const hp = { a: 5, b: 5 }
    const healSkill = makeActiveSkill(SKILL_REGISTRY['heal-instead'], 'a')
    const tintSkill = makeActiveSkill(SKILL_REGISTRY['brown-tint'], 'b')
    const result = precomputeRound(players, hp, 1, undefined, [healSkill, tintSkill], createSeededRng(42))
    expect(result.flags?.healInstead).toBe(true)
    expect(result.flags?.visualEffect).toBe('sepia(0.8) brightness(0.85)')
  })
})

describe('Custom skill — composes battle effects, zero engine changes', () => {
  it('custom faceoff skill works via an effect without any engine modification', () => {
    const customSkill = fxSkill('mirror-match', {
      onStars: (state) => {
        const maxStar = Math.max(state.star1, state.star2)
        return { ...state, star1: maxStar, star2: maxStar }
      },
    })
    const skill = makeActiveSkill(customSkill, 'p1')
    const r = resolveFaceOff(makeCard('common', 'a'), makeCard('legendary', 'b'), [skill], createSeededRng(42))
    expect(r.star1).toBe(5)
    expect(r.star2).toBe(5)
  })

  it('custom round skill works via an effect without any engine modification', () => {
    const customRoundSkill = fxSkill('shield-mode', { onRound: (ctx) => ({ ...ctx, flags: { ...ctx.flags, healInstead: true } }) }, ['heal'])
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common')]
    const hp = { a: 3, b: 3 }
    const skill = makeActiveSkill(customRoundSkill, 'a')
    const result = precomputeRound(players, hp, 1, undefined, [skill], createSeededRng(42))
    expect(result.flags?.healInstead).toBe(true)
    const match = result.matches[0]
    const finalSnap = match.hpSnapshots[match.hpSnapshots.length - 1]
    for (const v of Object.values(finalSnap)) {
      expect(v).toBeGreaterThanOrEqual(3)
    }
  })

  it('a single skill can compose multiple effects across phases', () => {
    const multiEffectSkill: Skill = {
      id: 'chaos', name: 'Chaos', description: 'Set all stars to 1 and double damage', usesPerBattle: 1,
      effects: [
        { id: 'level', name: 'Level', kind: ['power'], hooks: { onStars: (s) => ({ ...s, star1: 1, star2: 1 }) } },
        { id: 'dbl', name: 'Double', kind: ['damage'], hooks: { onDamage: (s) => ({ ...s, damage1: s.damage1 * 2, damage2: s.damage2 * 2 }) } },
      ],
    }
    const skill = makeActiveSkill(multiEffectSkill, 'p1')
    const r = resolveFaceOff(makeCard('legendary', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(r.star1).toBe(1)
    expect(r.star2).toBe(1)
  })
})

describe('FaceOffState provides card context to effect hooks', () => {
  it('hooks can read card rarity for conditional logic', () => {
    const rarityBonus = fxSkill('rarity-bonus', {
      onDamage: (state) => ({
        ...state,
        damage2: state.card1.rarity === 'legendary' ? state.damage2 + 10 : state.damage2,
      }),
    }, ['damage'])
    const skill = makeActiveSkill(rarityBonus, 'p1')
    const rLeg = resolveFaceOff(makeCard('legendary', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    const rCom = resolveFaceOff(makeCard('common', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(rLeg.damage2).toBeGreaterThan(rCom.damage2)
  })

  it('hooks can read card name', () => {
    const namedCard = { ...makeCard('common', 'a'), name: 'Special Card' }
    const nameCheck = fxSkill('name-check', {
      onStars: (state) => ({ ...state, star1: state.card1.name === 'Special Card' ? 10 : state.star1 }),
    })
    const skill = makeActiveSkill(nameCheck, 'p1')
    const r = resolveFaceOff(namedCard, makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(r.star1).toBe(10)
  })
})

describe('onDiceOverride vs onDice interaction', () => {
  it('onDiceOverride skips base dice', () => {
    const fixedDice = fxSkill('fixed-dice', { onDiceOverride: (s) => ({ ...s, roll1: 99, roll2: 99 }) }, ['dice'])
    const skill = makeActiveSkill(fixedDice, 'p1')
    const r = resolveFaceOff(makeCard('common', 'a'), makeCard('legendary', 'b'), [skill], createSeededRng(42))
    expect(r.roll1).toBe(99)
    expect(r.roll2).toBe(99)
  })

  it('onDice runs after onDiceOverride', () => {
    const override = fxSkill('override', { onDiceOverride: (s) => ({ ...s, roll1: 5, roll2: 5 }) }, ['dice'])
    const modify = fxSkill('modify', { onDice: (s) => ({ ...s, roll1: s.roll1 + 1, roll2: s.roll2 + 1 }) }, ['dice'])
    const skills = [makeActiveSkill(override, 'p1'), makeActiveSkill(modify, 'p1')]
    const r = resolveFaceOff(makeCard('common', 'a'), makeCard('common', 'b'), skills, createSeededRng(42))
    expect(r.roll1).toBe(6)
    expect(r.roll2).toBe(6)
  })

  it('onDice runs after base dice when no override', () => {
    const addTwo = fxSkill('add-two', { onDice: (s) => ({ ...s, roll1: s.roll1 + 2, roll2: s.roll2 + 2 }) }, ['dice'])
    const skill = makeActiveSkill(addTwo, 'p1')
    const base = resolveFaceOff(makeCard('common', 'a'), makeCard('rare', 'b'), undefined, createSeededRng(42))
    const with_ = resolveFaceOff(makeCard('common', 'a'), makeCard('rare', 'b'), [skill], createSeededRng(42))
    expect(with_.roll1).toBe(base.roll1 + 2)
  })
})
