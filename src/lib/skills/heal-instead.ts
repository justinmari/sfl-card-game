import type { Skill } from './types'
import { FX_HEAL_INSTEAD } from '@/lib/battle-effects'

export const SKILL_HEAL_INSTEAD: Skill = {
  id: 'heal-instead',
  name: 'Fountain of Youth',
  description: 'All players heal damage taken this round instead of losing HP',
  usesPerBattle: 1,
  effects: [FX_HEAL_INSTEAD],
}
