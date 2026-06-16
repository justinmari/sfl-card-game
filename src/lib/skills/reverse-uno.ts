import type { Skill } from './types'
import { FX_REVERSE_DAMAGE } from '@/lib/battle-effects'

export const SKILL_REVERSE_UNO: Skill = {
  id: 'reverse-uno',
  name: 'Reverse Uno',
  description: 'Damage is dealt to the winner of each face-off instead',
  usesPerBattle: 1,
  effects: [FX_REVERSE_DAMAGE],
}
