'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import FlippableCard from './flippable-card'
import CompactCard from './compact-card'
import RarityCelebration from './rarity-celebration'
import { playSwipe, playCelebration } from '@/lib/sounds'
import { useBodyScrollLock } from '@/lib/use-body-scroll-lock'
import { usePreferences, AUTO_REVEAL_DELAY_MS } from '@/lib/preferences'
import { RARITIES } from '@/lib/rarities'
import { EDITION_RANK, type Edition } from '@/lib/editions'
import SlicePack, { SLICE_CUTY, SLICE_TOTALH, RARITY_RGB, GOLD_RGB } from './slice-pack'

const editionRank = (e?: string | null) => EDITION_RANK[(e || 'regular') as Edition] ?? 0

type CardData = {
  id: string
  name: string
  description?: string | null
  image_url: string | null
  rarity: string
  creature_name?: string | null
  typeNames?: string[]
  author_name?: string | null
  author_anonymous?: boolean | null
  is_new?: boolean
  edition?: string | null
}

const isHoloEdition = (e?: string | null): boolean =>
  e === 'golden' || e === 'diamond' || e === 'galaxy'

type DeckItem =
  | { kind: 'pack'; packNum: number }
  | { kind: 'card'; card: CardData; cardNum: number; packNum: number }

const rarityRank = (r: string) => {
  const i = RARITIES.findIndex((x) => x.value === r)
  return i === -1 ? RARITIES.length : i
}

export default function SwipeableReveal({
  cards,
  cardsPerPack,
  packName,
  packImage,
  packPrice,
  packCreatedAt,
  onDone,
  coverless = false,
  headline = 'You pulled:',
}: {
  cards: CardData[]
  cardsPerPack: number
  packName?: string
  packImage?: string | null
  packPrice?: number | null
  packCreatedAt?: string | null
  onDone: () => void
  /** Skip the pack-cover stage and start straight at the cards (used when the
   *  pack was already opened by a different animation, e.g. the slice). */
  coverless?: boolean
  /** Heading shown on the final summary grid (e.g. "You received:" for trades). */
  headline?: string
}) {
  // Build the deck: a pack cover before each pack's cards (unless coverless).
  // Cards within each pack are revealed least-rare → rarest.
  const deck = useMemo<DeckItem[]>(() => {
    const per = Math.max(1, cardsPerPack)
    const byRarity = (a: CardData, b: CardData) => rarityRank(a.rarity) - rarityRank(b.rarity) || a.name.localeCompare(b.name)
    const out: DeckItem[] = []
    if (coverless) {
      [...cards].sort(byRarity).forEach((card, idx) => out.push({ kind: 'card', card, cardNum: idx + 1, packNum: 1 }))
      return out
    }
    const packCount = Math.max(1, Math.ceil(cards.length / per))
    for (let p = 0; p < packCount; p++) {
      out.push({ kind: 'pack', packNum: p + 1 })
      cards.slice(p * per, (p + 1) * per).sort(byRarity).forEach((card, idx) =>
        out.push({ kind: 'card', card, cardNum: idx + 1, packNum: p + 1 })
      )
    }
    return out
  }, [cards, cardsPerPack, coverless])
  const packCount = deck.length ? deck[deck.length - 1].packNum : 0

  // Final summary: dedupe by (card, finish) so each holo version is its own
  // entry, count copies, NEW if any copy is new. Sorted by rarity (highest
  // first), then name, then rarest finish first (so a card's versions group
  // together: galaxy → diamond → gold → regular).
  const summary = useMemo(() => {
    const map = new Map<string, { card: CardData; count: number; isNew: boolean }>()
    for (const c of cards) {
      const key = `${c.id}:${c.edition || 'regular'}`
      const e = map.get(key)
      if (e) {
        e.count++
        e.isNew = e.isNew || !!c.is_new
      } else {
        map.set(key, { card: c, count: 1, isNew: !!c.is_new })
      }
    }
    return [...map.values()].sort(
      (a, b) =>
        rarityRank(b.card.rarity) - rarityRank(a.card.rarity)
        || a.card.name.localeCompare(b.card.name)
        || editionRank(b.card.edition) - editionRank(a.card.edition)
    )
  }, [cards])

  // Coverless mode starts the first card face-down (currentIndex -1) so it can
  // flip once the opener (e.g. the slice) clears; normal mode starts at 0.
  const [currentIndex, setCurrentIndex] = useState(coverless ? -1 : 0)
  const [showAll, setShowAll] = useState(false)
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [animatingOut, setAnimatingOut] = useState(false)
  const [autoMode, setAutoMode] = useState(false)
  // True while a pack is being sliced open (in-place, not a card slide).
  const [tearing, setTearing] = useState(false)
  // Direction the rip curls toward (captured from the swipe; +1 right, -1 left).
  const [tearDir, setTearDir] = useState(1)
  // True while a pack is rising from the bottom — hide the cards behind it until
  // it has settled at centre (otherwise they peek through during the rise).
  const [packRising, setPackRising] = useState(true)
  // Cards of a pack being skipped — fanned out briefly as the next pack rises.
  const [skipFan, setSkipFan] = useState<CardData[] | null>(null)
  const skipTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => skipTimers.current.forEach(clearTimeout), [])
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [celebrateRarity, setCelebrateRarity] = useState('')
  const [celebrateEdition, setCelebrateEdition] = useState('')
  const [celebrateTrigger, setCelebrateTrigger] = useState(0)
  const dragStartRef = useRef<number | null>(null)
  const isLast = currentIndex >= deck.length - 1
  const current = deck[currentIndex]
  const currentPackNum = current?.packNum ?? 1
  // Tint the rip effects with the rarest card in the current pack.
  const packRgb = useMemo(() => {
    let best = ''
    for (const d of deck) {
      if (d.kind === 'card' && d.packNum === currentPackNum && (best === '' || rarityRank(d.card.rarity) > rarityRank(best))) {
        best = d.card.rarity
      }
    }
    return RARITY_RGB[best] ?? GOLD_RGB
  }, [deck, currentPackNum])
  // Highest holo finish in the current pack — fires the extra ray burst on open.
  const packHolo = useMemo<'golden' | 'diamond' | 'galaxy' | null>(() => {
    let best: Edition | '' = ''
    for (const d of deck) {
      if (d.kind === 'card' && d.packNum === currentPackNum && isHoloEdition(d.card.edition)) {
        const e = (d.card.edition || 'regular') as Edition
        if (best === '' || editionRank(e) > editionRank(best)) best = e
      }
    }
    return best === 'golden' || best === 'diamond' || best === 'galaxy' ? best : null
  }, [deck, currentPackNum])
  const { preferences } = usePreferences()
  const autoDelayMs = AUTO_REVEAL_DELAY_MS[preferences.autoRevealSpeed]

  useBodyScrollLock(true)

  // Fire celebration / open effects when arriving at a new deck item.
  const arriveAt = (index: number) => {
    const item = deck[index]
    if (!item) return
    if (item.kind === 'card') {
      setCelebrateRarity(item.card.rarity)
      setCelebrateEdition(item.card.edition ?? '')
      setCelebrateTrigger((t) => t + 1)
      // A galaxy pull is the loudest moment in the game — play the top sound
      // regardless of the card's own rarity.
      playCelebration(item.card.edition === 'galaxy' ? 'secret_rare' : item.card.rarity)
    }
  }

  // While a pack rises to centre, keep the cards behind it hidden.
  useEffect(() => {
    if (deck[currentIndex]?.kind !== 'pack') {
      setPackRising(false)
      return
    }
    setPackRising(true)
    const t = setTimeout(() => setPackRising(false), 560)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  // Coverless: once the opener has cleared, flip the first card into view.
  useEffect(() => {
    if (!coverless) return
    const t = setTimeout(() => {
      setCurrentIndex(0)
      requestAnimationFrame(() => arriveAt(0))
    }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const advance = (toIndex: number, dir: number) => {
    if (animatingOut || tearing) return
    const opening = deck[currentIndex]?.kind === 'pack'
    playSwipe()
    if (opening) {
      // Slice the pack open in place: the top crimp pops off, the body drops
      // away (with the screen flash), then we cut to the first card.
      setIsDragging(false)
      setTearDir(dir)
      setTearing(true)
      setTimeout(() => {
        setCurrentIndex(toIndex)
        setTearing(false)
        setDragX(0)
        requestAnimationFrame(() => arriveAt(toIndex))
      }, 560)
      return
    }
    setAnimatingOut(true)
    setDragX(dir * 420)
    setTimeout(() => {
      setCurrentIndex(toIndex)
      setDragX(0)
      setAnimatingOut(false)
      requestAnimationFrame(() => arriveAt(toIndex))
    }, 260)
  }

  const startDrag = (x: number) => {
    if (isLast || tearing || skipFan) return
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
    // A pack rips open once the pull passes a smaller threshold; cards need a
    // firmer swipe to advance.
    const isPack = deck[currentIndex]?.kind === 'pack'
    const threshold = isPack ? 60 : 80
    if (Math.abs(dragX) > threshold && !isLast) {
      advance(currentIndex + 1, dragX < 0 ? -1 : 1)
    } else {
      setDragX(0)
    }
  }

  const goNext = () => {
    if (isLast) return
    advance(currentIndex + 1, 1)
  }

  // Skip the current pack: fan out all its cards so the player sees them, and
  // bring the next pack up (or go to the summary if this was the last pack).
  const skipPack = () => {
    if (skipFan) return
    const nextPackIdx = deck.findIndex((d, i) => i > currentIndex && d.kind === 'pack')
    const packCards = deck.flatMap((d) => (d.kind === 'card' && d.packNum === currentPackNum ? [d.card] : []))
    setSkipFan(packCards)
    setIsDragging(false)
    setDragX(0)
    setAnimatingOut(false)
    // Bring the next pack up while the cards are still showing.
    skipTimers.current.push(
      setTimeout(() => {
        if (nextPackIdx === -1) setShowAll(true)
        else setCurrentIndex(nextPackIdx)
      }, 520)
    )
    skipTimers.current.push(setTimeout(() => setSkipFan(null), 1300))
  }

  // Touch / mouse drag
  const handleTouchStart = (e: React.TouchEvent) => startDrag(e.touches[0].clientX)
  const handleTouchMove = (e: React.TouchEvent) => moveDrag(e.touches[0].clientX)
  const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); startDrag(e.clientX) }
  const handleMouseMove = (e: React.MouseEvent) => moveDrag(e.clientX)
  const handleMouseUp = () => endDrag()
  const handleMouseLeave = () => { if (isDragging) endDrag() }

  const rotation = (isDragging || animatingOut) ? dragX * 0.08 : 0
  const opacity = 1 - Math.abs(dragX) * 0.001
  const dragProgress = Math.min(Math.abs(dragX) / 200, 1)
  const nextItem = currentIndex + 1 < deck.length ? deck[currentIndex + 1] : null
  // No next-card aura while a pack is current (opening a pack shouldn't tease the
  // first card's aura) — only when swiping between revealed cards.
  const nextCardRarity = current?.kind !== 'pack' && nextItem?.kind === 'card' ? nextItem.card.rarity : undefined

  // Auto mode — advances through packs + cards; pauses after revealing a NEW card.
  useEffect(() => {
    if (!autoMode) return
    if (animatingOut || tearing || isLast) {
      if (isLast) setAutoMode(false)
      return
    }
    const upcoming = deck[currentIndex + 1]
    autoRef.current = setTimeout(() => {
      goNext()
      if (upcoming?.kind === 'card' && upcoming.card.is_new) setAutoMode(false)
    }, autoDelayMs)
    return () => { if (autoRef.current) clearTimeout(autoRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, animatingOut, tearing, currentIndex, deck.length, autoDelayMs])

  // ---- Summary (deduped, counted, sorted) ----
  if (showAll) {
    const grid = (cols: string) => (
      <div className={`grid ${cols} gap-2 pb-4`}>
        {summary.map(({ card, count, isNew }) => (
          <CompactCard key={`${card.id}:${card.edition || 'regular'}`} card={{ ...card, is_new: isNew }} count={count} showNew />
        ))}
      </div>
    )
    return (
      <>
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 sm:hidden">
          <h2 className="mb-3 text-center text-xl font-bold text-white">{headline}</h2>
          <div className="flex-1 overflow-y-auto">{grid('grid-cols-4')}</div>
          <div className="flex justify-center pt-3">
            <button onClick={onDone} className="btn-arcade rounded-lg px-6 py-2.5 text-sm">Done</button>
          </div>
        </div>
        <div data-testid="reveal-summary-desktop" className="fixed inset-0 z-50 hidden sm:flex items-center justify-center bg-black/80" onClick={onDone}>
          <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-700 bg-zinc-900 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 text-center text-xl font-bold text-white">{headline}</h2>
            <div className="max-h-[60vh] overflow-y-auto">{grid('grid-cols-6')}</div>
            <div className="flex justify-center pt-4">
              <button onClick={onDone} className="btn-arcade rounded-lg px-6 py-2.5 text-sm">Done</button>
            </div>
          </div>
        </div>
      </>
    )
  }

  const hasMorePacks = deck.some((d, i) => i > currentIndex && d.kind === 'pack')

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <RarityCelebration
        rarity={celebrateRarity}
        edition={celebrateEdition}
        trigger={celebrateTrigger}
        auraRarity={nextCardRarity}
        auraIntensity={isDragging && current?.kind !== 'pack' ? dragProgress : 0}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-sm text-zinc-400">
          {packCount > 1 ? `Pack ${current?.packNum ?? 1} / ${packCount}` : ''}
        </p>
        <p className="text-sm font-medium text-white">
          {current?.kind === 'pack'
            ? 'Swipe to open'
            : isLast
            ? 'Last card!'
            : `Card ${current?.kind === 'card' ? current.cardNum : 1} / ${cardsPerPack}`}
        </p>
        <div className="w-16" />
      </div>

      {/* Stack */}
      <div
        className="relative flex-1 touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={endDrag}
        onMouseDown={handleMouseDown}
        onMouseMove={isDragging ? handleMouseMove : undefined}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Skipped pack — fan all its cards into view while the next pack rises */}
        {skipFan && (
          <div className="skip-fan pointer-events-none absolute inset-0 z-[45] flex items-center justify-center">
            <div className="flex">
              {skipFan.map((c, i) => {
                const off = i - (skipFan.length - 1) / 2
                return (
                  <div
                    key={`${c.id}-${i}`}
                    className="w-28 sm:w-32"
                    style={{ transform: `translateX(${off * -16}px) translateY(${Math.abs(off) * 10}px) rotate(${off * 6}deg)`, zIndex: 20 - Math.abs(Math.round(off)) }}
                  >
                    <CompactCard card={c} />
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Full-width flash of light across the slice when the pack tears open */}
        {tearing && (
          <div
            className="pack-screen-flash pointer-events-none absolute inset-x-0 z-40"
            style={{
              top: `calc(50% + ${SLICE_CUTY - SLICE_TOTALH / 2}px)`,
              height: 180,
              background: `linear-gradient(to bottom, transparent 0%, rgba(${packRgb[0]},${packRgb[1]},${packRgb[2]},0.85) 34%, rgba(255,255,250,1) 50%, rgba(${packRgb[0]},${packRgb[1]},${packRgb[2]},0.85) 66%, transparent 100%)`,
              filter: 'blur(2px) brightness(1.5)',
            }}
          />
        )}

        {deck.map((item, i) => {
          if (i < currentIndex || i > currentIndex + 2) return null
          const isCurrent = i === currentIndex
          // Only the current pack shows (it rises fresh from the bottom); behind
          // the current item we only peek cards from the SAME pack — and not
          // until the pack has finished rising (else they peek through).
          if (!isCurrent && (item.kind === 'pack' || item.packNum !== currentPackNum)) return null
          if (!isCurrent && current?.kind === 'pack' && packRising) return null
          const isNext = i === currentIndex + 1
          const isPack = item.kind === 'pack'
          // Small, relative z so overlays (flash z-40, skip-fan z-45) always sit
          // on top regardless of how many packs are in the set.
          const zIndex = 30 - (i - currentIndex) * 10
          const scale = isCurrent ? 1 : isNext ? 0.95 + dragProgress * 0.05 : 0.9
          // A pack rips in place (no sideways slide); cards slide as before.
          const lift = isCurrent && isPack ? (tearing ? 1 : Math.min(Math.abs(dragX) / 130, 1)) : 0
          const curlDir = isCurrent && isPack ? (tearing ? tearDir : dragX < 0 ? -1 : 1) : 1
          return (
            <div
              key={i}
              className="absolute inset-0 flex items-center justify-center px-4 sm:px-8"
              style={{
                zIndex,
                transform: isCurrent
                  ? isPack
                    ? 'none'
                    : `translateX(${dragX}px) rotate(${rotation}deg)`
                  : `scale(${scale})`,
                opacity: isCurrent ? (isPack ? 1 : animatingOut ? 0 : opacity) : 1,
                transition: (isDragging && isCurrent && !animatingOut && !isPack) ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
              }}
            >
              {isPack ? (
                <div className="pack-rise">
                  <div className="scale-90 sm:scale-100">
                    <SlicePack
                      name={packName}
                      image={packImage}
                      price={packPrice}
                      createdAt={packCreatedAt}
                      rgb={packRgb}
                      holo={packHolo}
                      tear={lift}
                      dir={curlDir}
                      done={isCurrent && tearing}
                    />
                  </div>
                </div>
              ) : (
                <div className="relative scale-[1.12] sm:scale-100">
                  <FlippableCard
                    card={item.card}
                    size="lg"
                    forceFlip={i <= currentIndex}
                    auraActive={i <= currentIndex && isHoloEdition(item.card.edition)}
                  />
                  {item.card.is_new && i <= currentIndex && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 animate-bounce rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                      NEW!
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Desktop next arrow */}
        {!isLast && (
          <div className="absolute inset-y-0 right-4 hidden items-center sm:flex" style={{ zIndex: 36 }}>
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={goNext}
              className="cursor-pointer rounded-full bg-zinc-800/80 p-3 text-white backdrop-blur-sm transition-colors hover:bg-zinc-700"
              aria-label="Next"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex flex-wrap justify-center gap-3 px-4 pb-6 pt-3">
        {isLast ? (
          <button onClick={() => setShowAll(true)} className="btn-arcade rounded-lg px-6 py-2.5 text-sm">
            View All
          </button>
        ) : (
          <>
            {hasMorePacks && (
              <button
                onClick={skipPack}
                className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                Skip Pack
              </button>
            )}
            <button
              onClick={() => setShowAll(true)}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Skip All
            </button>
            <button
              onClick={() => setAutoMode(!autoMode)}
              className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                autoMode ? 'bg-amber-600 text-white hover:bg-amber-500' : 'border border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white'
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
