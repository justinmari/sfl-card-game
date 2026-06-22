'use client'

import { useState, useEffect, useCallback } from 'react'
import TradingCard from '@/components/trading-card'

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
  { value: null, label: 'Standard', blurb: 'The base card — no finish.' },
  { value: 'foil', label: 'Foil', family: 'Balatro', blurb: 'Cool metallic streaks that sweep with the pointer.' },
  { value: 'holographic', label: 'Holographic', family: 'Balatro', blurb: 'Rainbow sheen + sparkle rings that tilt with the card.' },
  { value: 'polychrome', label: 'Polychrome', family: 'Balatro', blurb: 'A full-spectrum rainbow prism that slowly rotates.' },
  { value: 'negative', label: 'Negative — dark cosmic', family: 'Balatro', blurb: 'Whole card inverted; cosmic shimmer stays dark on top.' },
  { value: 'negative-true', label: 'Negative — true invert', family: 'Balatro', blurb: 'Whole card flips to a pale photo-negative.' },
  { value: 'golden', label: 'Golden', family: 'Hearthstone', blurb: 'Warm gold with a sweeping light band and twinkling glints.' },
  { value: 'signature', label: 'Signature', family: 'Hearthstone', blurb: 'Soft pastel-prismatic sheen that drifts slowly.' },
  { value: 'diamond', label: 'Diamond', family: 'Hearthstone', blurb: 'Crystalline facets, rotating prism refraction, bright sparkles.' },
  { value: 'aurora', label: 'Aurora', family: 'Experimental', blurb: 'Flowing northern-lights ribbons that drift across.' },
  { value: 'lava', label: 'Lava / Magma', family: 'Experimental', blurb: 'Molten flowing glow with bright glowing cracks.' },
  { value: 'electric', label: 'Electric', family: 'Experimental', blurb: 'Arcing hairline bolts with a flickering blue glow.' },
  { value: 'water', label: 'Water / Caustics', family: 'Experimental', blurb: 'Rippling pool-light caustic patterns.' },
  { value: 'pearl', label: 'Pearlescent', family: 'Experimental', blurb: 'Soft mother-of-pearl iridescence.' },
  { value: 'kaleido', label: 'Kaleidoscope', family: 'Experimental', blurb: 'Rotating mirrored faceted shards of color.' },
  { value: 'vapor', label: 'Vaporwave', family: 'Experimental', blurb: 'Retro perspective grid + sunset gradient, scrolling.' },
  { value: 'ruby', label: 'Gem — Ruby', family: 'Experimental', blurb: 'Ruby-tinted crystal: faceted, prism refraction, sparkles.' },
  { value: 'emerald', label: 'Gem — Emerald', family: 'Experimental', blurb: 'Emerald-tinted crystal: faceted, prism refraction, sparkles.' },
  { value: 'sapphire', label: 'Gem — Sapphire', family: 'Experimental', blurb: 'Sapphire-tinted crystal: faceted, prism refraction, sparkles.' },
]

export default function HoloPreview({ cards }: { cards: Card[] }) {
  const [selectedId, setSelectedId] = useState<string>(cards[0]?.id ?? '')
  const [index, setIndex] = useState(0)
  const selected = cards.find((c) => c.id === selectedId) ?? cards[0]
  const ed = EDITIONS[index]

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
      {/* Which card to preview */}
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
      </div>

      {/* Flip-through stage */}
      <div className="flex items-center justify-center gap-4 sm:gap-8">
        <button type="button" aria-label="Previous edition" onClick={() => go(-1)} className={arrow}>‹</button>
        <TradingCard
          key={ed.value ?? 'standard'}
          card={{ ...selected, edition: ed.value }}
          size="lg"
          testId={`holo-card-${ed.value ?? 'standard'}`}
        />
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
