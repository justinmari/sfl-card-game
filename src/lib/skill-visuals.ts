import type { Skill } from './skills'
import { starCount } from './battle-engine'

// What kind of thing a skill manipulates — drives the battle animation, NOT the
// specific skill. All skills of a kind animate the same way (in sequence), each
// labeled with its own name.
export type EffectKind =
  | 'deck'      // reshuffles/re-deals the deck (animated pre-round)
  | 'rarity'    // changes a card's rarity (badge/border morph)
  | 'power'     // changes a card's base ⭐ power (number tick)
  | 'dice'      // changes the dice roll value (during rolling)
  | 'extraDice' // adds extra dice rolls (extra die appears) — for future skills
  | 'total'     // changes the effective total (grows/shrinks at merge)
  | 'damage'    // changes damage dealt (at result)
  | 'heal'      // converts damage to healing
  | 'visual'    // cosmetic only (e.g. tint) — already applied via cardFilter

// Some skills need explicit kinds because the engine hook alone is ambiguous:
// an onStars change could be a rarity change, a base-power change, or both.
const EXPLICIT: Record<string, EffectKind[]> = {
  'final-form': ['rarity', 'power'], // commons become secret rares (rarity + power)
  'scramble': ['rarity', 'power'],   // randomizes rarity (and thus power)
  'leveler': ['power'],              // flattens base power to common-level
  'gift-exchange': ['deck'],
  'heal-instead': ['heal'],
  'brown-tint': ['visual'],
}

// Ordered list of what a skill manipulates. Explicit entries win; otherwise we
// derive from the hooks the skill defines (unambiguous for dice/total/damage).
export function skillEffectKinds(skill: Skill): EffectKind[] {
  if (EXPLICIT[skill.id]) return EXPLICIT[skill.id]
  const h = skill.hooks
  const kinds: EffectKind[] = []
  if (h.onDiceOverride || h.onDice) kinds.push('dice')
  if (h.onStars) kinds.push('power')
  if (h.onTotals) kinds.push('total')
  if (h.onDamage) kinds.push('damage')
  if (h.onRound) kinds.push('deck')
  return kinds.length > 0 ? kinds : ['power']
}

// Reverse-map a star/power value back to the rarity it represents, so a rarity
// change can show the new rarity derived from the post-skill star value.
const STAR_TO_RARITY: Record<number, string> = Object.fromEntries(
  Object.entries(starCount).map(([rarity, stars]) => [stars, rarity]),
)
export function rarityForStars(stars: number): string | null {
  return STAR_TO_RARITY[stars] ?? null
}

// The phase at which each kind becomes visible in the face-off timeline.
export const KIND_PHASE: Record<EffectKind, 'pre' | 'power' | 'rolling' | 'merge' | 'result'> = {
  deck: 'pre',
  rarity: 'power',
  power: 'power',
  dice: 'rolling',
  extraDice: 'rolling',
  total: 'merge',
  damage: 'result',
  heal: 'result',
  visual: 'power',
}
