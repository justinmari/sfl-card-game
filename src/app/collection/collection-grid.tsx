'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import TradingCard, { rarityStarCount, rarityStarColor } from '@/components/trading-card'
import { rarityLabel } from '@/lib/rarities'

type Card = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  creature_name?: string | null
}

type PackFilter = {
  id: string
  name: string
  cardIds: string[]
}

type Creature = {
  id: string
  name: string
}

type SortOption = 'rarity' | 'name' | 'count'

const rarityOrder: Record<string, number> = {
  secret_rare: 0,
  legendary: 1,
  ultra_rare: 2,
  rare: 3,
  uncommon: 4,
  common: 5,
}

export default function CollectionGrid({
  cardCounts,
  packFilters,
  creatures,
}: {
  cardCounts: { card: Card; count: number }[]
  packFilters: PackFilter[]
  creatures: Creature[]
}) {
  const [selected, setSelected] = useState<{ card: Card; count: number } | null>(null)
  const [activePack, setActivePack] = useState<string | null>(null)
  const [activeCreature, setActiveCreature] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('rarity')
  const [packSearch, setPackSearch] = useState('')
  const [packDropdownOpen, setPackDropdownOpen] = useState(false)
  const packRef = useRef<HTMLDivElement>(null)
  const [creatureSearch, setCreatureSearch] = useState('')
  const [creatureDropdownOpen, setCreatureDropdownOpen] = useState(false)
  const creatureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (packRef.current && !packRef.current.contains(e.target as Node)) {
        setPackDropdownOpen(false)
      }
      if (creatureRef.current && !creatureRef.current.contains(e.target as Node)) {
        setCreatureDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = useMemo(() => {
    let result = cardCounts

    if (activePack) {
      const pack = packFilters.find((p) => p.id === activePack)
      if (pack) {
        const cardIdSet = new Set(pack.cardIds)
        result = result.filter(({ card }) => cardIdSet.has(card.id))
      }
    }

    if (activeCreature) {
      if (activeCreature === '__unknown__') {
        result = result.filter(({ card }) => !card.creature_name)
      } else {
        result = result.filter(({ card }) => card.creature_name === activeCreature)
      }
    }

    return result
  }, [cardCounts, activePack, activeCreature, packFilters])

  const sorted = useMemo(() => {
    const items = [...filtered]
    switch (sort) {
      case 'rarity':
        items.sort((a, b) => (rarityOrder[a.card.rarity] ?? 99) - (rarityOrder[b.card.rarity] ?? 99))
        break
      case 'name':
        items.sort((a, b) => a.card.name.localeCompare(b.card.name))
        break
      case 'count':
        items.sort((a, b) => b.count - a.count)
        break
    }
    return items
  }, [filtered, sort])

  const totalCards = sorted.reduce((sum, { count }) => sum + count, 0)

  // Get creatures that appear in the user's collection
  const collectionCreatures = useMemo(() => {
    const names = new Set<string>()
    let hasUnknown = false
    for (const { card } of cardCounts) {
      if (card.creature_name) names.add(card.creature_name)
      else hasUnknown = true
    }
    return { names: [...names].sort(), hasUnknown }
  }, [cardCounts])

  return (
    <>
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Sidebar — horizontal on mobile, vertical on desktop */}
      <div className="w-full flex-shrink-0 lg:w-56">
        <div className="space-y-5 lg:sticky lg:top-6">

      {/* Pack filter typeahead */}
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Pack</div>
        <div ref={packRef} className="relative">
          <input
            type="text"
            value={activePack ? packFilters.find((p) => p.id === activePack)?.name || '' : packSearch}
            onChange={(e) => {
              setPackSearch(e.target.value)
              setActivePack(null)
              setPackDropdownOpen(true)
            }}
            onFocus={() => setPackDropdownOpen(true)}
            placeholder="All packs"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          />
          {activePack && (
            <button
              onClick={() => { setActivePack(null); setPackSearch('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              ×
            </button>
          )}
          {packDropdownOpen && (
            <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
              <button
                onClick={() => { setActivePack(null); setPackSearch(''); setPackDropdownOpen(false) }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${!activePack ? 'text-white font-medium' : 'text-zinc-300'}`}
              >
                All packs
              </button>
              {packFilters
                .filter((p) => !packSearch || p.name.toLowerCase().includes(packSearch.toLowerCase()))
                .map((pack) => {
                  const ownedFromPack = cardCounts.filter(({ card }) =>
                    pack.cardIds.includes(card.id)
                  ).length
                  return (
                    <button
                      key={pack.id}
                      onClick={() => { setActivePack(pack.id); setPackSearch(''); setPackDropdownOpen(false) }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${activePack === pack.id ? 'text-white font-medium' : 'text-zinc-300'}`}
                    >
                      {pack.name} <span className="text-zinc-500">({ownedFromPack}/{pack.cardIds.length})</span>
                    </button>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* Creature filter */}
      {(collectionCreatures.names.length > 0 || collectionCreatures.hasUnknown) && (
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Creature</div>
          <div ref={creatureRef} className="relative">
            <input
              type="text"
              value={activeCreature ? (activeCreature === '__unknown__' ? 'Unknown' : activeCreature) : creatureSearch}
              onChange={(e) => {
                setCreatureSearch(e.target.value)
                setActiveCreature(null)
                setCreatureDropdownOpen(true)
              }}
              onFocus={() => setCreatureDropdownOpen(true)}
              placeholder="All creatures"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
            {activeCreature && (
              <button
                onClick={() => { setActiveCreature(null); setCreatureSearch('') }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                ×
              </button>
            )}
            {creatureDropdownOpen && (
              <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
                <button
                  onClick={() => { setActiveCreature(null); setCreatureSearch(''); setCreatureDropdownOpen(false) }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${!activeCreature ? 'text-white font-medium' : 'text-zinc-300'}`}
                >
                  All creatures
                </button>
                {collectionCreatures.names
                  .filter((n) => !creatureSearch || n.toLowerCase().includes(creatureSearch.toLowerCase()))
                  .map((name) => (
                    <button
                      key={name}
                      onClick={() => { setActiveCreature(name); setCreatureSearch(''); setCreatureDropdownOpen(false) }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${activeCreature === name ? 'text-white font-medium' : 'text-zinc-300'}`}
                    >
                      {name}
                    </button>
                  ))}
                {collectionCreatures.hasUnknown && (!creatureSearch || 'unknown'.includes(creatureSearch.toLowerCase())) && (
                  <button
                    onClick={() => { setActiveCreature('__unknown__'); setCreatureSearch(''); setCreatureDropdownOpen(false) }}
                    className={`w-full px-3 py-2 text-left text-sm italic hover:bg-zinc-800 ${activeCreature === '__unknown__' ? 'text-white font-medium' : 'text-zinc-400'}`}
                  >
                    Unknown
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sort */}
      <div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Sort</div>
        <div className="flex flex-col gap-1">
          {(['rarity', 'name', 'count'] as SortOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setSort(opt)}
              className={`rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                sort === opt
                  ? 'bg-zinc-700 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {opt === 'count' ? 'Quantity' : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-500">
        {totalCards} card{totalCards !== 1 ? 's' : ''} ({sorted.length} unique)
      </p>

        </div>
      </div>

      {/* Right: card grid */}
      <div className="flex-1 min-w-0">

      </div>
      </div>

      {/* Preview modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <TradingCard card={selected.card} size="lg" count={selected.count} animated />
            <div className="mt-4 flex items-center gap-4 text-sm text-zinc-400">
              <span>{rarityLabel[selected.card.rarity] || selected.card.rarity}</span>
              <span className={`flex gap-1 ${rarityStarColor[selected.card.rarity]}`}>
                {Array.from({ length: rarityStarCount[selected.card.rarity] || 1 }).map((_, i) => (
                  <span key={i}>★</span>
                ))}
              </span>
              <span>Owned: x{selected.count}</span>
              <span>#{selected.card.id.slice(0, 8)}</span>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="mt-4 rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Card grid */}
      {sorted.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">No cards match this filter.</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:gap-4">
          {sorted.map(({ card, count }) => (
            <div key={card.id} className="sm:contents">
              <div className="sm:hidden">
                <TradingCard
                  card={card}
                  size="sm"
                  count={count}
                  onClick={() => setSelected({ card, count })}
                  className="!w-full"
                />
              </div>
              <div className="hidden sm:block">
                <TradingCard
                  card={card}
                  size="md"
                  count={count}
                  onClick={() => setSelected({ card, count })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
