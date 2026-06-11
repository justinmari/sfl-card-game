export type { Skill, SkillEffect, ActiveSkill } from '@/lib/skills'
export { SKILL_REGISTRY, resolveSkills } from '@/lib/skills'

import type { Skill, ActiveSkill } from '@/lib/skills'

export type BattleCard = {
  id: string
  name: string
  image_url: string | null
  rarity: string
  creature_name: string | null
  dbSkillIds?: string[]
  skills?: Skill[]
}

export type BattlePlayer = {
  id: string
  name: string
  avatar_url: string | null
  deck: BattleCard[]
  hp: number
  eliminated: boolean
}

export type FaceOff = {
  card1: BattleCard
  card2: BattleCard
  damage1: number
  damage2: number
}

export type MatchResult = {
  player1Id: string
  player2Id: string
  faceOffs: FaceOff[]
  winnerId: string | null
}

export type RoundFlags = {
  healInstead?: boolean
  visualEffect?: string // CSS filter to apply to cards
}

export type RoundResult = {
  round: number
  matches: MatchResult[]
  byePlayerId: string | null
  flags?: RoundFlags
}

export const starCount: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  ultra_rare: 4,
  legendary: 5,
  secret_rare: 6,
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export type FaceOffDetail = FaceOff & {
  star1: number
  star2: number
  roll1: number
  roll2: number
  effective1: number
  effective2: number
}

const allRarities = Object.keys(starCount)

export function resolveFaceOff(card1: BattleCard, card2: BattleCard, activeSkills?: ActiveSkill[]): FaceOffDetail {
  // --- Phase 1: Determine star values (can be modified by skills) ---
  let s1 = starCount[card1.rarity] || 1
  let s2 = starCount[card2.rarity] || 1

  if (activeSkills) {
    for (const as of activeSkills) {
      const e = as.skill.effect
      // Scramble: randomize both rarities
      if (e.type === 'scramble-rarities') {
        const r1 = allRarities[Math.floor(Math.random() * allRarities.length)]
        const r2 = allRarities[Math.floor(Math.random() * allRarities.length)]
        s1 = starCount[r1] || 1
        s2 = starCount[r2] || 1
      }
      // Leveler: all cards treated as a specific rarity
      if (e.type === 'leveler') {
        s1 = starCount[e.rarity] || 1
        s2 = starCount[e.rarity] || 1
      }
    }
  }

  // --- Phase 2: Dice rolls ---
  let roll1 = 0
  let roll2 = 0
  let noDice = false
  let bigDiceRange = 0

  if (activeSkills) {
    for (const as of activeSkills) {
      const e = as.skill.effect
      if (e.type === 'no-dice') noDice = true
      if (e.type === 'big-dice') bigDiceRange = Math.max(bigDiceRange, e.range)
    }
  }

  if (noDice) {
    roll1 = 0
    roll2 = 0
  } else if (bigDiceRange > 0) {
    // Lower rarity card gets big dice range
    if (s1 < s2) {
      roll1 = Math.floor(Math.random() * (bigDiceRange + 1))
    } else if (s2 < s1) {
      roll2 = Math.floor(Math.random() * (bigDiceRange + 1))
    } else {
      // Equal: both get big dice
      roll1 = Math.floor(Math.random() * (bigDiceRange + 1))
      roll2 = Math.floor(Math.random() * (bigDiceRange + 1))
    }
  } else {
    const diff = Math.abs(s1 - s2)
    if (s1 === s2) {
      roll1 = Math.floor(Math.random() * 2)
      roll2 = Math.floor(Math.random() * 2)
    } else if (s1 < s2) {
      roll1 = Math.floor(Math.random() * (diff + 2))
    } else {
      roll2 = Math.floor(Math.random() * (diff + 2))
    }
  }

  // Apply dice bonus
  if (activeSkills) {
    for (const as of activeSkills) {
      const e = as.skill.effect
      if (e.type === 'dice-bonus' && e.target === 'both') {
        if (roll1 > 0 || s1 <= s2) roll1 += e.bonus
        if (roll2 > 0 || s2 <= s1) roll2 += e.bonus
      }
    }
  }

  // --- Phase 3: Effective totals ---
  let effective1 = s1 + roll1
  let effective2 = s2 + roll2

  if (activeSkills) {
    for (const as of activeSkills) {
      const e = as.skill.effect
      if (e.type === 'multiply-totals' && e.target === 'both') {
        effective1 = Math.round(effective1 * e.factor)
        effective2 = Math.round(effective2 * e.factor)
      }
    }
  }

  // --- Phase 4: Damage calculation ---
  const finalDiff = Math.abs(effective1 - effective2)
  let damage1 = effective2 > effective1 ? finalDiff : 0
  let damage2 = effective1 > effective2 ? finalDiff : 0

  if (activeSkills) {
    for (const as of activeSkills) {
      const e = as.skill.effect
      // Flat damage: loser always takes fixed damage
      if (e.type === 'flat-damage') {
        if (damage1 > 0) damage1 = e.damage
        if (damage2 > 0) damage2 = e.damage
      }
      // Multiply damage
      if (e.type === 'multiply-damage' && e.target === 'both') {
        damage1 = Math.round(damage1 * e.factor)
        damage2 = Math.round(damage2 * e.factor)
      }
      // Reverse: damage goes to the winner instead
      if (e.type === 'reverse-damage') {
        const tmp1 = damage1
        const tmp2 = damage2
        damage1 = tmp2
        damage2 = tmp1
      }
    }
  }

  return {
    card1, card2,
    star1: s1, star2: s2,
    roll1, roll2,
    effective1, effective2,
    damage1, damage2,
  }
}

export function randomPair(players: BattlePlayer[]): { pairs: [string, string][]; byeId: string | null } {
  const alive = shuffle(players.filter((p) => !p.eliminated))
  const pairs: [string, string][] = []
  let byeId: string | null = null

  for (let i = 0; i < alive.length - 1; i += 2) {
    pairs.push([alive[i].id, alive[i + 1].id])
  }

  if (alive.length % 2 === 1) {
    byeId = alive[alive.length - 1].id
  }

  return { pairs, byeId }
}

export function precomputeRound(
  players: BattlePlayer[],
  currentHp: Record<string, number>,
  roundNum: number,
  fixedPairings?: { pairs: [string, string][]; byeId: string | null },
  activeSkills?: ActiveSkill[],
): RoundResult {
  const { pairs, byeId } = fixedPairings || randomPair(players)

  const matches: MatchResult[] = pairs.map(([id1, id2]) => {
    const p1 = players.find((p) => p.id === id1)!
    const p2 = players.find((p) => p.id === id2)!
    const deck1 = shuffle(p1.deck)
    const deck2 = shuffle(p2.deck)
    const faceOffs: FaceOff[] = []

    // Filter skills relevant to this match
    const matchSkills = activeSkills?.filter((s) => s.activatedBy === id1 || s.activatedBy === id2)

    for (let i = 0; i < 5; i++) {
      faceOffs.push(resolveFaceOff(deck1[i], deck2[i], matchSkills))
    }

    // Simulate to find winner
    let hp1 = currentHp[id1] || 0
    let hp2 = currentHp[id2] || 0
    for (const fo of faceOffs) {
      hp1 -= fo.damage1
      hp2 -= fo.damage2
      if (hp1 <= 0 || hp2 <= 0) break
    }

    let winnerId: string | null = null
    if (hp1 > hp2) winnerId = id1
    else if (hp2 > hp1) winnerId = id2
    else winnerId = Math.random() > 0.5 ? id1 : id2

    return { player1Id: id1, player2Id: id2, faceOffs, winnerId }
  })

  // Extract round-level flags from active skills
  const flags: RoundFlags = {}
  if (activeSkills) {
    for (const as of activeSkills) {
      if (as.skill.effect.type === 'heal-instead') flags.healInstead = true
      if (as.skill.effect.type === 'visual') flags.visualEffect = as.skill.effect.css
    }
  }

  return { round: roundNum, matches, byePlayerId: byeId, flags: Object.keys(flags).length > 0 ? flags : undefined }
}

const BOT_NAMES = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta', 'Bot Epsilon', 'Bot Zeta', 'Bot Eta']

export function createBot(index: number, allCards: BattleCard[]): BattlePlayer {
  const deck = shuffle(allCards).slice(0, 5)
  return {
    id: `bot-${index}`,
    name: BOT_NAMES[index] || `Bot ${index + 1}`,
    avatar_url: null,
    deck,
    hp: 10,
    eliminated: false,
  }
}
