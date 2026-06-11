export type BattleCard = {
  id: string
  name: string
  image_url: string | null
  rarity: string
  creature_name: string | null
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
  damage1: number // damage dealt TO player 1
  damage2: number // damage dealt TO player 2
}

export type MatchResult = {
  player1Id: string
  player2Id: string
  faceOffs: FaceOff[]
  winnerId: string | null // null = tie (shouldn't happen with coinflip)
}

export type RoundResult = {
  round: number
  matches: MatchResult[]
  byePlayerId: string | null
}

const starCount: Record<string, number> = {
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

export function resolveFaceOff(card1: BattleCard, card2: BattleCard): FaceOff {
  const s1 = starCount[card1.rarity] || 1
  const s2 = starCount[card2.rarity] || 1
  const diff = Math.abs(s1 - s2)

  return {
    card1,
    card2,
    damage1: s2 > s1 ? diff : 0,
    damage2: s1 > s2 ? diff : 0,
  }
}

export function resolveMatch(player1: BattlePlayer, player2: BattlePlayer): MatchResult {
  const deck1 = shuffle(player1.deck)
  const deck2 = shuffle(player2.deck)
  const faceOffs: FaceOff[] = []

  let hp1 = player1.hp
  let hp2 = player2.hp

  for (let i = 0; i < 5; i++) {
    const fo = resolveFaceOff(deck1[i], deck2[i])
    faceOffs.push(fo)

    hp1 -= fo.damage1
    hp2 -= fo.damage2

    // Early KO
    if (hp1 <= 0 || hp2 <= 0) break
  }

  // Update player HP
  player1.hp = Math.max(0, hp1)
  player2.hp = Math.max(0, hp2)

  if (player1.hp <= 0) player1.eliminated = true
  if (player2.hp <= 0) player2.eliminated = true

  // Determine winner
  let winnerId: string | null = null
  if (player1.hp > player2.hp) winnerId = player1.id
  else if (player2.hp > player1.hp) winnerId = player2.id
  else winnerId = Math.random() > 0.5 ? player1.id : player2.id // coinflip

  return { player1Id: player1.id, player2Id: player2.id, faceOffs, winnerId }
}

export function pairPlayers(players: BattlePlayer[], previousPairs: Set<string>): { pairs: [string, string][]; byeId: string | null } {
  const active = players.filter((p) => !p.eliminated)
  // Sort by HP descending for Swiss pairing
  active.sort((a, b) => b.hp - a.hp)

  const pairs: [string, string][] = []
  const paired = new Set<string>()
  let byeId: string | null = null

  for (let i = 0; i < active.length; i++) {
    if (paired.has(active[i].id)) continue
    let found = false
    for (let j = i + 1; j < active.length; j++) {
      if (paired.has(active[j].id)) continue
      const pairKey = [active[i].id, active[j].id].sort().join('-')
      // Prefer no rematches, but allow if necessary
      if (!previousPairs.has(pairKey)) {
        pairs.push([active[i].id, active[j].id])
        paired.add(active[i].id)
        paired.add(active[j].id)
        found = true
        break
      }
    }
    // If no non-rematch found, pair with next available
    if (!found && !paired.has(active[i].id)) {
      for (let j = i + 1; j < active.length; j++) {
        if (!paired.has(active[j].id)) {
          pairs.push([active[i].id, active[j].id])
          paired.add(active[i].id)
          paired.add(active[j].id)
          found = true
          break
        }
      }
    }
    if (!found && !paired.has(active[i].id)) {
      byeId = active[i].id
    }
  }

  return { pairs, byeId }
}

export function runRound(
  players: BattlePlayer[],
  roundNum: number,
  previousPairs: Set<string>
): RoundResult {
  const { pairs, byeId } = pairPlayers(players, previousPairs)
  const matches: MatchResult[] = []

  for (const [id1, id2] of pairs) {
    const p1 = players.find((p) => p.id === id1)!
    const p2 = players.find((p) => p.id === id2)!
    const result = resolveMatch(p1, p2)
    matches.push(result)
    previousPairs.add([id1, id2].sort().join('-'))
  }

  return { round: roundNum, matches, byePlayerId: byeId }
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
