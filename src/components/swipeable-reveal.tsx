'use client'

import { useState, useRef, useEffect } from 'react'
import FlippableCard from './flippable-card'
import CompactCard from './compact-card'
import RarityCelebration from './rarity-celebration'
import { playSwipe, playFlip, playCelebration } from '@/lib/sounds'

type CardData = {
  id: string
  name: string
  description?: string | null
  image_url: string | null
  rarity: string
  creature_name?: string | null
  is_new?: boolean
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
  const [showAll, setShowAll] = useState(false)
  const [hasShownFirst, setHasShownFirst] = useState(false)
  const [firstFlipped, setFirstFlipped] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [animatingOut, setAnimatingOut] = useState(false)
  const [autoMode, setAutoMode] = useState(false)
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [celebrateRarity, setCelebrateRarity] = useState('')
  const [celebrateTrigger, setCelebrateTrigger] = useState(0)
  const dragStartRef = useRef<number | null>(null)
  const isLast = currentIndex >= cards.length - 1

  // Shared drag logic
  const startDrag = (x: number) => {
    if (isLast) return
    dragStartRef.current = x
    setIsDragging(true)
  }

  const moveDrag = (x: number) => {
    if (dragStartRef.current === null) return
    setDragX(x - dragStartRef.current)
  }

  const endDrag = () => {
    if (dragStartRef.current === null) return
    dragStartRef.current = null
    setIsDragging(false)

    if (Math.abs(dragX) > 80 && !isLast) {
      playSwipe()
      const dir = dragX < 0 ? -1 : 1
      setAnimatingOut(true)
      setDragX(dir * 400)
      setTimeout(() => {
        setCurrentIndex((prev) => prev + 1)
        setDragX(0)
        setAnimatingOut(false)
        // Delay celebration so flip gets priority
        const nextCard = cards[currentIndex + 1]
        if (nextCard) {
          requestAnimationFrame(() => {
            setCelebrateRarity(nextCard.rarity)
            setCelebrateTrigger((prev) => prev + 1)
            playCelebration(nextCard.rarity)
          })
        }
      }, 200)
    } else {
      setDragX(0)
    }
  }

  const goNext = () => {
    if (isLast || animatingOut) return
    playSwipe()
    setAnimatingOut(true)
    setDragX(400)
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1)
      setDragX(0)
      setAnimatingOut(false)
      const nextCard = cards[currentIndex + 1]
      if (nextCard) {
        requestAnimationFrame(() => {
          setCelebrateRarity(nextCard.rarity)
          setCelebrateTrigger((prev) => prev + 1)
          playCelebration(nextCard.rarity)
        })
      }
    }, 300)
  }

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => startDrag(e.touches[0].clientX)
  const handleTouchMove = (e: React.TouchEvent) => moveDrag(e.touches[0].clientX)
  const handleTouchEnd = () => endDrag()

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); startDrag(e.clientX) }
  const handleMouseMove = (e: React.MouseEvent) => moveDrag(e.clientX)
  const handleMouseUp = () => endDrag()
  const handleMouseLeave = () => { if (isDragging) endDrag() }

  const handleFlipAll = () => {
    setShowAll(true)
    onFlipAll()
  }

  const rotation = (isDragging || animatingOut) ? dragX * 0.08 : 0
  const currentTranslateX = dragX
  const opacity = 1 - Math.abs(dragX) * 0.001
  const dragProgress = Math.min(Math.abs(dragX) / 200, 1)
  const nextCard = currentIndex + 1 < cards.length ? cards[currentIndex + 1] : null

  // Auto swipe mode — stops on new cards
  useEffect(() => {
    if (autoMode && !animatingOut && currentIndex < cards.length - 1) {
      const nextCard = cards[currentIndex + 1]
      if (nextCard?.is_new) {
        // Swipe to reveal the new card, then stop
        autoRef.current = setTimeout(() => {
          goNext()
          setAutoMode(false)
        }, 800)
      } else {
        autoRef.current = setTimeout(() => {
          goNext()
        }, 800)
      }
      return () => { if (autoRef.current) clearTimeout(autoRef.current) }
    }
    if (autoMode && currentIndex >= cards.length - 1) {
      setAutoMode(false)
    }
  }, [autoMode, animatingOut, currentIndex, cards.length])

  useEffect(() => {
    if (!hasShownFirst && cards.length > 0) {
      const t = setTimeout(() => {
        setFirstFlipped(true)
        setHasShownFirst(true)
        setCelebrateRarity(cards[0].rarity)
        setCelebrateTrigger((prev) => prev + 1)
        playCelebration(cards[0].rarity)
      }, 600)
      return () => clearTimeout(t)
    }
  }, [hasShownFirst, cards])

  // Show all mode
  if (showAll) {
    return (
      <>
        {/* Mobile: full screen */}
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 sm:hidden">
          <h2 className="mb-3 text-center text-xl font-bold text-white">You pulled:</h2>
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-2 pb-4">
              {cards.map((card, i) => (
                <CompactCard key={i} card={card} showNew />
              ))}
            </div>
          </div>
          <div className="flex justify-center pt-3">
            <button onClick={onDone} className="btn-arcade rounded-lg px-6 py-2.5 text-sm">Done</button>
          </div>
        </div>
        {/* Desktop: contained overlay */}
        <div data-testid="reveal-summary-desktop" className="fixed inset-0 z-50 hidden sm:flex items-center justify-center bg-black/80" onClick={onDone}>
          <div className="max-w-3xl w-full mx-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-center text-xl font-bold text-white">You pulled:</h2>
            <div className="max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-6 gap-3 pb-4">
                {cards.map((card, i) => (
                  <CompactCard key={i} card={card} showNew />
                ))}
              </div>
            </div>
            <div className="flex justify-center pt-4">
              <button onClick={onDone} className="btn-arcade rounded-lg px-6 py-2.5 text-sm">Done</button>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <RarityCelebration
        rarity={celebrateRarity}
        trigger={celebrateTrigger}
        auraRarity={nextCard?.rarity}
        auraIntensity={isDragging ? dragProgress : 0}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-sm text-zinc-400">
          {currentIndex + 1} / {cards.length}
        </p>
        <p className="text-sm font-medium text-white">
          {isLast ? 'Last card!' : 'Swipe to see next'}
        </p>
        <div className="w-12" />
      </div>

      {/* Card stack */}
      <div
        className="relative flex-1 select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={isDragging ? handleMouseMove : undefined}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {cards.map((card, i) => {
          if (i < currentIndex) return null
          const isCurrent = i === currentIndex
          const isNext = i === currentIndex + 1
          const zIndex = cards.length - i

          const scale = isCurrent ? 1 : isNext ? 0.95 + dragProgress * 0.05 : 0.9

          return (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center px-8"
              style={{
                zIndex,
                transform: isCurrent
                  ? `translateX(${currentTranslateX}px) rotate(${rotation}deg)`
                  : `scale(${scale})`,
                opacity: isCurrent ? (animatingOut ? 0 : opacity) : 1,
                transition: (isDragging && isCurrent && !animatingOut) ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
              }}
            >
              <div className="relative">
                <FlippableCard
                  card={card}
                  size="lg"
                  forceFlip={(i === 0 && firstFlipped) || (i > 0 && i <= currentIndex) || flipAll}
                />
                {card.is_new && ((i === 0 && firstFlipped) || (i > 0 && i <= currentIndex) || flipAll) && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white shadow-lg animate-bounce">
                    NEW!
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Desktop: Next button — hidden on mobile */}
        {!isLast && (
          <div className="absolute inset-y-0 right-4 hidden sm:flex items-center" style={{ zIndex: cards.length + 10 }}>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={goNext}
              className="rounded-full bg-zinc-800/80 p-3 text-white backdrop-blur-sm transition-colors hover:bg-zinc-700 cursor-pointer"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex justify-center gap-3 px-4 pb-6 pt-3">
        {isLast ? (
          <button
            onClick={handleFlipAll}
            className="btn-arcade rounded-lg px-6 py-2.5 text-sm"
          >
            View All
          </button>
        ) : (
          <>
            <button
              onClick={handleFlipAll}
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Skip &amp; View All
            </button>
            <button
              onClick={() => setAutoMode(!autoMode)}
              className={`rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
                autoMode
                  ? 'bg-amber-600 text-white hover:bg-amber-500'
                  : 'border border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {autoMode ? 'Stop' : 'Auto'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
