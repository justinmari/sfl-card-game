import type { Skill } from './types'

export const SKILL_BEATDOWN: Skill = {
  id: 'beatdown',
  name: 'Beatdown',
  description: 'Losers take 3 damage no matter the total — for both players',
  usesPerBattle: 1,
  hooks: {
    onDamage: (state) => ({
      ...state,
      damage1: state.damage1 > 0 ? 3 : 0,
      damage2: state.damage2 > 0 ? 3 : 0,
    }),
  },
}
