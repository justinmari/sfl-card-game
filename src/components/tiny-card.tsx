'use client'

import { rarityColors, rarityGlow } from './trading-card'
import type { TinyCardEntry } from '@/lib/pack-cards'

// A minimal card-shaped tile: just the art + a rarity-colored border. Owned
// cards reveal their image and show the title on hover; unowned cards render a
// blank placeholder. An unowned card carries NO id/name/image (see
// buildPackCardGrid), so its identity is never present in the DOM — only its
// rarity, which the border intentionally shows.
export default function TinyCard({ card }: { card: TinyCardEntry }) {
  const border = rarityColors[card.rarity] ?? 'border-zinc-600'
  return (
    <div
      className="group relative"
      style={{ aspectRatio: '3 / 4' }}
      data-testid="tiny-card"
      data-owned={card.owned}
    >
      <div className={`h-full w-full overflow-hidden rounded-md border ${border} ${card.owned ? rarityGlow[card.rarity] ?? '' : ''}`}>
        {card.owned ? (
          card.image_url ? (
            <img src={card.image_url} alt={card.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-sm">🃏</div>
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900/70">
            <span className="text-base font-bold text-zinc-700" aria-hidden>?</span>
            <span className="sr-only">Undiscovered card</span>
          </div>
        )}
      </div>

      {/* Title tooltip on hover — owned cards only (sits outside the clipped
          inner box so it isn't cut off). */}
      {card.owned && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-lg ring-1 ring-white/10 group-hover:block">
          {card.name}
        </div>
      )}
    </div>
  )
}
