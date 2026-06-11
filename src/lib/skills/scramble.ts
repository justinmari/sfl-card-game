import type { Skill } from './types'

export const SKILL_SCRAMBLE: Skill = {
  id: 'scramble',
  name: 'Scramble',
  description: 'All card rarities are randomized — for both players',
  usesPerBattle: 1,
  effect: { type: 'scramble-rarities' },
}
