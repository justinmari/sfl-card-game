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
import type { Skill, FaceOffState, RoundContext } from '@/lib/skills'
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

  it('reveals an onStars (Final Form) star change progressively', () => {
    const skill = makeActiveSkill(SKILL_REGISTRY['final-form'], 'p1')
    const fo = resolveFaceOff(makeCard('common', 'a'), makeCard('rare', 'b'), [skill], createSeededRng(7))
    expect(faceOffAtStep(fo, 0).star1).toBe(1) // common, before Final Form
    expect(faceOffAtStep(fo, fo.activations!.length).star1).toBe(starCount['secret_rare']) // boosted
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
    expect(act!.changes.length).toBeGreaterThan(0)
    for (const ch of act!.changes) {
      expect(ch.field).toBe('effective')
      expect(ch.after).toBe(ch.before * 2)
    }
  })

  it('records rarity/power manipulation (Final Form) as onStars for common cards', () => {
    const skill = makeActiveSkill(SKILL_REGISTRY['final-form'], 'p1')
    const fo = resolveFaceOff(makeCard('common', 'a'), makeCard('rare', 'b'), [skill], createSeededRng(7))
    const act = fo.activations?.find((a) => a.skillId === 'final-form')
    expect(act).toBeDefined()
    expect(act!.phase).toBe('onStars')
    expect(act!.changes.find((c) => c.side === 1)).toMatchObject({ field: 'star', before: 1, after: starCount['secret_rare'] })
    // the rare card (side 2) is unchanged, so no side-2 change is recorded
    expect(act!.changes.find((c) => c.side === 2)).toBeUndefined()
  })

  it('produces no activations when no skills are active', () => {
    const fo = resolveFaceOff(makeCard('rare', 'a'), makeCard('common', 'b'), undefined, createSeededRng(1))
    expect(fo.activations).toBeUndefined()
  })
})

describe('Hook interface', () => {
  it('every registered skill has a hooks object with at least one hook', () => {
    for (const [id, skill] of Object.entries(SKILL_REGISTRY)) {
      expect(skill.hooks, `${id} should have hooks`).toBeDefined()
      const hookCount = Object.values(skill.hooks).filter(Boolean).length
      expect(hookCount, `${id} should have at least one hook`).toBeGreaterThan(0)
    }
  })

  it('faceoff-level skills have only faceoff hooks (onStars/onDice/onDiceOverride/onTotals/onDamage)', () => {
    const faceoffSkillIds = ['double-edge', 'loaded-dice', 'snake-eyes', 'all-or-nothing',
      'scramble', 'leveler', 'beatdown', 'reverse-uno', 'underdog', 'final-form']
    for (const id of faceoffSkillIds) {
      const skill = SKILL_REGISTRY[id]
      expect(skill.hooks.onRound, `${id} should NOT have onRound`).toBeUndefined()
    }
  })

  it('round-level skills have only onRound hooks', () => {
    const roundSkillIds = ['heal-instead', 'brown-tint', 'gift-exchange']
    for (const id of roundSkillIds) {
      const skill = SKILL_REGISTRY[id]
      expect(skill.hooks.onRound, `${id} should have onRound`).toBeDefined()
      expect(skill.hooks.onStars, `${id} should NOT have onStars`).toBeUndefined()
      expect(skill.hooks.onDice, `${id} should NOT have onDice`).toBeUndefined()
      expect(skill.hooks.onDiceOverride, `${id} should NOT have onDiceOverride`).toBeUndefined()
      expect(skill.hooks.onTotals, `${id} should NOT have onTotals`).toBeUndefined()
      expect(skill.hooks.onDamage, `${id} should NOT have onDamage`).toBeUndefined()
    }
  })

  it('dice-replacing skills use onDiceOverride, not onDice', () => {
    expect(SKILL_REGISTRY['snake-eyes'].hooks.onDiceOverride).toBeDefined()
    expect(SKILL_REGISTRY['snake-eyes'].hooks.onDice).toBeUndefined()
    expect(SKILL_REGISTRY['underdog'].hooks.onDiceOverride).toBeDefined()
    expect(SKILL_REGISTRY['underdog'].hooks.onDice).toBeUndefined()
  })

  it('dice-modifying skills use onDice, not onDiceOverride', () => {
    expect(SKILL_REGISTRY['loaded-dice'].hooks.onDice).toBeDefined()
    expect(SKILL_REGISTRY['loaded-dice'].hooks.onDiceOverride).toBeUndefined()
  })
})

describe('Phase isolation', () => {
  it('onStars hooks only affect star values', () => {
    const tripleStars: Skill = {
      id: 'test-triple', name: 'Test', description: '', usesPerBattle: 1,
      hooks: { onStars: (s) => ({ ...s, star1: s.star1 * 3, star2: s.star2 * 3 }) },
    }
    const skill = makeActiveSkill(tripleStars, 'p1')
    const r = resolveFaceOff(makeCard('common', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(r.star1).toBe(3)
    expect(r.star2).toBe(3)
  })

  it('onTotals hooks only affect effective totals', () => {
    const zeroTotals: Skill = {
      id: 'test-zero', name: 'Test', description: '', usesPerBattle: 1,
      hooks: { onTotals: (s) => ({ ...s, effective1: 0, effective2: 0 }) },
    }
    const skill = makeActiveSkill(zeroTotals, 'p1')
    const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(r.effective1).toBe(0)
    expect(r.effective2).toBe(0)
    expect(r.damage1).toBe(0)
    expect(r.damage2).toBe(0)
  })

  it('onDamage hooks only affect damage values', () => {
    const fixedDamage: Skill = {
      id: 'test-fixed', name: 'Test', description: '', usesPerBattle: 1,
      hooks: { onDamage: (s) => ({ ...s, damage1: 99, damage2: 99 }) },
    }
    const skill = makeActiveSkill(fixedDamage, 'p1')
    const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(r.damage1).toBe(99)
    expect(r.damage2).toBe(99)
    expect(r.star1).toBe(3)
    expect(r.star2).toBe(1)
  })
})

describe('Hook composability', () => {
  it('multiple onStars hooks compose in order', () => {
    const addOne: Skill = {
      id: 'add-one', name: 'Test', description: '', usesPerBattle: 1,
      hooks: { onStars: (s) => ({ ...s, star1: s.star1 + 1, star2: s.star2 + 1 }) },
    }
    const double: Skill = {
      id: 'double', name: 'Test', description: '', usesPerBattle: 1,
      hooks: { onStars: (s) => ({ ...s, star1: s.star1 * 2, star2: s.star2 * 2 }) },
    }
    const skills = [makeActiveSkill(addOne, 'p1'), makeActiveSkill(double, 'p1')]
    const r = resolveFaceOff(makeCard('common', 'a'), makeCard('common', 'b'), skills, createSeededRng(42))
    // common = 1 star. +1 = 2. *2 = 4.
    expect(r.star1).toBe(4)
    expect(r.star2).toBe(4)
  })

  it('multiple onDamage hooks compose in order', () => {
    const doubleDmg: Skill = {
      id: 'double-dmg', name: 'Test', description: '', usesPerBattle: 1,
      hooks: { onDamage: (s) => ({ ...s, damage1: s.damage1 * 2, damage2: s.damage2 * 2 }) },
    }
    const addDmg: Skill = {
      id: 'add-dmg', name: 'Test', description: '', usesPerBattle: 1,
      hooks: { onDamage: (s) => ({ ...s, damage1: s.damage1 + 1, damage2: s.damage2 + 1 }) },
    }
    const skills = [makeActiveSkill(doubleDmg, 'p1'), makeActiveSkill(addDmg, 'p1')]
    const r = resolveFaceOff(makeCard('legendary', 'a'), makeCard('common', 'b'), skills, createSeededRng(42))
    // base damage is computed from effective diff, then *2, then +1
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

describe('Custom skill — zero engine changes needed', () => {
  it('custom faceoff skill works via hooks without any engine modification', () => {
    const customSkill: Skill = {
      id: 'mirror-match',
      name: 'Mirror Match',
      description: 'Both players get the higher star value',
      usesPerBattle: 1,
      hooks: {
        onStars: (state) => {
          const maxStar = Math.max(state.star1, state.star2)
          return { ...state, star1: maxStar, star2: maxStar }
        },
      },
    }
    const skill = makeActiveSkill(customSkill, 'p1')
    const r = resolveFaceOff(makeCard('common', 'a'), makeCard('legendary', 'b'), [skill], createSeededRng(42))
    expect(r.star1).toBe(5)
    expect(r.star2).toBe(5)
  })

  it('custom round skill works via hooks without any engine modification', () => {
    const customRoundSkill: Skill = {
      id: 'shield-mode',
      name: 'Shield Mode',
      description: 'Heal instead of taking damage',
      usesPerBattle: 1,
      hooks: {
        onRound: (ctx) => ({ ...ctx, flags: { ...ctx.flags, healInstead: true } }),
      },
    }
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

  it('custom multi-phase skill hooks into multiple phases', () => {
    const crazySkill: Skill = {
      id: 'chaos',
      name: 'Chaos',
      description: 'Set all stars to 1 and double damage',
      usesPerBattle: 1,
      hooks: {
        onStars: (s) => ({ ...s, star1: 1, star2: 1 }),
        onDamage: (s) => ({ ...s, damage1: s.damage1 * 2, damage2: s.damage2 * 2 }),
      },
    }
    const skill = makeActiveSkill(crazySkill, 'p1')
    const r = resolveFaceOff(makeCard('legendary', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(r.star1).toBe(1)
    expect(r.star2).toBe(1)
  })
})

describe('FaceOffState provides card context to hooks', () => {
  it('hooks can read card rarity for conditional logic', () => {
    const rarityBonus: Skill = {
      id: 'rarity-bonus', name: 'Test', description: '', usesPerBattle: 1,
      hooks: {
        onDamage: (state) => ({
          ...state,
          damage2: state.card1.rarity === 'legendary' ? state.damage2 + 10 : state.damage2,
        }),
      },
    }
    const skill = makeActiveSkill(rarityBonus, 'p1')
    const rLeg = resolveFaceOff(makeCard('legendary', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    const rCom = resolveFaceOff(makeCard('common', 'a'), makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(rLeg.damage2).toBeGreaterThan(rCom.damage2)
  })

  it('hooks can read card name', () => {
    const namedCard = { ...makeCard('common', 'a'), name: 'Special Card' }
    const nameCheck: Skill = {
      id: 'name-check', name: 'Test', description: '', usesPerBattle: 1,
      hooks: {
        onStars: (state) => ({
          ...state,
          star1: state.card1.name === 'Special Card' ? 10 : state.star1,
        }),
      },
    }
    const skill = makeActiveSkill(nameCheck, 'p1')
    const r = resolveFaceOff(namedCard, makeCard('common', 'b'), [skill], createSeededRng(42))
    expect(r.star1).toBe(10)
  })
})

describe('onDiceOverride vs onDice interaction', () => {
  it('onDiceOverride skips base dice', () => {
    const fixedDice: Skill = {
      id: 'fixed-dice', name: 'Test', description: '', usesPerBattle: 1,
      hooks: { onDiceOverride: (s) => ({ ...s, roll1: 99, roll2: 99 }) },
    }
    const skill = makeActiveSkill(fixedDice, 'p1')
    const r = resolveFaceOff(makeCard('common', 'a'), makeCard('legendary', 'b'), [skill], createSeededRng(42))
    expect(r.roll1).toBe(99)
    expect(r.roll2).toBe(99)
  })

  it('onDice runs after onDiceOverride', () => {
    const override: Skill = {
      id: 'override', name: 'Test', description: '', usesPerBattle: 1,
      hooks: { onDiceOverride: (s) => ({ ...s, roll1: 5, roll2: 5 }) },
    }
    const modify: Skill = {
      id: 'modify', name: 'Test', description: '', usesPerBattle: 1,
      hooks: { onDice: (s) => ({ ...s, roll1: s.roll1 + 1, roll2: s.roll2 + 1 }) },
    }
    const skills = [makeActiveSkill(override, 'p1'), makeActiveSkill(modify, 'p1')]
    const r = resolveFaceOff(makeCard('common', 'a'), makeCard('common', 'b'), skills, createSeededRng(42))
    expect(r.roll1).toBe(6)
    expect(r.roll2).toBe(6)
  })

  it('onDice runs after base dice when no override', () => {
    const addTwo: Skill = {
      id: 'add-two', name: 'Test', description: '', usesPerBattle: 1,
      hooks: { onDice: (s) => ({ ...s, roll1: s.roll1 + 2, roll2: s.roll2 + 2 }) },
    }
    const skill = makeActiveSkill(addTwo, 'p1')
    const base = resolveFaceOff(makeCard('common', 'a'), makeCard('rare', 'b'), undefined, createSeededRng(42))
    const with_ = resolveFaceOff(makeCard('common', 'a'), makeCard('rare', 'b'), [skill], createSeededRng(42))
    expect(with_.roll1).toBe(base.roll1 + 2)
  })
})
