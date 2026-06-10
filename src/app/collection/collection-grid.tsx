'use client'

import { useState, useMemo } from 'react'
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
      {/* Filters */}
      <div className="mb-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Pack</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActivePack(null)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              activePack === null
                ? 'bg-white text-zinc-900 font-medium'
                : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            All
          </button>
          {packFilters.map((pack) => {
            const ownedFromPack = cardCounts.filter(({ card }) =>
              pack.cardIds.includes(card.id)
            ).length
            return (
              <button
                key={pack.id}
                onClick={() => setActivePack(activePack === pack.id ? null : pack.id)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  activePack === pack.id
                    ? 'bg-white text-zinc-900 font-medium'
                    : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {pack.name} ({ownedFromPack}/{pack.cardIds.length})
              </button>
            )
          })}
        </div>
      </div>

      {/* Creature filter */}
      {(collectionCreatures.names.length > 0 || collectionCreatures.hasUnknown) && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Creature</div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCreature(null)}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                activeCreature === null
                  ? 'bg-white text-zinc-900 font-medium'
                  : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              All
            </button>
            {collectionCreatures.names.map((name) => (
              <button
                key={name}
                onClick={() => setActiveCreature(activeCreature === name ? null : name)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  activeCreature === name
                    ? 'bg-white text-zinc-900 font-medium'
                    : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                {name}
              </button>
            ))}
            {collectionCreatures.hasUnknown && (
              <button
                onClick={() => setActiveCreature(activeCreature === '__unknown__' ? null : '__unknown__')}
                className={`rounded-lg px-3 py-1.5 text-sm italic transition-colors ${
                  activeCreature === '__unknown__'
                    ? 'bg-white text-zinc-900 font-medium'
                    : 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                Unknown
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sort + count */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {totalCards} card{totalCards !== 1 ? 's' : ''} ({sorted.length} unique)
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">Sort:</span>
          {(['rarity', 'name', 'count'] as SortOption[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setSort(opt)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                sort === opt
                  ? 'bg-zinc-700 text-white font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {opt === 'count' ? 'Qty' : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
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
        <div className="flex flex-wrap gap-4">
          {sorted.map(({ card, count }) => (
            <TradingCard
              key={card.id}
              card={card}
              size="md"
              count={count}
              onClick={() => setSelected({ card, count })}
            />
          ))}
        </div>
      )}
    </>
  )
}
