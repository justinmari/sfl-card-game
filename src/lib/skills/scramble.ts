import type { Skill } from './types'

const allRarities = ['common', 'uncommon', 'rare', 'ultra_rare', 'legendary', 'secret_rare']
const starCount: Record<string, number> = {
  common: 1, uncommon: 2, rare: 3, ultra_rare: 4, legendary: 5, secret_rare: 6,
}

export const SKILL_SCRAMBLE: Skill = {
  id: 'scramble',
  name: 'Scramble',
  description: 'All card rarities are randomized — for both players',
  usesPerBattle: 1,
  hooks: {
    onStars: (state) => {
      const r1 = allRarities[Math.floor(state.rand() * allRarities.length)]
      const r2 = allRarities[Math.floor(state.rand() * allRarities.length)]
      return { ...state, star1: starCount[r1] || 1, star2: starCount[r2] || 1 }
    },
  },
}
