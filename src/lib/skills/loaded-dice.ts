import type { Skill } from './types'
import { FX_DICE_BONUS_2 } from '@/lib/battle-effects'

export const SKILL_LOADED_DICE: Skill = {
  id: 'loaded-dice',
  name: 'Loaded Dice',
  description: 'All dice rolls get +2 — for both players',
  usesPerBattle: 1,
  effects: [FX_DICE_BONUS_2],
}
