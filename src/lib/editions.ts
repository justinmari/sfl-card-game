// Holo edition helpers shared across the collection, badges, and modal.

export const ALL_EDITIONS = ['regular', 'golden', 'diamond', 'galaxy'] as const
export type Edition = (typeof ALL_EDITIONS)[number]

export const HOLO_EDITIONS = ['golden', 'diamond', 'galaxy'] as const

/** Sort order, lowest → highest finish. */
export const EDITION_RANK: Record<Edition, number> = { regular: 0, golden: 1, diamond: 2, galaxy: 3 }

export const EDITION_LABEL: Record<Edition, string> = {
  regular: 'Regular',
  golden: 'Golden',
  diamond: 'Diamond',
  galaxy: 'Galaxy',
}

/** Tailwind dot colour per edition for the count badges. */
export const EDITION_DOT: Record<Edition, string> = {
  regular: 'bg-zinc-300',
  golden: 'bg-amber-400',
  diamond: 'bg-sky-300',
  galaxy: 'bg-fuchsia-400',
}

export type EditionCounts = Partial<Record<Edition, number>>

export function isHoloEdition(e?: string | null): e is 'golden' | 'diamond' | 'galaxy' {
  return e === 'golden' || e === 'diamond' || e === 'galaxy'
}

/** The highest-rank edition the user owns (regular if only regular; null if none). */
export function rarestEdition(counts: EditionCounts): Edition | null {
  let best: Edition | null = null
  for (const e of ALL_EDITIONS) {
    if ((counts[e] ?? 0) > 0 && (best === null || EDITION_RANK[e] > EDITION_RANK[best])) best = e
  }
  return best
}

/** True if the user owns any holo finish of the card. */
export function ownsAnyHolo(counts: EditionCounts): boolean {
  return HOLO_EDITIONS.some((e) => (counts[e] ?? 0) > 0)
}

/** Owned editions, rarest first — for the modal's finish-swap buttons. */
export function ownedEditionsRarestFirst(counts: EditionCounts): Edition[] {
  return ALL_EDITIONS.filter((e) => (counts[e] ?? 0) > 0).sort((a, b) => EDITION_RANK[b] - EDITION_RANK[a])
}
