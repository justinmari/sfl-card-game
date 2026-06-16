import type { Skill } from './types'
import { FX_DOUBLE_DAMAGE } from '@/lib/battle-effects'

export const SKILL_ALL_OR_NOTHING: Skill = {
  id: 'all-or-nothing',
  name: 'All or Nothing',
  description: 'All damage this round is doubled — for both players',
  usesPerBattle: 1,
  effects: [FX_DOUBLE_DAMAGE],
}
