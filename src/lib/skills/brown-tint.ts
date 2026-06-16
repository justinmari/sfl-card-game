import type { Skill } from './types'
import { FX_BROWN_TINT } from '@/lib/battle-effects'

export const SKILL_BROWN_TINT: Skill = {
  id: 'brown-tint',
  name: 'Muddy Waters',
  description: 'Adds a brown tint to all players\' cards this round',
  usesPerBattle: 1,
  effects: [FX_BROWN_TINT],
}
