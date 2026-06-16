import type { Skill, EffectKind } from './skills'
import { starCount } from './battle-engine'

// Re-export so existing consumers can keep importing EffectKind from here.
export type { EffectKind } from './skills'

// Ordered list of what a skill manipulates, taken straight from the battle
// effects it composes (deduped, order preserved). Falls back to 'power'.
export function skillEffectKinds(skill: Skill): EffectKind[] {
  const kinds = skill.effects.flatMap((e) => e.kind)
  return kinds.length > 0 ? Array.from(new Set(kinds)) : ['power']
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
