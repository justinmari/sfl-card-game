import { describe, it, expect } from 'vitest'
import { buildSideDice, maxRollFor, parseRangeMax } from '@/lib/dice-display'
import type { SkillActivation } from '@/lib/battle-engine'

const fo = (over: Partial<{ star1: number; star2: number; roll1: number; roll2: number; activations: SkillActivation[] }> = {}) => ({
  star1: 3, star2: 3, roll1: 0, roll2: 0, ...over,
})

const rollAct = (side: 1 | 2, skillId: string, skillName: string, rangeLabel?: string): SkillActivation => ({
  skillId, skillName, effectId: 'e', kind: ['dice'], phase: 'onDice',
  changes: [{ side, field: 'roll', before: 0, after: 5 }], rangeLabel,
})

const bonusAct = (side: 1 | 2, skillId: string, skillName: string, before: number, after: number, rangeLabel?: string): SkillActivation => ({
  skillId, skillName, effectId: 'b', kind: ['extraDice'], phase: 'onDice',
  changes: [{ side, field: 'bonusRoll', before, after }], rangeLabel,
})

describe('maxRollFor', () => {
  it('lower rarity rolls a range that scales with the star gap', () => {
    expect(maxRollFor(1, 3)).toBe(3) // gap of 2 → 0-3
    expect(maxRollFor(2, 3)).toBe(2)
  })
  it('equal rarity gets a single 0-1 tiebreaker', () => {
    expect(maxRollFor(3, 3)).toBe(1)
  })
  it('higher rarity never rolls', () => {
    expect(maxRollFor(5, 2)).toBe(0)
  })
})

describe('parseRangeMax', () => {
  it('reads the upper bound of a range label', () => {
    expect(parseRangeMax('0-10')).toBe(10)
    expect(parseRangeMax('1-3')).toBe(3)
  })
  it('falls back to 6 when there is no range', () => {
    expect(parseRangeMax('+2')).toBe(6)
    expect(parseRangeMax('')).toBe(6)
  })
})

describe('buildSideDice — base/underdog roll labeling', () => {
  it('labels the lower-rarity card "Underdog" with a gap-scaled range', () => {
    const dice = buildSideDice(fo({ star1: 1, star2: 4, roll1: 2 }), 1)
    expect(dice).toHaveLength(1)
    expect(dice[0]).toMatchObject({ label: 'Underdog', range: '0-4', value: 2, isBase: true, isSynergy: false })
  })

  it('still shows the underdog die when it rolls 0', () => {
    const dice = buildSideDice(fo({ star1: 1, star2: 4, roll1: 0 }), 1)
    expect(dice).toHaveLength(1)
    expect(dice[0]).toMatchObject({ label: 'Underdog', value: 0 })
  })

  it('labels an equal-rarity roll "Head-to-Head" (0-1)', () => {
    const dice = buildSideDice(fo({ star1: 3, star2: 3, roll1: 1 }), 1)
    expect(dice[0]).toMatchObject({ label: 'Head-to-Head', range: '0-1', value: 1, isBase: true })
  })

  it('gives the higher-rarity card no die (it does not roll)', () => {
    const dice = buildSideDice(fo({ star1: 4, star2: 1, roll1: 0 }), 1)
    expect(dice).toHaveLength(0)
  })

  it('the same face-off labels each side correctly (underdog vs higher)', () => {
    const f = fo({ star1: 1, star2: 4, roll1: 3, roll2: 0 })
    expect(buildSideDice(f, 1)[0].label).toBe('Underdog') // lower card
    expect(buildSideDice(f, 2)).toHaveLength(0) // higher card — no die
  })
})

describe('buildSideDice — skill relabeling of the base roll', () => {
  it('uses the skill name and its range when a dice effect changed the roll', () => {
    const dice = buildSideDice(fo({ star1: 1, star2: 4, roll1: 7, activations: [rollAct(1, 'skill:underdog', 'Underdog Skill', '0-10')] }), 1)
    expect(dice[0]).toMatchObject({ label: 'Underdog Skill', range: '0-10', spinMax: 10, isSynergy: false, isBase: true })
  })

  it('flags a synergy-sourced roll as a synergy', () => {
    const dice = buildSideDice(fo({ star1: 3, star2: 3, roll1: 4, activations: [rollAct(1, 'synergy:egg-roll', 'Egg Roll', '0-5')] }), 1)
    expect(dice[0].isSynergy).toBe(true)
    expect(dice[0].label).toBe('Egg Roll')
  })
})

describe('buildSideDice — extra dice from bonusRoll', () => {
  it('adds one extra die per bonusRoll change, after the base die', () => {
    const dice = buildSideDice(fo({ star1: 1, star2: 4, roll1: 2, activations: [bonusAct(1, 'synergy:egg', 'Egg Roll', 0, 3, '0-5')] }), 1)
    expect(dice).toHaveLength(2)
    expect(dice[0].isBase).toBe(true)
    expect(dice[1]).toMatchObject({ label: 'Egg Roll', value: 3, spinMax: 5, isSynergy: true, isBase: false })
  })

  it('shows an extra die even when it rolled 0 (before === after)', () => {
    const dice = buildSideDice(fo({ star1: 3, star2: 3, activations: [bonusAct(1, 'synergy:egg', 'Egg Roll', 2, 2)] }), 1)
    const extra = dice.find((d) => !d.isBase)
    expect(extra).toBeDefined()
    expect(extra!.value).toBe(0)
    expect(extra!.spinMax).toBe(1) // Math.max(1, 0) so the die still spins
  })

  it('renders multiple egg cards as separate sequential dice', () => {
    const acts = [bonusAct(1, 'synergy:egg', 'Egg Roll', 0, 2), bonusAct(1, 'synergy:egg', 'Egg Roll', 2, 5)]
    const dice = buildSideDice(fo({ star1: 3, star2: 3, activations: acts }), 1)
    const extras = dice.filter((d) => !d.isBase)
    expect(extras.map((d) => d.value)).toEqual([2, 3])
  })

  it('only attributes a bonusRoll change to the side it belongs to', () => {
    const dice2 = buildSideDice(fo({ star1: 3, star2: 3, activations: [bonusAct(1, 'synergy:egg', 'Egg Roll', 0, 3)] }), 2)
    expect(dice2.filter((d) => !d.isBase)).toHaveLength(0)
  })
})
