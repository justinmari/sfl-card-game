import type { Skill } from './types'

export const SKILL_LEVELER: Skill = {
  id: 'leveler',
  name: 'Leveler',
  description: 'All cards are treated as commons — pure dice rolls for both',
  usesPerBattle: 1,
  effect: { type: 'leveler', rarity: 'common' },
}
