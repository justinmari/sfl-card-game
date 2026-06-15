import type { Skill } from './types'

export const SKILL_ALL_OR_NOTHING: Skill = {
  id: 'all-or-nothing',
  name: 'All or Nothing',
  description: 'All damage this round is doubled — for both players',
  usesPerBattle: 1,
  hooks: {
    onDamage: (state) => ({
      ...state,
      damage1: Math.round(state.damage1 * 2),
      damage2: Math.round(state.damage2 * 2),
    }),
  },
}
