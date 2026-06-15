import type { BattleCard, BattlePlayer } from '@/lib/battle-engine'

export type FaceOffState = {
  card1: BattleCard
  card2: BattleCard
  star1: number
  star2: number
  roll1: number
  roll2: number
  effective1: number
  effective2: number
  damage1: number
  damage2: number
  rand: () => number
}

export type RoundContext = {
  players: BattlePlayer[]
  decks: Map<string, BattleCard[]>
  flags: { healInstead?: boolean; visualEffect?: string }
  rand: () => number
}

export type SkillHooks = {
  onStars?: (state: FaceOffState) => FaceOffState
  onDiceOverride?: (state: FaceOffState) => FaceOffState
  onDice?: (state: FaceOffState) => FaceOffState
  onTotals?: (state: FaceOffState) => FaceOffState
  onDamage?: (state: FaceOffState) => FaceOffState
  onRound?: (ctx: RoundContext) => RoundContext
}

export type Skill = {
  id: string
  name: string
  description: string
  usesPerBattle: number
  hooks: SkillHooks
}

export type ActiveSkill = {
  skill: Skill
  activatedBy: string
  roundActivated: number
}
