export type SkillEffect =
  | { type: 'multiply-totals'; factor: number; target: 'both' }
  | { type: 'dice-bonus'; bonus: number; target: 'both' }
  | { type: 'no-dice' }
  | { type: 'multiply-damage'; factor: number; target: 'both' }
  | { type: 'scramble-rarities' }
  | { type: 'leveler'; rarity: string }
  | { type: 'flat-damage'; damage: number }
  | { type: 'reverse-damage' }
  | { type: 'big-dice'; range: number }
  | { type: 'heal-instead' }
  | { type: 'visual'; css: string }

export type Skill = {
  id: string
  name: string
  description: string
  usesPerBattle: number
  effect: SkillEffect
}

export type ActiveSkill = {
  skill: Skill
  activatedBy: string // player id
  roundActivated: number
}
