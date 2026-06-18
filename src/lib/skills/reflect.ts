import type { Skill } from './types'
import { FX_REVERSE_DAMAGE } from '@/lib/battle-effects'

export const SKILL_REFLECT: Skill = {
  id: 'reflect',
  name: 'Reflect',
  description: 'Any damage taken by either player this round is reflected back at whoever dealt it',
  usesPerBattle: 1,
  effects: [FX_REVERSE_DAMAGE],
}
