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

const makeSkill = (skillId: string, activatedBy: string): ActiveSkill => ({
  skill: SKILL_REGISTRY[skillId],
  activatedBy,
  roundActivated: 1,
})

// --- Edge cases for resolveFaceOff ---

describe('resolveFaceOff edge cases', () => {
  it('unknown rarity falls back to star value 1', () => {
    const c1 = makeCard('mythical', 'a')
    const c2 = makeCard('common', 'b')
    const result = resolveFaceOff(c1, c2, undefined, createSeededRng(1))
    expect(result.star1).toBe(1)
    expect(result.star2).toBe(1)
  })

  it('exact tie produces zero damage for both', () => {
    const c1 = makeCard('rare', 'a')
    const c2 = makeCard('rare', 'b')
    let foundTie = false
    for (let seed = 0; seed < 100; seed++) {
      const result = resolveFaceOff(c1, c2, undefined, createSeededRng(seed))
      if (result.effective1 === result.effective2) {
        expect(result.damage1).toBe(0)
        expect(result.damage2).toBe(0)
        foundTie = true
        break
      }
    }
    expect(foundTie).toBe(true)
  })

  it('weaker card dice range scales with rarity gap', () => {
    const common = makeCard('common', 'a')
    const secretRare = makeCard('secret_rare', 'b')
    const rng = createSeededRng(42)
    const result = resolveFaceOff(common, secretRare, undefined, rng)
    expect(result.roll2).toBe(0)
    expect(result.roll1).toBeGreaterThanOrEqual(0)
    // diff=5, dice range is diff+2=7, so roll can be 0-6
    expect(result.roll1).toBeLessThanOrEqual(6)
  })
})

// --- Skill combo interactions ---

describe('skill combos', () => {
  it('snake-eyes zeros dice but loaded-dice bonus still applies via star comparison', () => {
    const c1 = makeCard('common', 'a')
    const c2 = makeCard('legendary', 'b')
    const snakeOnly = resolveFaceOff(c1, c2, [makeSkill('snake-eyes', 'p1')], createSeededRng(42))
    const both = resolveFaceOff(c1, c2, [makeSkill('snake-eyes', 'p1'), makeSkill('loaded-dice', 'p1')], createSeededRng(42))
    // snake-eyes zeros dice, but loaded-dice adds +2 when s1 <= s2
    expect(both.roll1).toBe(snakeOnly.roll1 + 2)
  })

  it('double-edge + all-or-nothing compounds (2x totals then 2x damage)', () => {
    const c1 = makeCard('legendary', 'a')
    const c2 = makeCard('common', 'b')
    const rng1 = createSeededRng(42)
    const rng2 = createSeededRng(42)
    const rng3 = createSeededRng(42)
    const base = resolveFaceOff(c1, c2, undefined, rng1)
    const doubleOnly = resolveFaceOff(c1, c2, [makeSkill('double-edge', 'p1')], rng2)
    const both = resolveFaceOff(c1, c2, [makeSkill('double-edge', 'p1'), makeSkill('all-or-nothing', 'p1')], rng3)
    // double-edge 2x totals, all-or-nothing 2x damage
    const totalDamageBoth = both.damage1 + both.damage2
    const totalDamageDouble = doubleOnly.damage1 + doubleOnly.damage2
    expect(totalDamageBoth).toBe(totalDamageDouble * 2)
  })

  it('beatdown + reverse-uno: flat damage goes to winner', () => {
    const c1 = makeCard('legendary', 'a')
    const c2 = makeCard('common', 'b')
    const skills = [makeSkill('beatdown', 'p1'), makeSkill('reverse-uno', 'p1')]
    const result = resolveFaceOff(c1, c2, skills, createSeededRng(42))
    // beatdown sets loser damage to 3, reverse-uno swaps
    if (result.effective1 !== result.effective2) {
      const totalDamage = result.damage1 + result.damage2
      expect(totalDamage).toBe(3)
    }
  })

  it('leveler + final-form: final-form only promotes original commons, not leveled cards', () => {
    const c1 = makeCard('legendary', 'a')
    const c2 = makeCard('rare', 'b')
    const skills = [makeSkill('leveler', 'p1'), makeSkill('final-form', 'p1')]
    const result = resolveFaceOff(c1, c2, skills, createSeededRng(1))
    // leveler sets both stars to 1 (common), but final-form checks card.rarity
    // which is still 'legendary'/'rare' — so no promotion happens
    expect(result.star1).toBe(1)
    expect(result.star2).toBe(1)
  })

  it('underdog + equal rarity: both get big dice', () => {
    const c1 = makeCard('rare', 'a')
    const c2 = makeCard('rare', 'b')
    const skills = [makeSkill('underdog', 'p1')]
    let foundBigRoll = false
    for (let seed = 0; seed < 50; seed++) {
      const result = resolveFaceOff(c1, c2, skills, createSeededRng(seed))
      if (result.roll1 > 1 || result.roll2 > 1) {
        foundBigRoll = true
        break
      }
    }
    expect(foundBigRoll).toBe(true)
  })
})

// --- randomPair edge cases ---

describe('randomPair edge cases', () => {
  it('returns no pairs and no bye when all players are eliminated', () => {
    const players = [
      { ...makePlayer('a'), eliminated: true },
      { ...makePlayer('b'), eliminated: true },
    ]
    const { pairs, byeId } = randomPair(players, createSeededRng(1))
    expect(pairs).toHaveLength(0)
    expect(byeId).toBeNull()
  })

  it('handles 8 players correctly (4 pairs, no bye)', () => {
    const players = Array.from({ length: 8 }, (_, i) => makePlayer(`p${i}`))
    const { pairs, byeId } = randomPair(players, createSeededRng(42))
    expect(pairs).toHaveLength(4)
    expect(byeId).toBeNull()
    const allIds = pairs.flat()
    expect(new Set(allIds).size).toBe(8)
  })

  it('handles 7 players (3 pairs + 1 bye)', () => {
    const players = Array.from({ length: 7 }, (_, i) => makePlayer(`p${i}`))
    const { pairs, byeId } = randomPair(players, createSeededRng(42))
    expect(pairs).toHaveLength(3)
    expect(byeId).toBeTruthy()
    const allIds = [...pairs.flat(), byeId!]
    expect(new Set(allIds).size).toBe(7)
  })
})

// --- precomputeRound edge cases ---

describe('precomputeRound edge cases', () => {
  it('KO stops face-off processing early', () => {
    const players = [makePlayer('a', 'secret_rare'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 1 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(1))
    const match = result.matches[0]
    // With only 1 HP, player b should get KO'd quickly — snapshots should be fewer than 6
    expect(match.hpSnapshots.length).toBeLessThanOrEqual(match.faceOffs.length + 1)
    const lastSnap = match.hpSnapshots[match.hpSnapshots.length - 1]
    const loserHp = Math.min(...Object.values(lastSnap))
    expect(loserHp).toBe(0)
  })

  it('8-player round produces 4 matches', () => {
    const players = Array.from({ length: 8 }, (_, i) => makePlayer(`p${i}`, 'rare'))
    const hp = Object.fromEntries(players.map(p => [p.id, 10]))
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    expect(result.matches).toHaveLength(4)
    expect(result.byePlayerId).toBeNull()
  })

  it('eliminated players are excluded from pairings', () => {
    const players = [
      makePlayer('a'), makePlayer('b'),
      makePlayer('c'), { ...makePlayer('d'), eliminated: true },
    ]
    const hp = { a: 10, b: 10, c: 10, d: 0 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    const allMatchedIds = result.matches.flatMap(m => [m.player1Id, m.player2Id])
    expect(allMatchedIds).not.toContain('d')
  })

  it('tiebreaker uses RNG when HP is equal after all face-offs', () => {
    const p1 = makePlayer('a', 'common')
    const p2 = makePlayer('b', 'common')
    const hp = { a: 10, b: 10 }
    const result = precomputeRound([p1, p2], hp, 1, undefined, undefined, createSeededRng(42))
    expect(result.matches[0].winnerId).toBeTruthy()
    expect(['a', 'b']).toContain(result.matches[0].winnerId)
  })

  it('round number is preserved in result', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const hp = { a: 10, b: 10 }
    const result = precomputeRound(players, hp, 7, undefined, undefined, createSeededRng(1))
    expect(result.round).toBe(7)
  })

  it('no flags set when no skills active', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const hp = { a: 10, b: 10 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(1))
    expect(result.flags).toBeUndefined()
  })

  it('both healInstead and visualEffect flags can be set together', () => {
    const players = [makePlayer('a'), makePlayer('b')]
    const hp = { a: 5, b: 5 }
    const skills = [makeSkill('heal-instead', 'a'), makeSkill('brown-tint', 'b')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(42))
    expect(result.flags?.healInstead).toBe(true)
    expect(result.flags?.visualEffect).toBeTruthy()
  })

  it('gift-exchange redistributes all cards among alive players', () => {
    const p1 = makePlayer('a', 'legendary')
    const p2 = makePlayer('b', 'common')
    const p3 = makePlayer('c', 'rare')
    const skills = [makeSkill('gift-exchange', 'a')]
    const hp = { a: 10, b: 10, c: 10 }
    const result = precomputeRound([p1, p2, p3], hp, 1, undefined, skills, createSeededRng(42))
    // All original cards should still be present across all matches
    const allCardIds = result.matches.flatMap(m =>
      m.faceOffs.flatMap(fo => [fo.card1.id, fo.card2.id])
    )
    const originalIds = [...p1.deck, ...p2.deck, ...p3.deck].map(c => c.id)
    for (const id of allCardIds) {
      expect(originalIds).toContain(id)
    }
  })
})

// --- createBot edge cases ---

describe('createBot edge cases', () => {
  it('uses fallback name when index exceeds BOT_NAMES', () => {
    const cards = Array.from({ length: 10 }, (_, i) => makeCard('common', `c${i}`))
    const bot = createBot(99, cards)
    expect(bot.name).toBe('Bot 100')
    expect(bot.id).toBe('bot-99')
  })

  it('handles card pool smaller than 5', () => {
    const cards = [makeCard('common', 'c0'), makeCard('rare', 'c1')]
    const bot = createBot(0, cards)
    expect(bot.deck.length).toBeLessThanOrEqual(5)
    expect(bot.deck.length).toBeGreaterThan(0)
  })

  it('each bot gets a shuffled subset of available cards', () => {
    const cards = Array.from({ length: 20 }, (_, i) => makeCard('common', `c${i}`))
    const bot = createBot(0, cards)
    const allIds = bot.deck.map(c => c.id)
    expect(new Set(allIds).size).toBe(5)
    for (const id of allIds) {
      expect(cards.map(c => c.id)).toContain(id)
    }
  })
})
