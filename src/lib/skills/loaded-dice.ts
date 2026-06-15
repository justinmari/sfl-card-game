import type { Skill } from './types'

export const SKILL_LOADED_DICE: Skill = {
  id: 'loaded-dice',
  name: 'Loaded Dice',
  description: 'All dice rolls get +2 — for both players',
  usesPerBattle: 1,
  hooks: {
    onDice: (state) => ({
      ...state,
      roll1: (state.roll1 > 0 || state.star1 <= state.star2) ? state.roll1 + 2 : state.roll1,
      roll2: (state.roll2 > 0 || state.star2 <= state.star1) ? state.roll2 + 2 : state.roll2,
    }),
  },
}
