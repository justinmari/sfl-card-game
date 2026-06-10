const RARITY_BUDGETS: Record<string, number> = {
  common: 60,
  uncommon: 25,
  rare: 8,
  ultra_rare: 4,
  legendary: 2,
  secret_rare: 1,
}

export function autoDistribute(
  entries: { card_id: string; pull_percentage: number }[],
  cards: { id: string; rarity: string }[]
): { card_id: string; pull_percentage: number }[] {
  // Group entries by rarity
  const byRarity = new Map<string, string[]>()
  for (const entry of entries) {
    const card = cards.find((c) => c.id === entry.card_id)
    if (!card) continue
    const existing = byRarity.get(card.rarity) || []
    existing.push(entry.card_id)
    byRarity.set(card.rarity, existing)
  }

  // Calculate used budget and leftover
  let usedBudget = 0
  for (const rarity of byRarity.keys()) {
    usedBudget += RARITY_BUDGETS[rarity] || 1
  }

  const leftover = 100 - usedBudget
  const commonBudget = (RARITY_BUDGETS['common'] || 0) + (byRarity.has('common') ? leftover : 0)

  // Distribute evenly within each rarity
  const result: { card_id: string; pull_percentage: number }[] = []
  for (const [rarity, cardIds] of byRarity) {
    const budget = rarity === 'common' ? commonBudget : (RARITY_BUDGETS[rarity] || 1)
    const perCard = Math.round((budget / cardIds.length) * 100) / 100
    for (const cardId of cardIds) {
      result.push({ card_id: cardId, pull_percentage: perCard })
    }
  }

  // If no commons, spread leftover to first entries
  if (!byRarity.has('common') && leftover > 0 && result.length > 0) {
    result[0].pull_percentage = Math.round((result[0].pull_percentage + leftover) * 100) / 100
  }

  // Fix rounding so total is exactly 100
  const total = result.reduce((sum, e) => sum + e.pull_percentage, 0)
  if (result.length > 0) {
    result[0].pull_percentage = Math.round((result[0].pull_percentage + (100 - total)) * 100) / 100
  }

  return result
}
