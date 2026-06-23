'use client'

import { useState, useEffect, useCallback } from 'react'
import TradingCard from '@/components/trading-card'
import CompactCard from '@/components/compact-card'

type Card = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  creature_name: string | null
  typeNames?: string[]
}

type Edition = { value: string | null; label: string; family?: string; blurb: string }

const EDITIONS: Edition[] = [
  { value: null, label: 'Standard', blurb: 'The base card — no holo.' },
  { value: 'golden', label: 'Golden', family: 'First tier', blurb: 'Amber gold ambience behind the photo + diagonal gold lines with a hover flashlight, gold rays + nebula aura.' },
  { value: 'diamond', label: 'Diamond', family: 'Mid tier', blurb: 'Icy azure/white ambience + a faceted jewel pattern in the text area whose edges light up under the flashlight, azure rays + nebula aura.' },
  { value: 'galaxy', label: 'Galaxy', family: 'Top tier', blurb: 'Rainbow galaxy foil + a star field behind the photo with a hover spotlight, cosmic nebula aura.' },
]

const COUNTS = [1, 3, 5, 10, 20, 50, 100]

export default function HoloPreview({ cards }: { cards: Card[] }) {
  const [selectedId, setSelectedId] = useState<string>(cards[0]?.id ?? '')
  const [index, setIndex] = useState(0)
  const [count, setCount] = useState(1)
  const [forceAura, setForceAura] = useState(false)
  const [compact, setCompact] = useState(false)
  const selected = cards.find((c) => c.id === selectedId) ?? cards[0]
  const ed = EDITIONS[index]

  // Bigger cards when there are few; shrink as the count grows so they tile.
  const cardSize = count === 1 ? 'lg' : count <= 5 ? 'md' : 'sm'

  const go = useCallback((dir: number) => {
    setIndex((i) => (i + dir + EDITIONS.length) % EDITIONS.length)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  if (!selected) {
    return <p className="py-10 text-center text-sm text-zinc-500">No cards to preview yet.</p>
  }

  const arrow =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/30 text-xl text-zinc-300 transition-colors hover:border-violet-400/70 hover:text-white'

  return (
    <div>
      {/* Which card to preview + how many */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <label htmlFor="holo-card" className="text-sm text-zinc-400">Card</label>
        <select
          id="holo-card"
          aria-label="Preview card"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="input-arcade max-w-[16rem] px-3 py-2 text-sm"
        >
          {cards.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label htmlFor="holo-count" className="ml-2 text-sm text-zinc-400">Cards on screen</label>
        <select
          id="holo-count"
          aria-label="Cards on screen"
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="input-arcade px-3 py-2 text-sm"
        >
          {COUNTS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>

        <label className="ml-2 flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            aria-label="Force aura"
            checked={forceAura}
            onChange={(e) => setForceAura(e.target.checked)}
          />
          Force aura (craft/pull)
        </label>

        <label className="ml-2 flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            aria-label="Compact card"
            checked={compact}
            onChange={(e) => setCompact(e.target.checked)}
          />
          Compact card
        </label>
      </div>

      {/* Flip-through stage */}
      <div className="flex items-center justify-center gap-4 sm:gap-8">
        <button type="button" aria-label="Previous edition" onClick={() => go(-1)} className={arrow}>‹</button>
        <div className="flex flex-wrap items-start justify-center gap-3" data-testid="holo-grid">
          {Array.from({ length: count }).map((_, i) =>
            compact ? (
              <div key={`${ed.value ?? 'standard'}-${i}`} className="w-[9rem]">
                <CompactCard
                  card={{ ...selected, edition: ed.value }}
                  auraActive={forceAura}
                />
              </div>
            ) : (
              <TradingCard
                key={`${ed.value ?? 'standard'}-${i}`}
                card={{ ...selected, edition: ed.value }}
                size={cardSize}
                auraActive={forceAura}
                testId={i === 0 ? `holo-card-${ed.value ?? 'standard'}` : undefined}
              />
            )
          )}
        </div>
        <button type="button" aria-label="Next edition" onClick={() => go(1)} className={arrow}>›</button>
      </div>

      {/* Caption */}
      <div className="mt-6 text-center">
        {ed.family && (
          <span className="mb-2 inline-block rounded-full border border-violet-400/30 bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-medium text-violet-300">
            {ed.family}
          </span>
        )}
        <h3 data-testid="holo-edition-label" className="font-display text-xl font-bold">{ed.label}</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-400">{ed.blurb}</p>
        <p data-testid="holo-position" className="mt-2 text-xs text-zinc-600">{index + 1} / {EDITIONS.length}</p>
      </div>

      {/* Jump-to chips */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {EDITIONS.map((e, i) => (
          <button
            key={e.label}
            type="button"
            onClick={() => setIndex(i)}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              i === index
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-white'
                : 'border border-white/10 bg-black/20 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>

      <p className="mt-6 text-center text-[11px] text-zinc-600">Tip: use ← / → arrow keys to flip through finishes.</p>
    </div>
  )
}
