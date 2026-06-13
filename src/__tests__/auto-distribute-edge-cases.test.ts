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

describe('autoDistribute edge cases', () => {
  it('orphaned entries (card_id not in cards list) are ignored', () => {
    const cards = makeCards({ common: 2 })
    const entries = [
      ...makeEntries(cards),
      { card_id: 'nonexistent', pull_percentage: 0 },
    ]
    const result = autoDistribute(entries, cards)
    expect(result).toHaveLength(2)
    const total = result.reduce((s, e) => s + e.pull_percentage, 0)
    expect(Math.abs(total - 100)).toBeLessThan(0.01)
  })

  it('all secret_rare cards still total 100%', () => {
    const cards = makeCards({ secret_rare: 3 })
    const result = autoDistribute(makeEntries(cards), cards)
    const total = result.reduce((s, e) => s + e.pull_percentage, 0)
    expect(Math.abs(total - 100)).toBeLessThan(0.01)
  })

  it('large number of commons distributes evenly', () => {
    const cards = makeCards({ common: 50 })
    const result = autoDistribute(makeEntries(cards), cards)
    const total = result.reduce((s, e) => s + e.pull_percentage, 0)
    expect(Math.abs(total - 100)).toBeLessThan(0.01)
    for (const e of result) {
      expect(e.pull_percentage).toBeGreaterThan(1)
      expect(e.pull_percentage).toBeLessThan(3)
    }
  })

  it('every rarity present allocates budgets correctly', () => {
    const cards = makeCards({
      common: 10, uncommon: 5, rare: 3,
      ultra_rare: 2, legendary: 1, secret_rare: 1,
    })
    const result = autoDistribute(makeEntries(cards), cards)
    const byRarity = new Map<string, number[]>()
    for (const entry of result) {
      const card = cards.find(c => c.id === entry.card_id)!
      const existing = byRarity.get(card.rarity) || []
      existing.push(entry.pull_percentage)
      byRarity.set(card.rarity, existing)
    }
    // Common cards should have the highest individual percentages
    const commonAvg = byRarity.get('common')!.reduce((a, b) => a + b) / byRarity.get('common')!.length
    const srAvg = byRarity.get('secret_rare')!.reduce((a, b) => a + b) / byRarity.get('secret_rare')!.length
    expect(commonAvg).toBeGreaterThan(srAvg)
  })

  it('two rarities without common', () => {
    const cards = makeCards({ uncommon: 2, rare: 2 })
    const result = autoDistribute(makeEntries(cards), cards)
    const total = result.reduce((s, e) => s + e.pull_percentage, 0)
    expect(Math.abs(total - 100)).toBeLessThan(0.01)
    // Leftover should go to first entry
    expect(result.some(e => e.pull_percentage > 40)).toBe(true)
  })

  it('all percentages are non-negative', () => {
    const cards = makeCards({ common: 1, uncommon: 1, rare: 1, ultra_rare: 1, legendary: 1, secret_rare: 1 })
    const result = autoDistribute(makeEntries(cards), cards)
    for (const e of result) {
      expect(e.pull_percentage).toBeGreaterThanOrEqual(0)
    }
  })
})
