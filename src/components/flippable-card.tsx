'use client'

import { useState, useRef, useCallback } from 'react'
import TradingCard, { rarityColors, rarityShineColor } from './trading-card'

const backGlowStyle: Record<string, string> = {
  common: '0 0 15px rgba(161,161,170,0.15)',
  uncommon: '0 0 18px rgba(34,197,94,0.2)',
  rare: '0 0 20px rgba(59,130,246,0.25)',
  ultra_rare: '0 0 22px rgba(168,85,247,0.28)',
  legendary: '0 0 24px rgba(245,158,11,0.3)',
  secret_rare: '0 0 26px rgba(236,72,153,0.32)',
}

type CardData = {
  id: string
  name: string
  description?: string | null
  image_url: string | null
  rarity: string
}

export default function FlippableCard({ card, size = 'sm', forceFlip = false }: { card: CardData; size?: 'sm' | 'md' | 'lg'; forceFlip?: boolean }) {
  const [flipped, setFlipped] = useState(false)
  const isFlipped = flipped || forceFlip
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

  const widths = { sm: 'w-[8.5rem]', md: 'w-[11.5rem]', lg: 'w-[18rem]' }

  // Only apply tilt when not flipped
  const showTilt = isHovered && !isFlipped

  return (
    <div className={`${widths[size]}`}>
      <div className="relative">
        {/* Hidden card to set natural height */}
        <div className="invisible">
          <TradingCard card={card} size={size} />
        </div>

        {/* Flip container */}
        <div
          ref={cardRef}
          className={`absolute inset-0 ${!isFlipped ? 'cursor-pointer' : ''}`}
          style={{ perspective: '800px' }}
          onClick={() => !flipped && setFlipped(true)}
          onMouseMove={!isFlipped ? handleMouseMove : undefined}
          onMouseEnter={!isFlipped ? handleMouseEnter : undefined}
          onMouseLeave={!isFlipped ? handleMouseLeave : undefined}
        >
          <div
            className="relative h-full w-full"
            style={{
              transformStyle: 'preserve-3d',
              transition: isFlipped && !showTilt
                ? 'transform 0.6s ease'
                : showTilt
                  ? 'transform 0.1s ease-out'
                  : 'transform 0.4s ease-out',
              transform: isFlipped
                ? 'rotateY(180deg)'
                : `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)${showTilt ? ' scale(1.05)' : ''}`,
            }}
          >
            {/* Back side */}
            <div
              className={`absolute inset-0 rounded-2xl overflow-hidden border ${showTilt ? 'border-2 ' + rarityColors[card.rarity] : 'border-zinc-700'} bg-gradient-to-br from-zinc-700 via-zinc-800 to-zinc-700`}
              style={{
                backfaceVisibility: 'hidden',
                boxShadow: showTilt ? backGlowStyle[card.rarity] || 'none' : 'none',
                transition: 'box-shadow 0.5s ease, border-color 0.5s ease',
              }}
            >
              {/* Rarity shine overlay */}
              {showTilt && (
                <div
                  className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
                  style={{
                    background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, ${rarityShineColor[card.rarity] || 'rgba(255,255,255,0.15)'} 0%, transparent 55%)`,
                  }}
                />
              )}
              {/* Pattern */}
              <div className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg, white 0px, white 1px, transparent 1px, transparent 12px),
                    repeating-linear-gradient(-45deg, white 0px, white 1px, transparent 1px, transparent 12px)`,
                }}
              />
              {/* Center logo */}
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl opacity-40">🃏</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">SFL</span>
                </div>
              </div>
              {/* Border inset */}
              <div className="absolute inset-2 rounded-xl border border-zinc-600/50" />
            </div>

            {/* Front side */}
            <div
              className="absolute inset-0"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <TradingCard card={card} size={size} animated={isFlipped} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
