import type { Skill } from './types'

const starCount: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, ultra_rare: 4, legendary: 5, secret_rare: 6,
}

export const SKILL_FINAL_FORM: Skill = {
  id: 'final-form',
  name: 'Final Form',
  description: 'All common cards become secret rares this round — for both players',
  usesPerBattle: 1,
  hooks: {
    onStars: (state) => ({
      ...state,
      star1: state.card1.rarity === 'common' ? (starCount['secret_rare'] || state.star1) : state.star1,
      star2: state.card2.rarity === 'common' ? (starCount['secret_rare'] || state.star2) : state.star2,
    }),
  },
}
