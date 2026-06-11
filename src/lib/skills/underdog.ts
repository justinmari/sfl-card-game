import type { Skill } from './types'

export const SKILL_UNDERDOG: Skill = {
  id: 'underdog',
  name: 'Underdog',
  description: 'Lower rarity cards roll 0-10 no matter what — for both players',
  usesPerBattle: 1,
  effect: { type: 'big-dice', range: 10 },
}
