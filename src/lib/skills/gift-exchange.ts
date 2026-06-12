import type { Skill } from './types'

export const SKILL_GIFT_EXCHANGE: Skill = {
  id: 'gift-exchange',
  name: 'Gift Exchange',
  description: 'All cards are shuffled together and randomly dealt into new decks for this round',
  usesPerBattle: 1,
  effect: { type: 'gift-exchange' },
}
