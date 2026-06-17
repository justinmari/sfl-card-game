import type { SkillActivation } from '@/lib/battle-engine'

// One die in a card's roll: the base roll or an extra die from an effect.
export type DieInfo = {
  label: string
  range: string
  value: number
  spinMax: number
  isSynergy: boolean
  isBase: boolean
}

// Parse the upper bound out of a "0-10" style range label (fallback 6).
export const parseRangeMax = (r: string): number => {
  const m = r.match(/(\d+)\s*-\s*(\d+)/)
  return m ? Number(m[2]) : 6
}

// Display dice range for a side, derived from the two cards' star (power)
// values. The lower-rarity card rolls to catch up (range scales with the gap);
// equal rarity gets a single 0-1 tiebreaker; the higher card never rolls.
export const maxRollFor = (myStar: number, otherStar: number): number =>
  myStar < otherStar ? otherStar - myStar + 1 : myStar === otherStar ? 1 : 0

// Build the ordered dice for one side: the base roll first (labeled "Underdog"
// when this is the lower-rarity card, "Head-to-Head" on a rarity tie, or the
// skill name when a dice effect relabeled it) followed by each extra die from a
// bonusRoll change. Pure: derived from the (possibly step-sliced) activation
// trace, so the same call drives both the rolling and result views.
export function buildSideDice(
  fo: { star1: number; star2: number; roll1: number; roll2: number; activations?: SkillActivation[] },
  side: 1 | 2,
): DieInfo[] {
  const acts = fo.activations ?? []
  const baseRoll = side === 1 ? fo.roll1 : fo.roll2
  const myStar = side === 1 ? fo.star1 : fo.star2
  const otherStar = side === 1 ? fo.star2 : fo.star1
  const maxRoll = maxRollFor(myStar, otherStar)
  const dice: DieInfo[] = []
  const rollAct = acts.find(
    (a) =>
      (a.phase === 'onDiceOverride' || a.phase === 'onDice') &&
      a.changes.some((c) => c.side === side && c.field === 'roll'),
  )
  if (maxRoll > 0 || baseRoll > 0 || rollAct) {
    dice.push({
      label: rollAct ? rollAct.skillName : myStar < otherStar ? 'Underdog' : myStar === otherStar ? 'Head-to-Head' : '',
      range: rollAct?.rangeLabel ?? (maxRoll > 0 ? `0-${maxRoll}` : ''),
      value: baseRoll,
      spinMax: rollAct?.rangeLabel ? parseRangeMax(rollAct.rangeLabel) : maxRoll,
      isSynergy: rollAct ? rollAct.skillId.startsWith('synergy:') : false,
      isBase: true,
    })
  }
  for (const a of acts)
    for (const c of a.changes) {
      if (c.side === side && c.field === 'bonusRoll') {
        const v = (c.after as number) - (c.before as number)
        dice.push({
          label: a.skillName,
          range: a.rangeLabel ?? '',
          value: v,
          spinMax: a.rangeLabel ? parseRangeMax(a.rangeLabel) : Math.max(1, v),
          isSynergy: a.skillId.startsWith('synergy:'),
          isBase: false,
        })
      }
    }
  return dice
}
