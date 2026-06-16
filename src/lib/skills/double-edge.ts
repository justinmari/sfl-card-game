import type { Skill } from './types'
import { FX_DOUBLE_TOTALS } from '@/lib/battle-effects'

export const SKILL_DOUBLE_EDGE: Skill = {
  id: 'double-edge',
  name: 'Double Edge',
  description: 'All totals are doubled this round — for both players',
  usesPerBattle: 1,
  effects: [FX_DOUBLE_TOTALS],
}
