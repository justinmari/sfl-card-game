import type { Skill } from './types'

export const SKILL_BROWN_TINT: Skill = {
  id: 'brown-tint',
  name: 'Muddy Waters',
  description: 'Adds a brown tint to all players\' cards this round',
  usesPerBattle: 1,
  hooks: {
    onRound: (ctx) => ({
      ...ctx,
      flags: { ...ctx.flags, visualEffect: 'sepia(0.8) brightness(0.85)' },
    }),
  },
}
