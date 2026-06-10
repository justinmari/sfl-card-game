'use client'

import { useState } from 'react'
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

export default function CollectionGrid({
  cardCounts,
}: {
  cardCounts: { card: Card; count: number }[]
}) {
  const [selected, setSelected] = useState<{ card: Card; count: number } | null>(null)

  return (
    <>
      {/* Preview modal — uses the large TradingCard */}
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
      <div className="flex flex-wrap gap-4">
        {cardCounts.map(({ card, count }) => (
          <TradingCard
            key={card.id}
            card={card}
            size="md"
            count={count}
            onClick={() => setSelected({ card, count })}
          />
        ))}
      </div>
    </>
  )
}
