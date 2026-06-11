import type { Skill } from './types'

export const SKILL_ALL_OR_NOTHING: Skill = {
  id: 'all-or-nothing',
  name: 'All or Nothing',
  description: 'All damage this round is doubled — for both players',
  usesPerBattle: 1,
  effect: { type: 'multiply-damage', factor: 2, target: 'both' },
}
