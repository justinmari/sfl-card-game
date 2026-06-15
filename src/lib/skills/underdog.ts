import type { Skill } from './types'

export const SKILL_UNDERDOG: Skill = {
  id: 'underdog',
  name: 'Underdog',
  description: 'Lower rarity cards roll 0-10 no matter what — for both players',
  usesPerBattle: 1,
  hooks: {
    onDiceOverride: (state) => {
      let { roll1, roll2 } = state
      if (state.star1 < state.star2) {
        roll1 = Math.floor(state.rand() * 11)
      } else if (state.star2 < state.star1) {
        roll2 = Math.floor(state.rand() * 11)
      } else {
        roll1 = Math.floor(state.rand() * 11)
        roll2 = Math.floor(state.rand() * 11)
      }
      return { ...state, roll1, roll2 }
    },
  },
}
