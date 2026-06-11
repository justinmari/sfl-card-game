import type { Skill } from './types'

export const SKILL_LOADED_DICE: Skill = {
  id: 'loaded-dice',
  name: 'Loaded Dice',
  description: 'All dice rolls get +2 — for both players',
  usesPerBattle: 1,
  effect: { type: 'dice-bonus', bonus: 2, target: 'both' },
}
