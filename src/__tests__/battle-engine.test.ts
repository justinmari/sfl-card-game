import { describe, it, expect } from 'vitest'
import {
  resolveFaceOff,
  randomPair,
  precomputeRound,
  createBot,
  starCount,
  type BattleCard,
  type BattlePlayer,
  type ActiveSkill,
} from '@/lib/battle-engine'
import { SKILL_REGISTRY } from '@/lib/skills'
import { createSeededRng } from '@/lib/seeded-random'

// --- Helpers ---

const makeCard = (rarity: string, id?: string): BattleCard => ({
  id: id || `card-${rarity}-${Math.random().toString(36).slice(2, 6)}`,
  name: `Test ${rarity}`,
  image_url: null,
  rarity,
  creature_name: null,
})

const makePlayer = (id: string, rarity: string = 'common', hp: number = 10): BattlePlayer => ({
  id,
  name: `Player ${id}`,
  avatar_url: null,
  deck: Array.from({ length: 5 }, (_, i) => makeCard(rarity, `${id}-card-${i}`)),
  hp,
  eliminated: false,
})

const makeSkill = (skillId: string, activatedBy: string, round: number = 1): ActiveSkill => ({
  skill: SKILL_REGISTRY[skillId],
  activatedBy,
  roundActivated: round,
})

// --- starCount ---

describe('starCount', () => {
  it('maps all 6 rarities correctly', () => {
    expect(starCount['common']).toBe(1)
    expect(starCount['uncommon']).toBe(2)
    expect(starCount['rare']).toBe(3)
    expect(starCount['ultra_rare']).toBe(4)
    expect(starCount['legendary']).toBe(5)
    expect(starCount['secret_rare']).toBe(6)
  })
})

// --- resolveFaceOff ---

describe('resolveFaceOff', () => {
  it('returns deterministic results with seeded RNG', () => {
    const c1 = makeCard('common', 'a')
    const c2 = makeCard('rare', 'b')
    const r1 = resolveFaceOff(c1, c2, undefined, createSeededRng(42))
    const r2 = resolveFaceOff(c1, c2, undefined, createSeededRng(42))
    expect(r1).toEqual(r2)
  })

  it('sets correct star values from rarity', () => {
    const c1 = makeCard('common', 'a')
    const c2 = makeCard('legendary', 'b')
    const rng = createSeededRng(1)
    const result = resolveFaceOff(c1, c2, undefined, rng)
    expect(result.star1).toBe(1)
    expect(result.star2).toBe(5)
  })

  it('only the weaker card gets dice rolls', () => {
    const c1 = makeCard('common', 'a')
    const c2 = makeCard('legendary', 'b')
    const rng = createSeededRng(1)
    const result = resolveFaceOff(c1, c2, undefined, rng)
    expect(result.roll2).toBe(0)
    expect(result.roll1).toBeGreaterThanOrEqual(0)
  })

  it('equal rarity gives both players small dice', () => {
    const c1 = makeCard('rare', 'a')
    const c2 = makeCard('rare', 'b')
    const rng = createSeededRng(1)
    const result = resolveFaceOff(c1, c2, undefined, rng)
    expect(result.roll1).toBeLessThanOrEqual(1)
    expect(result.roll2).toBeLessThanOrEqual(1)
  })

  it('damage only goes to the loser', () => {
    const c1 = makeCard('common', 'a')
    const c2 = makeCard('legendary', 'b')
    const rng = createSeededRng(1)
    const result = resolveFaceOff(c1, c2, undefined, rng)
    if (result.effective1 > result.effective2) {
      expect(result.damage1).toBe(0)
      expect(result.damage2).toBeGreaterThan(0)
    } else if (result.effective2 > result.effective1) {
      expect(result.damage2).toBe(0)
      expect(result.damage1).toBeGreaterThan(0)
    } else {
      expect(result.damage1).toBe(0)
      expect(result.damage2).toBe(0)
    }
  })

  it('damage equals the difference in effective totals', () => {
    const c1 = makeCard('rare', 'a')
    const c2 = makeCard('common', 'b')
    const rng = createSeededRng(99)
    const result = resolveFaceOff(c1, c2, undefined, rng)
    const diff = Math.abs(result.effective1 - result.effective2)
    expect(result.damage1 + result.damage2).toBe(diff)
  })

  // --- Skill effects ---

  describe('snake-eyes (no-dice)', () => {
    it('sets both rolls to 0', () => {
      const c1 = makeCard('common', 'a')
      const c2 = makeCard('legendary', 'b')
      const skills = [makeSkill('snake-eyes', 'p1')]
      const result = resolveFaceOff(c1, c2, skills, createSeededRng(1))
      expect(result.roll1).toBe(0)
      expect(result.roll2).toBe(0)
      expect(result.effective1).toBe(result.star1)
      expect(result.effective2).toBe(result.star2)
    })
  })

  describe('double-edge (multiply-totals)', () => {
    it('doubles both effective totals', () => {
      const c1 = makeCard('rare', 'a')
      const c2 = makeCard('rare', 'b')
      const rng1 = createSeededRng(42)
      const rng2 = createSeededRng(42)
      const withoutSkill = resolveFaceOff(c1, c2, undefined, rng1)
      const withSkill = resolveFaceOff(c1, c2, [makeSkill('double-edge', 'p1')], rng2)
      expect(withSkill.effective1).toBe(Math.round(withoutSkill.effective1 * 2))
      expect(withSkill.effective2).toBe(Math.round(withoutSkill.effective2 * 2))
    })
  })

  describe('loaded-dice (dice-bonus)', () => {
    it('adds +2 to dice rolls', () => {
      const c1 = makeCard('common', 'a')
      const c2 = makeCard('rare', 'b')
      const rng1 = createSeededRng(42)
      const rng2 = createSeededRng(42)
      const without = resolveFaceOff(c1, c2, undefined, rng1)
      const withSkill = resolveFaceOff(c1, c2, [makeSkill('loaded-dice', 'p1')], rng2)
      if (without.roll1 > 0 || starCount[c1.rarity] <= starCount[c2.rarity]) {
        expect(withSkill.roll1).toBe(without.roll1 + 2)
      }
    })
  })

  describe('leveler (all cards as commons)', () => {
    it('sets both stars to 1', () => {
      const c1 = makeCard('legendary', 'a')
      const c2 = makeCard('secret_rare', 'b')
      const skills = [makeSkill('leveler', 'p1')]
      const result = resolveFaceOff(c1, c2, skills, createSeededRng(1))
      expect(result.star1).toBe(1)
      expect(result.star2).toBe(1)
    })
  })

  describe('scramble (randomize rarities)', () => {
    it('changes star values from originals', () => {
      const c1 = makeCard('common', 'a')
      const c2 = makeCard('common', 'b')
      const skills = [makeSkill('scramble', 'p1')]
      let changed = false
      for (let seed = 0; seed < 20; seed++) {
        const result = resolveFaceOff(c1, c2, skills, createSeededRng(seed))
        if (result.star1 !== 1 || result.star2 !== 1) { changed = true; break }
      }
      expect(changed).toBe(true)
    })
  })

  describe('beatdown (flat-damage)', () => {
    it('loser takes exactly 3 damage', () => {
      const c1 = makeCard('legendary', 'a')
      const c2 = makeCard('common', 'b')
      const skills = [makeSkill('beatdown', 'p1')]
      const result = resolveFaceOff(c1, c2, skills, createSeededRng(1))
      const loserDamage = result.damage1 > 0 ? result.damage1 : result.damage2
      if (loserDamage > 0) expect(loserDamage).toBe(3)
    })
  })

  describe('all-or-nothing (multiply-damage)', () => {
    it('doubles damage dealt', () => {
      const c1 = makeCard('legendary', 'a')
      const c2 = makeCard('common', 'b')
      const rng1 = createSeededRng(42)
      const rng2 = createSeededRng(42)
      const without = resolveFaceOff(c1, c2, undefined, rng1)
      const withSkill = resolveFaceOff(c1, c2, [makeSkill('all-or-nothing', 'p1')], rng2)
      expect(withSkill.damage1).toBe(Math.round(without.damage1 * 2))
      expect(withSkill.damage2).toBe(Math.round(without.damage2 * 2))
    })
  })

  describe('reverse-uno (reverse-damage)', () => {
    it('swaps damage so winner takes it', () => {
      const c1 = makeCard('legendary', 'a')
      const c2 = makeCard('common', 'b')
      const rng1 = createSeededRng(42)
      const rng2 = createSeededRng(42)
      const without = resolveFaceOff(c1, c2, undefined, rng1)
      const withSkill = resolveFaceOff(c1, c2, [makeSkill('reverse-uno', 'p1')], rng2)
      expect(withSkill.damage1).toBe(without.damage2)
      expect(withSkill.damage2).toBe(without.damage1)
    })
  })

  describe('underdog (big-dice)', () => {
    it('gives lower rarity card 0-10 dice range', () => {
      const c1 = makeCard('common', 'a')
      const c2 = makeCard('legendary', 'b')
      const skills = [makeSkill('underdog', 'p1')]
      let foundBigRoll = false
      for (let seed = 0; seed < 50; seed++) {
        const result = resolveFaceOff(c1, c2, skills, createSeededRng(seed))
        if (result.roll1 > 6) { foundBigRoll = true; break }
      }
      expect(foundBigRoll).toBe(true)
    })
  })

  describe('final-form (promote-rarity)', () => {
    it('promotes common cards to secret_rare star value', () => {
      const c1 = makeCard('common', 'a')
      const c2 = makeCard('rare', 'b')
      const skills = [makeSkill('final-form', 'p1')]
      const result = resolveFaceOff(c1, c2, skills, createSeededRng(1))
      expect(result.star1).toBe(6)
      expect(result.star2).toBe(3) // rare stays at 3
    })

    it('promotes both players common cards', () => {
      const c1 = makeCard('common', 'a')
      const c2 = makeCard('common', 'b')
      const skills = [makeSkill('final-form', 'p1')]
      const result = resolveFaceOff(c1, c2, skills, createSeededRng(1))
      expect(result.star1).toBe(6)
      expect(result.star2).toBe(6)
    })

    it('does not affect non-common cards', () => {
      const c1 = makeCard('rare', 'a')
      const c2 = makeCard('legendary', 'b')
      const skills = [makeSkill('final-form', 'p1')]
      const result = resolveFaceOff(c1, c2, skills, createSeededRng(1))
      expect(result.star1).toBe(3)
      expect(result.star2).toBe(5)
    })
  })
})

// --- randomPair ---

describe('randomPair', () => {
  it('pairs all players when even count', () => {
    const players = [makePlayer('a'), makePlayer('b'), makePlayer('c'), makePlayer('d')]
    const rng = createSeededRng(42)
    const { pairs, byeId } = randomPair(players, rng)
    expect(pairs).toHaveLength(2)
    expect(byeId).toBeNull()
  })

  it('gives one player a bye when odd count', () => {
    const players = [makePlayer('a'), makePlayer('b'), makePlayer('c')]
    const rng = createSeededRng(42)
    const { pairs, byeId } = randomPair(players, rng)
    expect(pairs).toHaveLength(1)
    expect(byeId).toBeTruthy()
  })

  it('excludes eliminated players', () => {
    const players = [
      makePlayer('a'), makePlayer('b'), makePlayer('c'),
      { ...makePlayer('d'), eliminated: true },
    ]
    const rng = createSeededRng(42)
    const { pairs, byeId } = randomPair(players, rng)
    const allPaired = pairs.flat()
    expect(allPaired).not.toContain('d')
    if (byeId) expect(byeId).not.toBe('d')
  })

  it('produces deterministic pairings with same seed', () => {
    const players = [makePlayer('a'), makePlayer('b'), makePlayer('c'), makePlayer('d')]
    const r1 = randomPair(players, createSeededRng(42))
    const r2 = randomPair(players, createSeededRng(42))
    expect(r1).toEqual(r2)
  })

  it('handles 2 players (single pair, no bye)', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const { pairs, byeId } = randomPair(players, createSeededRng(1))
    expect(pairs).toHaveLength(1)
    expect(byeId).toBeNull()
  })

  it('handles 1 alive player (no pairs, bye)', () => {
    const players = [makePlayer('a')]
    const { pairs, byeId } = randomPair(players, createSeededRng(1))
    expect(pairs).toHaveLength(0)
    expect(byeId).toBe('a')
  })
})

// --- precomputeRound ---

describe('precomputeRound', () => {
  it('returns deterministic results with seeded RNG', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 10 }
    const r1 = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    const r2 = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    expect(r1).toEqual(r2)
  })

  it('produces correct number of matches', () => {
    const players = [makePlayer('a'), makePlayer('b'), makePlayer('c'), makePlayer('d')]
    const hp = { a: 10, b: 10, c: 10, d: 10 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(1))
    expect(result.matches).toHaveLength(2)
    expect(result.byePlayerId).toBeNull()
  })

  it('each match has 5 face-offs', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const hp = { a: 10, b: 10 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(1))
    expect(result.matches[0].faceOffs).toHaveLength(5)
  })

  it('uses fixed pairings when provided', () => {
    const players = [makePlayer('a'), makePlayer('b'), makePlayer('c'), makePlayer('d')]
    const hp = { a: 10, b: 10, c: 10, d: 10 }
    const fixed = { pairs: [['a', 'c'] as [string, string], ['b', 'd'] as [string, string]], byeId: null }
    const result = precomputeRound(players, hp, 1, fixed, undefined, createSeededRng(1))
    expect(result.matches[0].player1Id).toBe('a')
    expect(result.matches[0].player2Id).toBe('c')
    expect(result.matches[1].player1Id).toBe('b')
    expect(result.matches[1].player2Id).toBe('d')
  })

  it('determines a winner for each match', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const hp = { a: 10, b: 10 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(1))
    expect(result.matches[0].winnerId).toBeTruthy()
  })

  it('sets heal-instead flag when skill is active', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const hp = { a: 10, b: 10 }
    const skills = [makeSkill('heal-instead', 'a')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(1))
    expect(result.flags?.healInstead).toBe(true)
  })

  it('sets visual effect flag when brown-tint is active', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const hp = { a: 10, b: 10 }
    const skills = [makeSkill('brown-tint', 'a')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(1))
    expect(result.flags?.visualEffect).toBe('sepia(0.8) brightness(0.85)')
  })

  describe('gift-exchange', () => {
    it('redistributes cards across all alive players', () => {
      const p1 = makePlayer('a', 'legendary')
      const p2 = makePlayer('b', 'common')
      const skills = [makeSkill('gift-exchange', 'a')]
      const hp = { a: 10, b: 10 }
      const result = precomputeRound([p1, p2], hp, 1, undefined, skills, createSeededRng(42))
      const allCards = result.matches[0].faceOffs.flatMap((fo) => [fo.card1.id, fo.card2.id])
      const p1OriginalIds = p1.deck.map((c) => c.id)
      const p2OriginalIds = p2.deck.map((c) => c.id)
      const allOriginals = [...p1OriginalIds, ...p2OriginalIds]
      for (const cardId of allCards) {
        expect(allOriginals).toContain(cardId)
      }
    })
  })
})

// --- createBot ---

describe('createBot', () => {
  it('creates a bot with 5 cards and 10 HP', () => {
    const cards = Array.from({ length: 20 }, (_, i) => makeCard('common', `c${i}`))
    const bot = createBot(0, cards)
    expect(bot.deck).toHaveLength(5)
    expect(bot.hp).toBe(10)
    expect(bot.eliminated).toBe(false)
  })

  it('uses unique names for different indices', () => {
    const cards = Array.from({ length: 20 }, (_, i) => makeCard('common', `c${i}`))
    const bot0 = createBot(0, cards)
    const bot1 = createBot(1, cards)
    expect(bot0.name).not.toBe(bot1.name)
  })

  it('has a bot-prefixed ID', () => {
    const cards = Array.from({ length: 10 }, (_, i) => makeCard('common', `c${i}`))
    const bot = createBot(3, cards)
    expect(bot.id).toBe('bot-3')
  })
})

// --- Cross-client determinism ---

describe('cross-client determinism', () => {
  it('same seed + same players produce identical rounds regardless of player order', () => {
    const p1 = makePlayer('alice', 'rare')
    const p2 = makePlayer('bob', 'common')
    const hp = { alice: 10, bob: 10 }
    const seed = 12345
    const rng1 = createSeededRng(seed * 1000 + 1)
    const rng2 = createSeededRng(seed * 1000 + 1)
    const result1 = precomputeRound([p1, p2], hp, 1, undefined, undefined, rng1)
    const result2 = precomputeRound([p2, p1], hp, 1, undefined, undefined, rng2)
    expect(result1).toEqual(result2)
  })

  it('different seeds produce different results', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 10 }
    const r1 = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(100))
    const r2 = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(200))
    const damage1 = r1.matches[0].faceOffs.map((f) => f.damage1 + f.damage2)
    const damage2 = r2.matches[0].faceOffs.map((f) => f.damage1 + f.damage2)
    expect(damage1).not.toEqual(damage2)
  })

  it('per-round RNG isolation: round 1 result is same regardless of whether round 2 was computed', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const hp = { a: 10, b: 10 }
    const seed = 42
    const round1a = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(seed * 1000 + 1))
    precomputeRound(players, hp, 2, undefined, undefined, createSeededRng(seed * 1000 + 2))
    const round1b = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(seed * 1000 + 1))
    expect(round1a).toEqual(round1b)
  })
})

// --- hpSnapshots ---

describe('hpSnapshots', () => {
  it('includes hpSnapshots in each match result', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 10 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    expect(result.matches[0].hpSnapshots).toBeDefined()
    expect(result.matches[0].hpSnapshots.length).toBeGreaterThanOrEqual(2)
  })

  it('first snapshot matches input HP', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const hp = { a: 8, b: 6 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    const match = result.matches[0]
    expect(match.hpSnapshots[0][match.player1Id]).toBe(hp[match.player1Id])
    expect(match.hpSnapshots[0][match.player2Id]).toBe(hp[match.player2Id])
  })

  it('snapshot HP never goes below 0', () => {
    const players = [makePlayer('a', 'legendary'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 3 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    for (const match of result.matches) {
      for (const snap of match.hpSnapshots) {
        Object.values(snap).forEach((v) => expect(v).toBeGreaterThanOrEqual(0))
      }
    }
  })

  it('stops at KO (fewer snapshots than face-offs + 1)', () => {
    const players = [makePlayer('a', 'legendary'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 1 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(1))
    const match = result.matches[0]
    expect(match.hpSnapshots.length).toBeLessThanOrEqual(match.faceOffs.length + 1)
  })

  it('each step matches face-off damage', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 10 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    const match = result.matches[0]
    const p1 = match.player1Id
    const p2 = match.player2Id
    for (let i = 0; i < match.hpSnapshots.length - 1; i++) {
      const fo = match.faceOffs[i]
      const before = match.hpSnapshots[i]
      const after = match.hpSnapshots[i + 1]
      expect(after[p1]).toBe(Math.max(0, before[p1] - fo.damage1))
      expect(after[p2]).toBe(Math.max(0, before[p2] - fo.damage2))
    }
  })

  it('final snapshot reflects cumulative damage', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 10 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    const match = result.matches[0]
    const finalSnap = match.hpSnapshots[match.hpSnapshots.length - 1]
    const p1 = match.player1Id
    const p2 = match.player2Id
    let expectedHp1 = hp[p1]
    let expectedHp2 = hp[p2]
    for (let i = 0; i < match.hpSnapshots.length - 1; i++) {
      expectedHp1 = Math.max(0, expectedHp1 - match.faceOffs[i].damage1)
      expectedHp2 = Math.max(0, expectedHp2 - match.faceOffs[i].damage2)
      if (expectedHp1 <= 0 || expectedHp2 <= 0) break
    }
    expect(finalSnap[p1]).toBe(expectedHp1)
    expect(finalSnap[p2]).toBe(expectedHp2)
  })

  it('heal-instead adds HP in snapshots (capped at 10)', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const hp = { a: 5, b: 5 }
    const skills = [makeSkill('heal-instead', 'a')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(42))
    const match = result.matches[0]
    const lastSnap = match.hpSnapshots[match.hpSnapshots.length - 1]
    const firstSnap = match.hpSnapshots[0]
    const p1Gained = lastSnap[match.player1Id] >= firstSnap[match.player1Id]
    const p2Gained = lastSnap[match.player2Id] >= firstSnap[match.player2Id]
    expect(p1Gained || p2Gained).toBe(true)
    Object.values(lastSnap).forEach((v) => expect(v).toBeLessThanOrEqual(10))
  })

  it('deterministic snapshots with same seed', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 10 }
    const r1 = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    const r2 = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    expect(r1.matches[0].hpSnapshots).toEqual(r2.matches[0].hpSnapshots)
  })

  it('multiple matches have independent snapshots', () => {
    const players = [makePlayer('a'), makePlayer('b'), makePlayer('c'), makePlayer('d')]
    const hp = { a: 10, b: 10, c: 10, d: 10 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    expect(result.matches).toHaveLength(2)
    const snap1Keys = Object.keys(result.matches[0].hpSnapshots[0])
    const snap2Keys = Object.keys(result.matches[1].hpSnapshots[0])
    expect(snap1Keys).toHaveLength(2)
    expect(snap2Keys).toHaveLength(2)
    expect(snap1Keys.sort()).not.toEqual(snap2Keys.sort())
  })
})
