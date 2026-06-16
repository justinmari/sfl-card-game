import type { Skill } from './types'
import { FX_BIG_DICE } from '@/lib/battle-effects'

export const SKILL_UNDERDOG: Skill = {
  id: 'underdog',
  name: 'Underdog',
  description: 'Lower rarity cards roll 0-10 no matter what — for both players',
  usesPerBattle: 1,
  effects: [FX_BIG_DICE],
}
