import type { Skill } from './types'

export const SKILL_HEAL_INSTEAD: Skill = {
  id: 'heal-instead',
  name: 'Fountain of Youth',
  description: 'All players heal damage taken this round instead of losing HP',
  usesPerBattle: 1,
  hooks: {
    onRound: (ctx) => ({
      ...ctx,
      flags: { ...ctx.flags, healInstead: true },
    }),
  },
}
