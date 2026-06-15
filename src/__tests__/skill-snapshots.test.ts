import { describe, it, expect } from 'vitest'
import {
  resolveFaceOff,
  precomputeRound,
  type BattleCard,
  type BattlePlayer,
  type ActiveSkill,
  type FaceOffDetail,
  type RoundResult,
} from '@/lib/battle-engine'
import { SKILL_REGISTRY } from '@/lib/skills'
import { createSeededRng } from '@/lib/seeded-random'

const makeCard = (rarity: string, id: string): BattleCard => ({
  id, name: `Test ${rarity}`, image_url: null, rarity, creature_name: null,
})

const makePlayer = (id: string, rarity: string, hp: number = 10): BattlePlayer => ({
  id, name: `Player ${id}`, avatar_url: null,
  deck: Array.from({ length: 5 }, (_, i) => makeCard(rarity, `${id}-card-${i}`)),
  hp, eliminated: false,
})

const makeSkill = (skillId: string, activatedBy: string): ActiveSkill => ({
  skill: SKILL_REGISTRY[skillId], activatedBy, roundActivated: 1,
})

const snap = (r: FaceOffDetail) => ({
  star1: r.star1, star2: r.star2,
  roll1: r.roll1, roll2: r.roll2,
  effective1: r.effective1, effective2: r.effective2,
  damage1: r.damage1, damage2: r.damage2,
})

const roundSnap = (r: RoundResult) => ({
  round: r.round,
  byePlayerId: r.byePlayerId,
  flags: r.flags,
  matches: r.matches.map(m => ({
    player1Id: m.player1Id,
    player2Id: m.player2Id,
    winnerId: m.winnerId,
    hpSnapshots: m.hpSnapshots,
    faceOffs: m.faceOffs.map(fo => ({
      card1Id: fo.card1.id, card2Id: fo.card2.id,
      damage1: fo.damage1, damage2: fo.damage2,
    })),
  })),
})

describe('Skill Snapshots — exact output for refactor verification', () => {
  describe('no skills (baseline)', () => {
    it('common vs legendary — seed 42', () => {
      const r = resolveFaceOff(makeCard('common', 'a'), makeCard('legendary', 'b'), undefined, createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 1, star2: 5, roll1: 3, roll2: 0, effective1: 4, effective2: 5, damage1: 1, damage2: 0 })
    })

    it('rare vs rare — seed 42', () => {
      const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('rare', 'b'), undefined, createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 3, star2: 3, roll1: 1, roll2: 0, effective1: 4, effective2: 3, damage1: 0, damage2: 1 })
    })

    it('uncommon vs secret_rare — seed 42', () => {
      const r = resolveFaceOff(makeCard('uncommon', 'a'), makeCard('secret_rare', 'b'), undefined, createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 2, star2: 6, roll1: 3, roll2: 0, effective1: 5, effective2: 6, damage1: 1, damage2: 0 })
    })

    it('common vs common — seed 42', () => {
      const r = resolveFaceOff(makeCard('common', 'a'), makeCard('common', 'b'), undefined, createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 1, star2: 1, roll1: 1, roll2: 0, effective1: 2, effective2: 1, damage1: 0, damage2: 1 })
    })
  })

  describe('snake-eyes (no-dice)', () => {
    it('common vs legendary — seed 42', () => {
      const r = resolveFaceOff(makeCard('common', 'a'), makeCard('legendary', 'b'), [makeSkill('snake-eyes', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 1, star2: 5, roll1: 0, roll2: 0, effective1: 1, effective2: 5, damage1: 4, damage2: 0 })
    })

    it('rare vs rare — seed 42', () => {
      const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('rare', 'b'), [makeSkill('snake-eyes', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 3, star2: 3, roll1: 0, roll2: 0, effective1: 3, effective2: 3, damage1: 0, damage2: 0 })
    })
  })

  describe('double-edge (multiply-totals x2)', () => {
    it('rare vs rare — seed 42', () => {
      const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('rare', 'b'), [makeSkill('double-edge', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 3, star2: 3, roll1: 1, roll2: 0, effective1: 8, effective2: 6, damage1: 0, damage2: 2 })
    })

    it('common vs legendary — seed 42', () => {
      const r = resolveFaceOff(makeCard('common', 'a'), makeCard('legendary', 'b'), [makeSkill('double-edge', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 1, star2: 5, roll1: 3, roll2: 0, effective1: 8, effective2: 10, damage1: 2, damage2: 0 })
    })
  })

  describe('loaded-dice (dice-bonus +2)', () => {
    it('common vs rare — seed 42', () => {
      const r = resolveFaceOff(makeCard('common', 'a'), makeCard('rare', 'b'), [makeSkill('loaded-dice', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 1, star2: 3, roll1: 4, roll2: 0, effective1: 5, effective2: 3, damage1: 0, damage2: 2 })
    })

    it('rare vs rare — seed 42', () => {
      const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('rare', 'b'), [makeSkill('loaded-dice', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 3, star2: 3, roll1: 3, roll2: 2, effective1: 6, effective2: 5, damage1: 0, damage2: 1 })
    })
  })

  describe('leveler (all cards as common)', () => {
    it('legendary vs secret_rare — seed 42', () => {
      const r = resolveFaceOff(makeCard('legendary', 'a'), makeCard('secret_rare', 'b'), [makeSkill('leveler', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 1, star2: 1, roll1: 1, roll2: 0, effective1: 2, effective2: 1, damage1: 0, damage2: 1 })
    })
  })

  describe('scramble (randomize rarities)', () => {
    it('common vs common — seed 42', () => {
      const r = resolveFaceOff(makeCard('common', 'a'), makeCard('common', 'b'), [makeSkill('scramble', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 4, star2: 3, roll1: 0, roll2: 2, effective1: 4, effective2: 5, damage1: 1, damage2: 0 })
    })

    it('legendary vs legendary — seed 99', () => {
      const r = resolveFaceOff(makeCard('legendary', 'a'), makeCard('legendary', 'b'), [makeSkill('scramble', 'p1')], createSeededRng(99))
      expect(snap(r)).toEqual({ star1: 2, star2: 5, roll1: 2, roll2: 0, effective1: 4, effective2: 5, damage1: 1, damage2: 0 })
    })
  })

  describe('beatdown (flat-damage 3)', () => {
    it('legendary vs common — seed 42', () => {
      const r = resolveFaceOff(makeCard('legendary', 'a'), makeCard('common', 'b'), [makeSkill('beatdown', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 5, star2: 1, roll1: 0, roll2: 3, effective1: 5, effective2: 4, damage1: 0, damage2: 3 })
    })

    it('legendary vs common — seed 1', () => {
      const r = resolveFaceOff(makeCard('legendary', 'a'), makeCard('common', 'b'), [makeSkill('beatdown', 'p1')], createSeededRng(1))
      expect(snap(r)).toEqual({ star1: 5, star2: 1, roll1: 0, roll2: 3, effective1: 5, effective2: 4, damage1: 0, damage2: 3 })
    })
  })

  describe('all-or-nothing (multiply-damage x2)', () => {
    it('legendary vs common — seed 42', () => {
      const r = resolveFaceOff(makeCard('legendary', 'a'), makeCard('common', 'b'), [makeSkill('all-or-nothing', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 5, star2: 1, roll1: 0, roll2: 3, effective1: 5, effective2: 4, damage1: 0, damage2: 2 })
    })

    it('rare vs common — seed 1', () => {
      const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('common', 'b'), [makeSkill('all-or-nothing', 'p1')], createSeededRng(1))
      expect(snap(r)).toEqual({ star1: 3, star2: 1, roll1: 0, roll2: 2, effective1: 3, effective2: 3, damage1: 0, damage2: 0 })
    })
  })

  describe('reverse-uno (reverse-damage)', () => {
    it('legendary vs common — seed 1', () => {
      const r = resolveFaceOff(makeCard('legendary', 'a'), makeCard('common', 'b'), [makeSkill('reverse-uno', 'p1')], createSeededRng(1))
      expect(snap(r)).toEqual({ star1: 5, star2: 1, roll1: 0, roll2: 3, effective1: 5, effective2: 4, damage1: 1, damage2: 0 })
    })

    it('rare vs rare — seed 42', () => {
      const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('rare', 'b'), [makeSkill('reverse-uno', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 3, star2: 3, roll1: 1, roll2: 0, effective1: 4, effective2: 3, damage1: 1, damage2: 0 })
    })
  })

  describe('underdog (big-dice range 10)', () => {
    it('common vs legendary — seed 42', () => {
      const r = resolveFaceOff(makeCard('common', 'a'), makeCard('legendary', 'b'), [makeSkill('underdog', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 1, star2: 5, roll1: 6, roll2: 0, effective1: 7, effective2: 5, damage1: 0, damage2: 2 })
    })

    it('rare vs rare — seed 42 (both get big dice)', () => {
      const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('rare', 'b'), [makeSkill('underdog', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 3, star2: 3, roll1: 6, roll2: 4, effective1: 9, effective2: 7, damage1: 0, damage2: 2 })
    })
  })

  describe('final-form (promote common to secret_rare)', () => {
    it('common vs rare — seed 42', () => {
      const r = resolveFaceOff(makeCard('common', 'a'), makeCard('rare', 'b'), [makeSkill('final-form', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 6, star2: 3, roll1: 0, roll2: 3, effective1: 6, effective2: 6, damage1: 0, damage2: 0 })
    })

    it('common vs common — seed 42 (both promoted)', () => {
      const r = resolveFaceOff(makeCard('common', 'a'), makeCard('common', 'b'), [makeSkill('final-form', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 6, star2: 6, roll1: 1, roll2: 0, effective1: 7, effective2: 6, damage1: 0, damage2: 1 })
    })

    it('rare vs legendary — seed 42 (no promotion)', () => {
      const r = resolveFaceOff(makeCard('rare', 'a'), makeCard('legendary', 'b'), [makeSkill('final-form', 'p1')], createSeededRng(42))
      expect(snap(r)).toEqual({ star1: 3, star2: 5, roll1: 2, roll2: 0, effective1: 5, effective2: 5, damage1: 0, damage2: 0 })
    })
  })

  describe('heal-instead (round-level)', () => {
    it('full round — players at 5hp — seed 42', () => {
      const players = [makePlayer('a', 'rare', 5), makePlayer('b', 'common', 5)]
      const hp = { a: 5, b: 5 }
      const skills = [makeSkill('heal-instead', 'a')]
      const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(42))
      expect(result.flags).toEqual({ healInstead: true })
      const match = result.matches[0]
      for (const s of match.hpSnapshots) {
        for (const v of Object.values(s)) {
          expect(v).toBeGreaterThanOrEqual(5)
          expect(v).toBeLessThanOrEqual(10)
        }
      }
      expect(match.hpSnapshots).toMatchSnapshot()
    })
  })

  describe('brown-tint (visual)', () => {
    it('sets visual flag, does not affect combat', () => {
      const players = [makePlayer('a', 'rare'), makePlayer('b', 'rare')]
      const hp = { a: 10, b: 10 }
      const withTint = precomputeRound(players, hp, 1, undefined, [makeSkill('brown-tint', 'a')], createSeededRng(42))
      const without = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
      expect(withTint.flags).toEqual({ visualEffect: 'sepia(0.8) brightness(0.85)' })
      expect(withTint.matches[0].faceOffs.map(fo => fo.damage1)).toEqual(without.matches[0].faceOffs.map(fo => fo.damage1))
      expect(withTint.matches[0].faceOffs.map(fo => fo.damage2)).toEqual(without.matches[0].faceOffs.map(fo => fo.damage2))
    })
  })

  describe('gift-exchange (round-level deck swap)', () => {
    it('full round — 2 players — seed 42', () => {
      const p1 = makePlayer('a', 'legendary')
      const p2 = makePlayer('b', 'common')
      const hp = { a: 10, b: 10 }
      const skills = [makeSkill('gift-exchange', 'a')]
      const result = precomputeRound([p1, p2], hp, 1, undefined, skills, createSeededRng(42))
      const match = result.matches[0]
      expect(match.faceOffs.map(fo => fo.card1.id)).toMatchSnapshot()
      expect(match.faceOffs.map(fo => fo.card2.id)).toMatchSnapshot()
      expect(match.hpSnapshots).toMatchSnapshot()
    })
  })
})

describe('Full round snapshots — exact precompute output', () => {
  it('2-player round no skills — seed 42', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 10 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    expect(roundSnap(result)).toMatchSnapshot()
  })

  it('2-player round no skills — seed 99', () => {
    const players = [makePlayer('a', 'legendary'), makePlayer('b', 'uncommon')]
    const hp = { a: 7, b: 8 }
    const result = precomputeRound(players, hp, 3, undefined, undefined, createSeededRng(99))
    expect(roundSnap(result)).toMatchSnapshot()
  })

  it('4-player round no skills — seed 42', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common'), makePlayer('c', 'legendary'), makePlayer('d', 'uncommon')]
    const hp = { a: 10, b: 10, c: 10, d: 10 }
    const result = precomputeRound(players, hp, 1, undefined, undefined, createSeededRng(42))
    expect(roundSnap(result)).toMatchSnapshot()
  })

  it('2-player with double-edge — seed 42', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 10 }
    const skills = [makeSkill('double-edge', 'a')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(42))
    expect(roundSnap(result)).toMatchSnapshot()
  })

  it('2-player with snake-eyes + beatdown combo — seed 42', () => {
    const players = [makePlayer('a', 'legendary'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 10 }
    const skills = [makeSkill('snake-eyes', 'a'), makeSkill('beatdown', 'b')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(42))
    expect(roundSnap(result)).toMatchSnapshot()
  })

  it('2-player with reverse-uno + all-or-nothing — seed 42', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common')]
    const hp = { a: 8, b: 6 }
    const skills = [makeSkill('reverse-uno', 'a'), makeSkill('all-or-nothing', 'b')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(42))
    expect(roundSnap(result)).toMatchSnapshot()
  })

  it('2-player with underdog + loaded-dice — seed 42', () => {
    const players = [makePlayer('a', 'common'), makePlayer('b', 'legendary')]
    const hp = { a: 10, b: 10 }
    const skills = [makeSkill('underdog', 'a'), makeSkill('loaded-dice', 'b')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(42))
    expect(roundSnap(result)).toMatchSnapshot()
  })

  it('2-player with scramble + final-form — seed 42', () => {
    const players = [makePlayer('a', 'common'), makePlayer('b', 'common')]
    const hp = { a: 10, b: 10 }
    const skills = [makeSkill('scramble', 'a'), makeSkill('final-form', 'b')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(42))
    expect(roundSnap(result)).toMatchSnapshot()
  })

  it('2-player with leveler — seed 42', () => {
    const players = [makePlayer('a', 'legendary'), makePlayer('b', 'secret_rare')]
    const hp = { a: 10, b: 10 }
    const skills = [makeSkill('leveler', 'a')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(42))
    expect(roundSnap(result)).toMatchSnapshot()
  })

  it('3-player round (1 bye) with gift-exchange — seed 42', () => {
    const players = [makePlayer('a', 'legendary'), makePlayer('b', 'common'), makePlayer('c', 'rare')]
    const hp = { a: 10, b: 10, c: 10 }
    const skills = [makeSkill('gift-exchange', 'a')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(42))
    expect(roundSnap(result)).toMatchSnapshot()
  })

  it('2-player heal-instead with low HP — seed 42', () => {
    const players = [makePlayer('a', 'rare'), makePlayer('b', 'common')]
    const hp = { a: 3, b: 4 }
    const skills = [makeSkill('heal-instead', 'a')]
    const result = precomputeRound(players, hp, 1, undefined, skills, createSeededRng(42))
    expect(roundSnap(result)).toMatchSnapshot()
  })
})

describe('Skill combo snapshots', () => {
  it('snake-eyes + loaded-dice — seed 42', () => {
    const r = resolveFaceOff(
      makeCard('common', 'a'), makeCard('legendary', 'b'),
      [makeSkill('snake-eyes', 'p1'), makeSkill('loaded-dice', 'p1')],
      createSeededRng(42),
    )
    expect(snap(r)).toEqual({ star1: 1, star2: 5, roll1: 2, roll2: 0, effective1: 3, effective2: 5, damage1: 2, damage2: 0 })
  })

  it('double-edge + all-or-nothing — seed 42', () => {
    const r = resolveFaceOff(
      makeCard('legendary', 'a'), makeCard('common', 'b'),
      [makeSkill('double-edge', 'p1'), makeSkill('all-or-nothing', 'p1')],
      createSeededRng(42),
    )
    expect(snap(r)).toEqual({ star1: 5, star2: 1, roll1: 0, roll2: 3, effective1: 10, effective2: 8, damage1: 0, damage2: 4 })
  })

  it('beatdown + reverse-uno — seed 1', () => {
    const r = resolveFaceOff(
      makeCard('legendary', 'a'), makeCard('common', 'b'),
      [makeSkill('beatdown', 'p1'), makeSkill('reverse-uno', 'p1')],
      createSeededRng(1),
    )
    expect(snap(r)).toEqual({ star1: 5, star2: 1, roll1: 0, roll2: 3, effective1: 5, effective2: 4, damage1: 3, damage2: 0 })
  })

  it('leveler + final-form — seed 1', () => {
    const r = resolveFaceOff(
      makeCard('legendary', 'a'), makeCard('rare', 'b'),
      [makeSkill('leveler', 'p1'), makeSkill('final-form', 'p1')],
      createSeededRng(1),
    )
    expect(snap(r)).toEqual({ star1: 1, star2: 1, roll1: 1, roll2: 0, effective1: 2, effective2: 1, damage1: 0, damage2: 1 })
  })

  it('scramble + underdog — seed 42', () => {
    const r = resolveFaceOff(
      makeCard('common', 'a'), makeCard('common', 'b'),
      [makeSkill('scramble', 'p1'), makeSkill('underdog', 'p1')],
      createSeededRng(42),
    )
    expect(snap(r)).toMatchSnapshot()
  })
})
