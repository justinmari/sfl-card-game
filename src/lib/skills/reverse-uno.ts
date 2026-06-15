import type { Skill } from './types'

export const SKILL_REVERSE_UNO: Skill = {
  id: 'reverse-uno',
  name: 'Reverse Uno',
  description: 'Damage is dealt to the winner of each face-off instead',
  usesPerBattle: 1,
  hooks: {
    onDamage: (state) => ({
      ...state,
      damage1: state.damage2,
      damage2: state.damage1,
    }),
  },
}
