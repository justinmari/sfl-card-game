'use client'

import { useMemo, useState, useEffect } from 'react'
import TradingCard from '@/components/trading-card'
import { RARITIES } from '@/lib/rarities'
import { CompactFilterBar, type FilterSelect } from '@/components/card-filters'
import Pagination from '@/components/pagination'
import { usePreferences } from '@/lib/preferences'

const PAGE_SIZE = 18

export type PickerCard = {
  id: string
  name: string
  rarity: string
  image_url: string | null
  description?: string | null
  creature_name?: string | null
  typeNames?: string[]
}

type SortOption = 'rarity' | 'name'

const rarityOrder: Record<string, number> = {
  secret_rare: 0, legendary: 1, ultra_rare: 2, rare: 3, uncommon: 4, common: 5,
}

// Collection-style card browser for the pack editor: same filters, styling, and
// compact-cards preference as the collection page. Clicking a card picks it.
export default function CardPicker({ cards, onPick }: { cards: PickerCard[]; onPick: (id: string) => void }) {
  const { preferences } = usePreferences()
  const compact = preferences.compactCards
  const desktopSize = compact ? 'sm' : 'md'

  const [search, setSearch] = useState('')
  const [activeRarity, setActiveRarity] = useState<string | null>(null)
  const [activeCreature, setActiveCreature] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('rarity')

  const creatures = useMemo(() => {
    const names = new Set<string>()
    let hasUnknown = false
    for (const c of cards) { if (c.creature_name) names.add(c.creature_name); else hasUnknown = true }
    return { names: [...names].sort(), hasUnknown }
  }, [cards])

  const types = useMemo(() => {
    const names = new Set<string>()
    let hasUntyped = false
    for (const c of cards) {
      if (c.typeNames && c.typeNames.length > 0) c.typeNames.forEach((n) => names.add(n))
      else hasUntyped = true
    }
    return { names: [...names].sort(), hasUntyped }
  }, [cards])

  const filtered = useMemo(() => {
    let r = cards
    if (search) { const q = search.toLowerCase(); r = r.filter((c) => c.name.toLowerCase().includes(q)) }
    if (activeRarity) r = r.filter((c) => c.rarity === activeRarity)
    if (activeCreature) r = activeCreature === '__unknown__' ? r.filter((c) => !c.creature_name) : r.filter((c) => c.creature_name === activeCreature)
    if (activeType) r = activeType === '__untyped__' ? r.filter((c) => !c.typeNames || c.typeNames.length === 0) : r.filter((c) => c.typeNames?.includes(activeType))
    return r
  }, [cards, search, activeRarity, activeCreature, activeType])

  const sorted = useMemo(() => {
    const items = [...filtered]
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name))
    else items.sort((a, b) => (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99))
    return items
  }, [filtered, sort])

  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [search, activeRarity, activeCreature, activeType, sort])
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageItems = useMemo(() => sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [sorted, currentPage])

  const selects = useMemo(() => {
    const list: FilterSelect[] = [
      { ariaLabel: 'Filter by rarity', placeholder: 'All rarities', value: activeRarity, onChange: setActiveRarity, options: RARITIES.map((r) => ({ value: r.value, label: r.label })) },
    ]
    if (creatures.names.length > 0 || creatures.hasUnknown) {
      list.push({ ariaLabel: 'Filter by creature', placeholder: 'All creatures', value: activeCreature, onChange: setActiveCreature, options: [...creatures.names.map((n) => ({ value: n, label: n })), ...(creatures.hasUnknown ? [{ value: '__unknown__', label: 'Unknown' }] : [])] })
    }
    if (types.names.length > 0 || types.hasUntyped) {
      list.push({ ariaLabel: 'Filter by type', placeholder: 'All types', value: activeType, onChange: setActiveType, options: [...types.names.map((n) => ({ value: n, label: n })), ...(types.hasUntyped ? [{ value: '__untyped__', label: 'Untyped' }] : [])] })
    }
    return list
  }, [activeRarity, activeCreature, activeType, creatures, types])

  if (cards.length === 0) return null

  return (
    <div data-testid="pack-card-picker" data-compact={compact ? 'true' : 'false'}>
      <CompactFilterBar
        search={search}
        onSearchChange={setSearch}
        selects={selects}
        sortOptions={[{ value: 'rarity', label: 'Rarity' }, { value: 'name', label: 'Name' }]}
        sort={sort}
        onSortChange={(v) => setSort(v as SortOption)}
        countLabel={`${sorted.length} card${sorted.length !== 1 ? 's' : ''}`}
      />
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">No cards match this filter.</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap sm:gap-4">
            {pageItems.map((card) => (
              <div key={card.id} className="sm:contents">
                <div className="sm:hidden">
                  <TradingCard card={card} size="sm" onClick={() => onPick(card.id)} className="!w-full" />
                </div>
                <div className="hidden sm:block">
                  <TradingCard card={card} size={desktopSize} onClick={() => onPick(card.id)} />
                </div>
              </div>
            ))}
          </div>
          <Pagination page={currentPage} pageCount={pageCount} onPage={setPage} />
        </>
      )}
    </div>
  )
}
