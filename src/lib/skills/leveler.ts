import type { Skill } from './types'
import { FX_LEVEL_POWER } from '@/lib/battle-effects'

export const SKILL_LEVELER: Skill = {
  id: 'leveler',
  name: 'Leveler',
  description: 'All cards are treated as commons — pure dice rolls for both',
  usesPerBattle: 1,
  effects: [FX_LEVEL_POWER],
}
