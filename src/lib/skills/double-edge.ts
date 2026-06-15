import type { Skill } from './types'

export const SKILL_DOUBLE_EDGE: Skill = {
  id: 'double-edge',
  name: 'Double Edge',
  description: 'All totals are doubled this round — for both players',
  usesPerBattle: 1,
  hooks: {
    onTotals: (state) => ({
      ...state,
      effective1: Math.round(state.effective1 * 2),
      effective2: Math.round(state.effective2 * 2),
    }),
  },
}
