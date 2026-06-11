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
  damage1: number
  damage2: number
}

export type MatchResult = {
  player1Id: string
  player2Id: string
  faceOffs: FaceOff[]
  winnerId: string | null
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
  roundNum: number
): RoundResult {
  const { pairs, byeId } = randomPair(players)

  const matches: MatchResult[] = pairs.map(([id1, id2]) => {
    const p1 = players.find((p) => p.id === id1)!
    const p2 = players.find((p) => p.id === id2)!
    const deck1 = shuffle(p1.deck)
    const deck2 = shuffle(p2.deck)
    const faceOffs: FaceOff[] = []

    for (let i = 0; i < 5; i++) {
      faceOffs.push(resolveFaceOff(deck1[i], deck2[i]))
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
