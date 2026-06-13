import { describe, it, expect } from 'vitest'
import { autoDistribute } from '@/lib/auto-distribute'

const makeCards = (rarities: Record<string, number>) => {
  const cards: { id: string; rarity: string }[] = []
  let i = 0
  for (const [rarity, count] of Object.entries(rarities)) {
    for (let j = 0; j < count; j++) {
      cards.push({ id: `card-${i++}`, rarity })
    }
  }
  return cards
}

const makeEntries = (cards: { id: string }[]) =>
  cards.map((c) => ({ card_id: c.id, pull_percentage: 0 }))

describe('autoDistribute', () => {
  it('totals to exactly 100%', () => {
    const cards = makeCards({ common: 5, uncommon: 3, rare: 2, ultra_rare: 1, legendary: 1, secret_rare: 1 })
    const result = autoDistribute(makeEntries(cards), cards)
    const total = result.reduce((s, e) => s + e.pull_percentage, 0)
    expect(Math.abs(total - 100)).toBeLessThan(0.01)
  })

  it('gives secret_rare 0.1% budget with one card', () => {
    const cards = makeCards({ common: 5, secret_rare: 1 })
    const result = autoDistribute(makeEntries(cards), cards)
    const sr = result.find((e) => cards.find((c) => c.id === e.card_id)?.rarity === 'secret_rare')!
    expect(sr.pull_percentage).toBeCloseTo(0.1, 1)
  })

  it('splits budget evenly within a rarity (when commons absorb leftover)', () => {
    const cards = makeCards({ common: 4, rare: 2 })
    const result = autoDistribute(makeEntries(cards), cards)
    const rareEntries = result.filter((e) => cards.find((c) => c.id === e.card_id)?.rarity === 'rare')
    expect(Math.abs(rareEntries[0].pull_percentage - rareEntries[1].pull_percentage)).toBeLessThan(0.02)
  })

  it('applies rounding correction to the largest entry, not the smallest', () => {
    const cards = makeCards({ common: 10, uncommon: 5, rare: 2, ultra_rare: 1, legendary: 1, secret_rare: 1 })
    const result = autoDistribute(makeEntries(cards), cards)
    const sr = result.find((e) => cards.find((c) => c.id === e.card_id)?.rarity === 'secret_rare')!
    expect(sr.pull_percentage).toBeGreaterThanOrEqual(0.05)
  })

  it('handles only commons', () => {
    const cards = makeCards({ common: 3 })
    const result = autoDistribute(makeEntries(cards), cards)
    const total = result.reduce((s, e) => s + e.pull_percentage, 0)
    expect(Math.abs(total - 100)).toBeLessThan(0.01)
    for (const e of result) {
      expect(e.pull_percentage).toBeGreaterThan(30)
    }
  })

  it('handles no commons (leftover goes to first entry)', () => {
    const cards = makeCards({ rare: 2, legendary: 1 })
    const result = autoDistribute(makeEntries(cards), cards)
    const total = result.reduce((s, e) => s + e.pull_percentage, 0)
    expect(Math.abs(total - 100)).toBeLessThan(0.01)
  })

  it('returns empty array for empty input', () => {
    expect(autoDistribute([], [])).toEqual([])
  })

  it('handles single card', () => {
    const cards = makeCards({ rare: 1 })
    const result = autoDistribute(makeEntries(cards), cards)
    expect(result).toHaveLength(1)
    expect(result[0].pull_percentage).toBeCloseTo(100, 0)
  })
})
