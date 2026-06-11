import type { Skill } from './types'

export const SKILL_REVERSE_UNO: Skill = {
  id: 'reverse-uno',
  name: 'Reverse Uno',
  description: 'Damage is dealt to the winner of each face-off instead',
  usesPerBattle: 1,
  effect: { type: 'reverse-damage' },
}
