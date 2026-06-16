import type { BattleCard, BattlePlayer } from '@/lib/battle-engine'

export type FaceOffState = {
  card1: BattleCard
  card2: BattleCard
  star1: number
  star2: number
  // Display rarity, tracked independently of star/power so a battle effect can
  // change a card's rarity without changing its power (and vice versa).
  rarity1: string
  rarity2: string
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

// What kind of thing an effect manipulates — drives the battle animation.
export type EffectKind =
  | 'deck'      // reshuffles/re-deals the deck (animated pre-round)
  | 'rarity'    // changes a card's rarity (badge/border morph)
  | 'power'     // changes a card's base ⭐ power (number tick)
  | 'dice'      // changes the dice roll value (during rolling)
  | 'extraDice' // adds extra dice rolls (extra die appears)
  | 'total'     // changes the effective total (grows/shrinks at merge)
  | 'damage'    // changes damage dealt (at result)
  | 'heal'      // converts damage to healing
  | 'visual'    // cosmetic only (e.g. tint)

// The hooks an effect can implement, one per battle phase. (Formerly SkillHooks.)
export type BattleEffectHooks = {
  onStars?: (state: FaceOffState) => FaceOffState
  onDiceOverride?: (state: FaceOffState) => FaceOffState
  onDice?: (state: FaceOffState) => FaceOffState
  onTotals?: (state: FaceOffState) => FaceOffState
  onDamage?: (state: FaceOffState) => FaceOffState
  onRound?: (ctx: RoundContext) => RoundContext
}

// Who a scoped (synergy) effect reaches.
export type SynergyScope = 'synergy_cards' | 'own' | 'matchup' | 'arena'
export type SynergyTarget = 'allies' | 'enemies' | 'everyone'

// A reusable, named battle effect. Skills and synergies compose these.
// scope/target/requiredTypes are only set for synergy-bound effects; skill
// effects leave them undefined and apply symmetrically to both sides.
export type BattleEffect = {
  id: string
  name: string
  kind: EffectKind[]
  hooks: BattleEffectHooks
  scope?: SynergyScope
  target?: SynergyTarget
  requiredTypes?: string[] // for scope 'synergy_cards': only cards with one of these types
}

// Backwards-compatible alias for the hook shape.
export type SkillHooks = BattleEffectHooks

export type Skill = {
  id: string
  name: string
  description: string
  usesPerBattle: number
  effects: BattleEffect[]
}

export type ActiveSkill = {
  skill: Skill
  activatedBy: string
  roundActivated: number
  // Which side of the current face-off the owner is on (set per match by the
  // engine). Drives scoped synergy effects; undefined => symmetric (skills).
  ownerSide?: 1 | 2
}
