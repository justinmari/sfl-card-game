import type { Skill } from './types'
import { FX_ASCEND_RARITY, FX_ASCEND_POWER } from '@/lib/battle-effects'

// Final Form is two effects: one promotes a common's rarity (and its visual
// badge) to secret rare, the other raises its base power to match.
export const SKILL_FINAL_FORM: Skill = {
  id: 'final-form',
  name: 'Final Form',
  description: 'All common cards become secret rares this round — for both players',
  usesPerBattle: 1,
  effects: [FX_ASCEND_RARITY, FX_ASCEND_POWER],
}
