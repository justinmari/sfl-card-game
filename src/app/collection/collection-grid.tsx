'use client'

import { useState, useMemo, useEffect } from 'react'
import TradingCard, { rarityStarCount, rarityStarColor } from '@/components/trading-card'
import CompactCard from '@/components/compact-card'
import { rarityLabel, RARITIES } from '@/lib/rarities'
import { CompactFilterBar, sectionize, type FilterSelect } from '@/components/card-filters'
import Pagination from '@/components/pagination'
import { usePreferences } from '@/lib/preferences'

const PAGE_SIZE = 24

type Card = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  creature_name?: string | null
  skillNames?: string[]
  skillDescriptions?: string[]
  typeNames?: string[]
  author_name?: string | null
  author_anonymous?: boolean | null
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

type SortOption = 'rarity' | 'name' | 'count' | 'date'

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
  totalCards,
}: {
  cardCounts: { card: Card; count: number; obtainedAt?: string }[]
  packFilters: PackFilter[]
  creatures: Creature[]
  totalCards: number
}) {
  const { preferences } = usePreferences()
  const compact = preferences.compactCards
  const desktopSize = compact ? 'sm' : 'md'

  const [selected, setSelected] = useState<{ card: Card; count: number } | null>(null)
  const [search, setSearch] = useState('')
  const [activePack, setActivePack] = useState<string | null>(null)
  const [activeRarity, setActiveRarity] = useState<string | null>(null)
  const [activeCreature, setActiveCreature] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('rarity')

  const filtered = useMemo(() => {
    let result = cardCounts

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(({ card }) => card.name.toLowerCase().includes(q))
    }

    if (activePack) {
      const pack = packFilters.find((p) => p.id === activePack)
      if (pack) {
        const cardIdSet = new Set(pack.cardIds)
        result = result.filter(({ card }) => cardIdSet.has(card.id))
      }
    }

    if (activeRarity) {
      result = result.filter(({ card }) => card.rarity === activeRarity)
    }

    if (activeCreature) {
      if (activeCreature === '__unknown__') {
        result = result.filter(({ card }) => !card.creature_name)
      } else {
        result = result.filter(({ card }) => card.creature_name === activeCreature)
      }
    }

    if (activeType) {
      if (activeType === '__untyped__') {
        result = result.filter(({ card }) => !card.typeNames || card.typeNames.length === 0)
      } else {
        result = result.filter(({ card }) => card.typeNames?.includes(activeType))
      }
    }

    return result
  }, [cardCounts, search, activePack, activeRarity, activeCreature, activeType, packFilters])

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
      case 'date':
        items.sort((a, b) => {
          const da = a.obtainedAt || ''
          const db = b.obtainedAt || ''
          const dateCompare = db.localeCompare(da)
          if (dateCompare !== 0) {
            const dayA = da.slice(0, 10)
            const dayB = db.slice(0, 10)
            if (dayA !== dayB) return dayB.localeCompare(dayA)
          }
          return (rarityOrder[a.card.rarity] ?? 99) - (rarityOrder[b.card.rarity] ?? 99)
        })
        break
    }
    return items
  }, [filtered, sort])

  // Numbered pagination over the sorted list (resets to page 1 when filters change).
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [search, activePack, activeRarity, activeCreature, activeType, sort])
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageItems = useMemo(() => sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [sorted, currentPage])

  // Section headers (rarity tiers / days) drawn within the current page.
  const sections = useMemo(() => sectionize(pageItems, sort, (i) => i.card.rarity, (i) => i.obtainedAt), [pageItems, sort])

  const filteredTotal = sorted.reduce((sum, { count }) => sum + count, 0)

  // Creatures present in the user's collection
  const collectionCreatures = useMemo(() => {
    const names = new Set<string>()
    let hasUnknown = false
    for (const { card } of cardCounts) {
      if (card.creature_name) names.add(card.creature_name)
      else hasUnknown = true
    }
    return { names: [...names].sort(), hasUnknown }
  }, [cardCounts])

  // Types present in the user's collection
  const collectionTypes = useMemo(() => {
    const names = new Set<string>()
    let hasUntyped = false
    for (const { card } of cardCounts) {
      if (card.typeNames && card.typeNames.length > 0) card.typeNames.forEach((n) => names.add(n))
      else hasUntyped = true
    }
    return { names: [...names].sort(), hasUntyped }
  }, [cardCounts])

  const selects = useMemo(() => {
    const list: FilterSelect[] = [
      {
        ariaLabel: 'Filter by pack',
        placeholder: 'All packs',
        value: activePack,
        onChange: setActivePack,
        options: packFilters.map((p) => {
          const owned = cardCounts.filter(({ card }) => p.cardIds.includes(card.id)).length
          return { value: p.id, label: `${p.name} (${owned}/${p.cardIds.length})` }
        }),
      },
      {
        ariaLabel: 'Filter by rarity',
        placeholder: 'All rarities',
        value: activeRarity,
        onChange: setActiveRarity,
        options: RARITIES.map((r) => ({ value: r.value, label: r.label })),
      },
    ]

    if (collectionCreatures.names.length > 0 || collectionCreatures.hasUnknown) {
      list.push({
        ariaLabel: 'Filter by creature',
        placeholder: 'All creatures',
        value: activeCreature,
        onChange: setActiveCreature,
        options: [
          ...collectionCreatures.names.map((n) => ({ value: n, label: n })),
          ...(collectionCreatures.hasUnknown ? [{ value: '__unknown__', label: 'Unknown' }] : []),
        ],
      })
    }

    if (collectionTypes.names.length > 0 || collectionTypes.hasUntyped) {
      list.push({
        ariaLabel: 'Filter by type',
        placeholder: 'All types',
        value: activeType,
        onChange: setActiveType,
        options: [
          ...collectionTypes.names.map((n) => ({ value: n, label: n })),
          ...(collectionTypes.hasUntyped ? [{ value: '__untyped__', label: 'Untyped' }] : []),
        ],
      })
    }

    return list
  }, [packFilters, cardCounts, activePack, activeRarity, activeCreature, activeType, collectionCreatures, collectionTypes])

  return (
    <>
      <CompactFilterBar
        search={search}
        onSearchChange={setSearch}
        selects={selects}
        sortOptions={[
          { value: 'rarity', label: 'Rarity' },
          { value: 'name', label: 'Name' },
          { value: 'count', label: 'Quantity' },
          { value: 'date', label: 'Acquired' },
        ]}
        sort={sort}
        onSortChange={(v) => setSort(v as SortOption)}
        countLabel={`${filteredTotal} card${filteredTotal !== 1 ? 's' : ''} (${sorted.length} unique)`}
      />

      {/* Preview modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <TradingCard card={selected.card} size="lg" count={selected.count} />
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
            {(selected.card.author_anonymous || selected.card.author_name) && (
              <p data-testid="modal-card-author" className="mt-2 text-sm italic text-zinc-400">
                by {selected.card.author_anonymous ? 'Anonymous' : selected.card.author_name}
              </p>
            )}
            {selected.card.skillNames && selected.card.skillNames.length > 0 && (
              <div className="mt-3 w-full max-w-xs">
                {selected.card.skillNames.map((name, i) => (
                  <div key={i} className="rounded-lg border border-pink-800/50 bg-pink-950/20 px-4 py-2.5 text-center">
                    <span className="text-sm font-bold text-pink-400">✦ {name}</span>
                    {selected.card.skillDescriptions?.[i] && (
                      <p className="mt-1 text-xs text-zinc-400">{selected.card.skillDescriptions[i]}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setSelected(null)}
              className="mt-4 rounded-lg border border-white/10 px-6 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Card grid */}
      <div data-testid="collection-cards" data-compact={compact ? 'true' : 'false'}>
      {sorted.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">No cards match this filter.</p>
      ) : sections ? (
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.label}>
              <h3 className="font-display mb-3 flex items-center gap-2 border-b border-white/10 pb-2 text-sm font-bold uppercase tracking-wider text-zinc-300"><span className="h-3 w-1 rounded-full bg-gradient-to-b from-violet-400 to-fuchsia-500" />{section.label}</h3>
              <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:gap-4">
                {section.items.map(({ card, count }) => (
                  <div key={card.id} className="sm:contents">
                    <div className="sm:hidden">
                      <button
                        type="button"
                        data-testid="collection-card-mobile"
                        onClick={() => setSelected({ card, count })}
                        className="relative block w-full text-left"
                      >
                        <CompactCard card={card} />
                        {count > 1 && (
                          <span className="absolute right-1 top-1 z-10 rounded-full bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white">×{count}</span>
                        )}
                      </button>
                    </div>
                    <div className="hidden sm:block" data-testid="collection-card-desktop">
                      <TradingCard
                        card={card}
                        size={desktopSize}
                        count={count}
                        onClick={() => setSelected({ card, count })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:gap-4">
          {pageItems.map(({ card, count }) => (
            <div key={card.id} className="sm:contents">
              <div className="sm:hidden">
                <button
                  type="button"
                  data-testid="collection-card-mobile"
                  onClick={() => setSelected({ card, count })}
                  className="relative block w-full text-left"
                >
                  <CompactCard card={card} />
                  {count > 1 && (
                    <span className="absolute right-1 top-1 z-10 rounded-full bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white">×{count}</span>
                  )}
                </button>
              </div>
              <div className="hidden sm:block">
                <TradingCard
                  card={card}
                  size={desktopSize}
                  count={count}
                  onClick={() => setSelected({ card, count })}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
      <Pagination page={currentPage} pageCount={pageCount} onPage={setPage} />
    </>
  )
}
