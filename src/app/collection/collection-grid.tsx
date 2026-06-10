'use client'

import { useState } from 'react'
import TradingCard, { rarityColors, rarityBgColors, rarityGlow } from '@/components/trading-card'
import { rarityBadgeColors, rarityLabel } from '@/lib/rarities'

type Card = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  created_at: string
}

export default function CollectionGrid({
  cardCounts,
}: {
  cardCounts: { card: Card; count: number }[]
}) {
  const [selected, setSelected] = useState<{ card: Card; count: number } | null>(null)

  return (
    <>
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
            <div
              className={`overflow-hidden rounded-2xl border-3 ${rarityColors[selected.card.rarity]} bg-gradient-to-b ${rarityBgColors[selected.card.rarity]} ${rarityGlow[selected.card.rarity]} w-72`}
            >
              {selected.card.image_url && (
                <img
                  src={selected.card.image_url}
                  alt={selected.card.name}
                  className="aspect-[2.5/3.5] w-full object-cover"
                />
              )}
              <div className="p-5">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xl font-bold">{selected.card.name}</h2>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${rarityBadgeColors[selected.card.rarity]}`}
                  >
                    {rarityLabel[selected.card.rarity] || selected.card.rarity}
                  </span>
                </div>
                {selected.card.description && (
                  <p className="mb-3 text-sm text-zinc-400">
                    {selected.card.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>Owned: x{selected.count}</span>
                  <span>#{selected.card.id.slice(0, 8)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="mt-6 rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
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
