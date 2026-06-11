import type { Skill } from './types'

export const SKILL_DOUBLE_EDGE: Skill = {
  id: 'double-edge',
  name: 'Double Edge',
  description: 'All totals are doubled this round — for both players',
  usesPerBattle: 1,
  effect: { type: 'multiply-totals', factor: 2, target: 'both' },
}
