import { RARITIES } from './rarities'

// A pack_cards row joined to its card (as fetched in the shop page).
export type PackCardSource = {
  card_id: string
  cards: { id: string; name: string; rarity: string; image_url: string | null } | null
}

// One cell in the buy-modal card grid. An UNOWNED card is reduced to its rarity
// only — no id/name/image — so a card the player hasn't found yet can never be
// revealed through the client DOM. Owned cards carry their full display data.
export type TinyCardEntry =
  | { owned: true; id: string; name: string; rarity: string; image_url: string | null }
  | { owned: false; rarity: string }

export const rarityRank = (r: string): number => RARITIES.findIndex((x) => x.value === r)

// Build the pack's card grid: dedupe by card, drop identity for unowned cards,
// and sort rarest-first (stable within a rarity, so positions don't leak which
// unowned card is which beyond its rarity bucket).
export function buildPackCardGrid(packCards: PackCardSource[], ownedCardIds: Set<string>): TinyCardEntry[] {
  const seen = new Set<string>()
  const entries: TinyCardEntry[] = []
  for (const pc of packCards) {
    const c = pc.cards
    if (!c || seen.has(c.id)) continue
    seen.add(c.id)
    entries.push(
      ownedCardIds.has(c.id)
        ? { owned: true, id: c.id, name: c.name, rarity: c.rarity, image_url: c.image_url }
        : { owned: false, rarity: c.rarity },
    )
  }
  return entries.sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))
}
