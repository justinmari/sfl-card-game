import type { Skill } from './types'

export const SKILL_SNAKE_EYES: Skill = {
  id: 'snake-eyes',
  name: 'Snake Eyes',
  description: 'No dice rolls this round — base stars only, for both players',
  usesPerBattle: 1,
  effect: { type: 'no-dice' },
}
