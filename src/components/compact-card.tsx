'use client'

import { useState, useRef, useCallback } from 'react'
import { rarityColors, rarityGlow } from './trading-card'
import { rarityBadgeColors, rarityLabel } from '@/lib/rarities'

type CardData = {
  id: string
  name: string
  image_url: string | null
  rarity: string
  description?: string | null
  creature_name?: string | null
  typeNames?: string[]
  is_new?: boolean
  /** Cosmetic finish/layout on the owned copy (see TradingCard). */
  edition?: string | null
}

export default function CompactCard({
  card,
  showNew,
  auraActive = false,
}: {
  card: CardData
  showNew?: boolean
  /** Force the edition's glow aura on (e.g. during a craft/pull celebration). */
  auraActive?: boolean
}) {
  // Holo editions: 'golden' (first) | 'diamond' (mid) | 'galaxy' (top).
  const galaxy = card.edition === 'galaxy'
  const diamond = card.edition === 'diamond'
  const golden = card.edition === 'golden'
  const starField = galaxy
  const lineField = golden
  const diamondField = diamond
  const aura = galaxy ? 'galaxy' : diamond ? 'diamond' : golden ? 'gold' : null
  const hasEdition = galaxy || diamond || golden

  const inner = (
    <div
      className={`relative w-full overflow-hidden rounded-lg border ${rarityColors[card.rarity]} ${rarityGlow[card.rarity]} transition-transform duration-200 hover:scale-105 flex flex-col`}
      style={{ aspectRatio: '3/4' }}
    >
      {galaxy && (
        <>
          <div className="holo-layer holo-behind holo-passive holo-galaxy-ambient" aria-hidden />
          <div className="holo-layer holo-galaxy-top" aria-hidden />
        </>
      )}
      {diamond && (
        <>
          <div className="holo-layer holo-behind holo-diamond-ambient" aria-hidden />
          <div className="holo-layer holo-diamond-top" aria-hidden />
        </>
      )}
      {golden && (
        <>
          <div className="holo-layer holo-behind holo-gold-ambient" aria-hidden />
          <div className="holo-layer holo-gold-sheen" aria-hidden />
        </>
      )}

      <div className="relative z-[1] flex-1 overflow-hidden">
        {card.image_url ? (
          <img src={card.image_url} alt={card.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-lg">🃏</div>
        )}
      </div>

      {/* Fields behind the photo (revealed by the spotlight in the chrome). */}
      {starField && (
        <>
          <div className="star-field" aria-hidden />
          <div className="star-spotlight" aria-hidden />
        </>
      )}
      {lineField && <div className="line-field" aria-hidden />}
      {diamondField && <div className="diamond-field" aria-hidden />}

      <div className="relative z-[1] bg-zinc-900 px-1.5 py-1 text-center flex-shrink-0">
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

  // Plain cards (no edition / aura) render exactly as before — no extra wrapper,
  // no pointer tracking.
  if (!hasEdition && !auraActive) return inner

  return <CompactCardHolo aura={aura} auraActive={auraActive}>{inner}</CompactCardHolo>
}

/** Wrapper that adds pointer tracking (--mx/--my/--holo/--pfc) and the glow aura
 *  around the card, only used when the card actually carries an edition. */
function CompactCardHolo({
  aura,
  auraActive = false,
  children,
}: {
  aura: string | null
  auraActive?: boolean
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shine, setShine] = useState({ x: 50, y: 50, c: 0 })
  const [hover, setHover] = useState(false)

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    setShine({ x: x * 100, y: y * 100, c: Math.min(1, Math.hypot(x - 0.5, y - 0.5) * 2) })
  }, [])

  const on = hover || auraActive

  return (
    <div
      ref={ref}
      className="holo-host compact-holo relative isolate w-full"
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false)
        setShine({ x: 50, y: 50, c: 0 })
      }}
      style={{
        '--mx': `${shine.x}%`,
        '--my': `${shine.y}%`,
        '--holo': hover ? 1 : 0,
        '--pfc': shine.c,
      } as React.CSSProperties}
    >
      {aura && (
        <>
          <div className={`card-aura card-aura-${aura}${on ? ' card-aura-on' : ''}`} aria-hidden />
          <div className={`card-aura card-aura-rays card-aura-${aura}-rays${on ? ' card-aura-on' : ''}`} aria-hidden />
        </>
      )}
      {children}
    </div>
  )
}
