import type { Skill } from './types'
import { FX_REDEAL_ALL } from '@/lib/battle-effects'

export const SKILL_GIFT_EXCHANGE: Skill = {
  id: 'gift-exchange',
  name: 'Gift Exchange',
  description: 'All cards are shuffled together and randomly dealt into new decks for this round',
  usesPerBattle: 1,
  effects: [FX_REDEAL_ALL],
}
