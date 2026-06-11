import type { Skill } from './types'

export const SKILL_BEATDOWN: Skill = {
  id: 'beatdown',
  name: 'Beatdown',
  description: 'Losers take 3 damage no matter the total — for both players',
  usesPerBattle: 1,
  effect: { type: 'flat-damage', damage: 3 },
}
