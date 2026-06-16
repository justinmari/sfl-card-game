import type { Skill } from './types'
import { FX_ZERO_DICE } from '@/lib/battle-effects'

export const SKILL_SNAKE_EYES: Skill = {
  id: 'snake-eyes',
  name: 'Snake Eyes',
  description: 'No dice rolls this round — base stars only, for both players',
  usesPerBattle: 1,
  effects: [FX_ZERO_DICE],
}
