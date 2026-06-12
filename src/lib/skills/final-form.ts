import type { Skill } from './types'

export const SKILL_FINAL_FORM: Skill = {
  id: 'final-form',
  name: 'Final Form',
  description: 'All common cards become secret rares this round — for both players',
  usesPerBattle: 1,
  effect: { type: 'promote-rarity', from: 'common', to: 'secret_rare' },
}
