'use client'

import { rarityColors, rarityGlow } from './trading-card'
import { rarityBadgeColors, rarityLabel } from '@/lib/rarities'

type CardData = {
  id: string
  name: string
  image_url: string | null
  rarity: string
  description?: string | null
  creature_name?: string | null
  is_new?: boolean
}

export default function CompactCard({ card, showNew }: { card: CardData; showNew?: boolean }) {
  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border ${rarityColors[card.rarity]} ${rarityGlow[card.rarity]} transition-transform duration-200 hover:scale-105 flex flex-col`}
      style={{ aspectRatio: '3/4' }}
    >
      <div className="flex-1 overflow-hidden">
        {card.image_url ? (
          <img src={card.image_url} alt={card.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-lg">🃏</div>
        )}
      </div>
      <div className="bg-zinc-900 px-1.5 py-1 text-center flex-shrink-0">
        <p className="truncate text-[9px] font-semibold text-white">{card.name}</p>
        <span className={`inline-block rounded px-1 py-0.5 text-[7px] ${rarityBadgeColors[card.rarity]}`}>
          {rarityLabel[card.rarity] || card.rarity}
        </span>
      </div>
      {showNew && card.is_new && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 rounded-full bg-green-500 px-1.5 py-0.5 text-[7px] font-bold text-white shadow">
          NEW
        </div>
      )}
    </div>
  )
}
