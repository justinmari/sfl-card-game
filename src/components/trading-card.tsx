'use client'

import { useRef, useState, useCallback } from 'react'
import GifImage from './gif-image'

const rarityColors: Record<string, string> = {
  common: 'border-zinc-600',
  uncommon: 'border-green-500',
  rare: 'border-blue-500',
  ultra_rare: 'border-purple-500',
  secret_rare: 'border-pink-500',
  legendary: 'border-amber-400',
}

const rarityBgColors: Record<string, string> = {
  common: 'from-zinc-800 to-zinc-900',
  uncommon: 'from-green-950 to-zinc-900',
  rare: 'from-blue-950 to-zinc-900',
  ultra_rare: 'from-purple-950 to-zinc-900',
  secret_rare: 'from-pink-950 to-zinc-900',
  legendary: 'from-amber-950 to-zinc-900',
}

const rarityBadgeColors: Record<string, string> = {
  common: 'bg-zinc-600',
  uncommon: 'bg-green-700',
  rare: 'bg-blue-700',
  ultra_rare: 'bg-purple-700',
  secret_rare: 'bg-pink-700',
  legendary: 'bg-amber-700',
}

const rarityGlow: Record<string, string> = {
  common: '',
  uncommon: 'shadow-[0_0_15px_rgba(34,197,94,0.12)]',
  rare: 'shadow-[0_0_15px_rgba(59,130,246,0.2)]',
  ultra_rare: 'shadow-[0_0_20px_rgba(168,85,247,0.25)]',
  secret_rare: 'shadow-[0_0_20px_rgba(236,72,153,0.25)]',
  legendary: 'shadow-[0_0_25px_rgba(245,158,11,0.3)]',
}

const rarityLabel: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  ultra_rare: 'Ultra Rare',
  secret_rare: 'Secret Rare',
  legendary: 'Legendary',
}

const rarityStarCount: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  ultra_rare: 4,
  legendary: 5,
  secret_rare: 6,
}

const rarityStarColor: Record<string, string> = {
  common: 'text-zinc-500',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  ultra_rare: 'text-purple-400',
  secret_rare: 'text-pink-400',
  legendary: 'text-amber-400',
}

const rarityAccent: Record<string, string> = {
  common: 'from-zinc-600/20 to-transparent',
  uncommon: 'from-green-500/20 to-transparent',
  rare: 'from-blue-500/20 to-transparent',
  ultra_rare: 'from-purple-500/20 to-transparent',
  secret_rare: 'from-pink-500/20 to-transparent',
  legendary: 'from-amber-500/20 to-transparent',
}

const rarityShineColor: Record<string, string> = {
  common: 'rgba(161,161,170,0.15)',
  uncommon: 'rgba(34,197,94,0.2)',
  rare: 'rgba(59,130,246,0.2)',
  ultra_rare: 'rgba(168,85,247,0.25)',
  secret_rare: 'rgba(236,72,153,0.25)',
  legendary: 'rgba(245,158,11,0.3)',
}

type CardData = {
  id: string
  name: string
  description?: string | null
  image_url: string | null
  rarity: string
  creature_name?: string | null
  skillNames?: string[]
  skillDescriptions?: string[]
  typeNames?: string[]
}

type Size = 'sm' | 'md' | 'lg'

const sizeClasses: Record<Size, {
  wrapper: string
  name: string
  desc: string
  descHeight: string
  stars: string
  label: string
}> = {
  sm: {
    wrapper: 'w-[8.5rem]',
    name: 'text-[11px]',
    desc: 'text-[9px]',
    descHeight: 'h-6',
    stars: 'text-[8px]',
    label: 'text-[8px]',
  },
  md: {
    wrapper: 'w-[11.5rem]',
    name: 'text-sm',
    desc: 'text-[11px]',
    descHeight: 'h-8',
    stars: 'text-[10px]',
    label: 'text-[9px]',
  },
  lg: {
    wrapper: 'w-[18rem]',
    name: 'text-lg',
    desc: 'text-sm',
    descHeight: 'h-12',
    stars: 'text-sm',
    label: 'text-xs',
  },
}

export default function TradingCard({
  card,
  size = 'md',
  count,
  onClick,
  className = '',
  children,
  animated = false,
  testId,
}: {
  card: CardData
  size?: Size
  count?: number
  onClick?: () => void
  className?: string
  children?: React.ReactNode
  animated?: boolean
  testId?: string
}) {
  const s = sizeClasses[size]
  const stars = rarityStarCount[card.rarity] || 1
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })
  const [shine, setShine] = useState({ x: 50, y: 50 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const maxTilt = 15
    setTilt({
      rotateX: (0.5 - y) * maxTilt,
      rotateY: (x - 0.5) * maxTilt,
    })
    setShine({ x: x * 100, y: y * 100 })
  }, [])

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setTilt({ rotateX: 0, rotateY: 0 })
    setShine({ x: 50, y: 50 })
  }, [])

  const shineColor = rarityShineColor[card.rarity] || 'rgba(255,255,255,0.15)'
  // gif and (animated) webp both freeze to a poster and play on hover.
  const isAnimated = /\.(gif|webp)(\?|$)/i.test(card.image_url ?? '')
  const showAnimated = isAnimated && (isHovered || animated)

  return (
    <div
      ref={cardRef}
      data-testid={testId}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`${s.wrapper} relative ${onClick ? 'cursor-pointer' : ''} select-none ${className}`}
      style={{ perspective: '800px', zIndex: isHovered ? 40 : undefined }}
    >
      <div
        className={`relative flex flex-col overflow-hidden rounded-2xl border ${rarityColors[card.rarity]} bg-zinc-900 ${isHovered ? 'shadow-2xl ' + rarityGlow[card.rarity] : ''} ${onClick ? 'text-left' : ''}`}
        style={{
          transform: isHovered
            ? `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale(1.05)`
            : 'rotateX(0) rotateY(0) scale(1)',
          transition: isHovered ? 'transform 0.1s ease-out, box-shadow 0.3s' : 'transform 0.4s ease-out, box-shadow 0.3s',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Shine overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
          style={{
            background: isHovered
              ? `radial-gradient(circle at ${shine.x}% ${shine.y}%, ${shineColor} 0%, transparent 60%)`
              : 'none',
            transition: 'opacity 0.3s',
          }}
        />

        {/* Accent gradient at top */}
        <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${rarityAccent[card.rarity]} pointer-events-none`} />

        {/* Image */}
        <div className="relative mx-2 mt-2 overflow-hidden rounded-xl">
          {card.image_url ? (
            isAnimated ? (
              <GifImage
                src={card.image_url}
                alt={card.name}
                className="aspect-[5/6] w-full object-cover block"
                animate={showAnimated}
              />
            ) : (
              <img
                src={card.image_url}
                alt={card.name}
                className="aspect-[5/6] w-full object-cover block"
              />
            )
          ) : (
            <div className="aspect-[5/6] w-full flex items-center justify-center bg-zinc-800">
              <span className="text-3xl opacity-30">🃏</span>
            </div>
          )}
          {/* Rarity label overlay on image */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 via-30% to-transparent px-2 pb-1.5 pt-10">
            <span className={`${s.label} font-medium uppercase tracking-wider ${rarityStarColor[card.rarity]}`}>
              {rarityLabel[card.rarity] || card.rarity}
            </span>
            <p
              className={`${s.label} truncate mt-0.5 ${card.typeNames && card.typeNames.length > 0 ? 'pr-12' : ''}`}
              style={{ fontFamily: 'Georgia, serif' }}
            >
              <span className="text-zinc-400 italic">Creature: </span>
              <span className="text-zinc-200">{card.creature_name || 'Unknown'}</span>
            </p>
          </div>

          {/* Types — pinned to the image's bottom-right, absolutely positioned so they
              never push the rarity/creature labels */}
          {card.typeNames && card.typeNames.length > 0 && (
            <div className="absolute bottom-1.5 right-1.5 z-10 flex max-w-[70%] flex-wrap justify-end gap-1">
              {card.typeNames.map((name, i) => (
                <span
                  key={i}
                  data-testid="card-type"
                  className={`${s.label} rounded-full border border-cyan-700/60 bg-cyan-950/60 px-1.5 py-0.5 font-medium text-cyan-300 backdrop-blur-sm`}
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Card info */}
        <div className="flex flex-1 flex-col px-3 py-2.5">
          <p className={`${s.name} font-bold truncate text-white leading-tight`}>{card.name}</p>
          <div className={`${s.descHeight} mt-1 overflow-y-auto`}>
            {card.description ? (
              <p className={`${s.desc} text-zinc-500 leading-snug whitespace-pre-wrap`}>{card.description}</p>
            ) : (
              <p className={`${s.desc} text-zinc-700 italic leading-snug`}>No description</p>
            )}
          </div>

          {/* Stars + Skill indicator (icon only; details in hover tooltip) */}
          <div className={`mt-auto flex items-center justify-between gap-2 pt-2`}>
            <div className={`flex flex-shrink-0 items-center gap-[3px] ${s.stars} ${rarityStarColor[card.rarity]}`}>
              {Array.from({ length: stars }).map((_, i) => (
                <span key={i}>★</span>
              ))}
            </div>
            {card.skillNames && card.skillNames.length > 0 && (
              <span className={`${s.stars} flex-shrink-0 font-medium text-pink-400`} aria-label="Has a skill">
                ✦{card.skillNames.length > 1 ? `×${card.skillNames.length}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* Count badge */}
        {count && count > 1 && (
          <span className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
            x{count}
          </span>
        )}
        {children}
      </div>

      {/* Skill tooltip on hover (outside the overflow-hidden card so it isn't clipped) */}
      {isHovered && card.skillNames && card.skillNames.length > 0 && (
        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-48 -translate-x-1/2 rounded-lg border border-pink-800/60 bg-zinc-900/95 p-2.5 text-left shadow-xl backdrop-blur-sm">
          {card.skillNames.map((name, i) => (
            <div key={i} className={i > 0 ? 'mt-2 border-t border-zinc-800 pt-2' : ''}>
              <p className="text-xs font-bold text-pink-400">✦ {name}</p>
              {card.skillDescriptions?.[i] && (
                <p className="mt-0.5 text-[10px] leading-snug text-zinc-400">{card.skillDescriptions[i]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { rarityColors, rarityBgColors, rarityBadgeColors, rarityGlow, rarityLabel, rarityStarCount, rarityStarColor, rarityShineColor }
