'use client'

import { useState, useMemo } from 'react'
import TradingCard, { rarityStarCount, rarityStarColor } from '@/components/trading-card'
import { rarityLabel } from '@/lib/rarities'

type Card = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  creature_name?: string | null
}

type PackFilter = {
  id: string
  name: string
  cardIds: string[]
}

export default function CollectionGrid({
  cardCounts,
  packFilters,
}: {
  cardCounts: { card: Card; count: number }[]
  packFilters: PackFilter[]
}) {
  const [selected, setSelected] = useState<{ card: Card; count: number } | null>(null)
  const [activePack, setActivePack] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (!activePack) return cardCounts
    const pack = packFilters.find((p) => p.id === activePack)
    if (!pack) return cardCounts
    const cardIdSet = new Set(pack.cardIds)
    return cardCounts.filter(({ card }) => cardIdSet.has(card.id))
  }, [cardCounts, activePack, packFilters])

  const totalCards = filtered.reduce((sum, { count }) => sum + count, 0)

  return (
    <>
      {/* Pack filter */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActivePack(null)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              activePack === null
                ? 'bg-white text-zinc-900 font-medium'
                : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            All ({cardCounts.length})
          </button>
          {packFilters.map((pack) => {
            const ownedFromPack = cardCounts.filter(({ card }) =>
              pack.cardIds.includes(card.id)
            ).length
            return (
              <button
                key={pack.id}
                onClick={() => setActivePack(activePack === pack.id ? null : pack.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  activePack === pack.id
                    ? 'bg-white text-zinc-900 font-medium'
                    : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {pack.name} ({ownedFromPack}/{pack.cardIds.length})
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          {totalCards} card{totalCards !== 1 ? 's' : ''} ({filtered.length} unique)
        </p>
      </div>

      {/* Preview modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <TradingCard card={selected.card} size="lg" count={selected.count} animated />
            <div className="mt-4 flex items-center gap-4 text-sm text-zinc-400">
              <span>{rarityLabel[selected.card.rarity] || selected.card.rarity}</span>
              <span className={`flex gap-1 ${rarityStarColor[selected.card.rarity]}`}>
                {Array.from({ length: rarityStarCount[selected.card.rarity] || 1 }).map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </span>
              <span>Owned: x{selected.count}</span>
              <span>#{selected.card.id.slice(0, 8)}</span>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="mt-4 rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Card grid */}
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">No cards from this pack yet.</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {filtered.map(({ card, count }) => (
            <TradingCard
              key={card.id}
              card={card}
              size="md"
              count={count}
              onClick={() => setSelected({ card, count })}
            />
          ))}
        </div>
      )}
    </>
  )
}
