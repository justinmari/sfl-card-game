import type { Skill } from './types'
import { FX_FLAT_DAMAGE_3 } from '@/lib/battle-effects'

export const SKILL_BEATDOWN: Skill = {
  id: 'beatdown',
  name: 'Beatdown',
  description: 'Losers take 3 damage no matter the total — for both players',
  usesPerBattle: 1,
  effects: [FX_FLAT_DAMAGE_3],
}
