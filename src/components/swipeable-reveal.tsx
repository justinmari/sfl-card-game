'use client'

import { useState, useRef, useCallback } from 'react'
import FlippableCard from './flippable-card'

type CardData = {
  id: string
  name: string
  description?: string | null
  image_url: string | null
  rarity: string
  creature_name?: string | null
}

export default function SwipeableReveal({
  cards,
  flipAll,
  onFlipAll,
  onDone,
}: {
  cards: CardData[]
  flipAll: boolean
  onFlipAll: () => void
  onDone: () => void
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchDelta, setTouchDelta] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const goTo = useCallback((idx: number) => {
    setCurrentIndex(Math.max(0, Math.min(cards.length - 1, idx)))
    setTouchDelta(0)
  }, [cards.length])

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return
    setTouchDelta(e.touches[0].clientX - touchStart)
  }

  const handleTouchEnd = () => {
    if (Math.abs(touchDelta) > 50) {
      if (touchDelta < 0) goTo(currentIndex + 1)
      else goTo(currentIndex - 1)
    }
    setTouchStart(null)
    setTouchDelta(0)
  }

  return (
    <div className="flex flex-col items-center">
      <h2 className="mb-2 text-center text-xl font-bold">Tap to reveal!</h2>
      <p className="mb-4 text-center text-sm text-zinc-400">
        {currentIndex + 1} / {cards.length}
      </p>

      {/* Swipeable card area */}
      <div
        ref={containerRef}
        className="relative mb-6 w-full overflow-hidden"
        style={{ height: '320px' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{
            transform: `translateX(calc(-${currentIndex * 100}% + ${touchDelta}px))`,
            transition: touchStart !== null ? 'none' : 'transform 0.3s ease-out',
          }}
        >
          {cards.map((card, i) => (
            <div
              key={i}
              className="flex w-full flex-shrink-0 items-center justify-center"
            >
              <FlippableCard card={card} size="md" forceFlip={flipAll} />
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      <div className="mb-4 flex gap-1.5">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`h-2 rounded-full transition-all ${
              i === currentIndex ? 'w-4 bg-white' : 'w-2 bg-zinc-600'
            }`}
          />
        ))}
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        {!flipAll && (
          <button
            onClick={onFlipAll}
            className="rounded-lg border border-zinc-600 px-5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            Flip All
          </button>
        )}
        <button
          onClick={onDone}
          className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          Done
        </button>
      </div>
    </div>
  )
}
