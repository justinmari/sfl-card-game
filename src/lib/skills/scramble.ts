import type { Skill } from './types'
import { FX_RANDOMIZE_RARITY } from '@/lib/battle-effects'

export const SKILL_SCRAMBLE: Skill = {
  id: 'scramble',
  name: 'Scramble',
  description: 'All card rarities are randomized — for both players',
  usesPerBattle: 1,
  effects: [FX_RANDOMIZE_RARITY],
}
