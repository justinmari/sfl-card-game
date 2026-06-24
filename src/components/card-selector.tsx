'use client'

import { useState, useEffect, useMemo } from 'react'
import CompactCard from './compact-card'
import Pagination from './pagination'
import { CompactFilterBar, type FilterSelect } from './card-filters'
import { RARITIES } from '@/lib/rarities'
import { ownsAnyHolo, HOLO_EDITIONS, EDITION_LABEL, type Edition, type EditionCounts } from '@/lib/editions'

const rarityOrder: Record<string, number> = {
  secret_rare: 0, legendary: 1, ultra_rare: 2, rare: 3, uncommon: 4, common: 5,
}

export type SelectorCard = {
  id: string
  name: string
  description?: string | null
  image_url: string | null
  rarity: string
  creature_name?: string | null
  typeNames?: string[]
  skillNames?: string[]
  skillDescriptions?: string[]
  editions?: EditionCounts
}

/**
 * Reusable owned-card picker: search + creature/type/rarity/holo filters, a
 * rarity/name sort, and a paginated grid of selectable CompactCards. Shared by
 * the deck builder and profile top-4 editor. Selection is controlled by the
 * parent (selectedIds + onToggle); `max` caps how many can be selected and
 * `disabledFor` adds any extra per-card rule (e.g. one secret rare per deck).
 */
export default function CardSelector({
  cards,
  selectedIds,
  onToggle,
  max,
  disabledFor,
  pageSize = 12,
}: {
  cards: SelectorCard[]
  selectedIds: string[]
  onToggle: (cardId: string) => void
  max: number
  /** Returns a reason string if this (not-yet-selected) card can't be added; null if it can. */
  disabledFor?: (card: SelectorCard) => string | null
  pageSize?: number
}) {
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState<string | null>(null)
  const [creature, setCreature] = useState<string | null>(null)
  const [type, setType] = useState<string | null>(null)
  const [holo, setHolo] = useState<string | null>(null)
  const [sort, setSort] = useState('rarity')
  const [page, setPage] = useState(1)

  // Filter options scoped to what's actually in the provided cards.
  const opts = useMemo(() => {
    const creatures = new Set<string>()
    const types = new Set<string>()
    const holos = new Set<Edition>()
    let hasUnknownCreature = false
    let hasUntyped = false
    for (const c of cards) {
      if (c.creature_name) creatures.add(c.creature_name)
      else hasUnknownCreature = true
      if (c.typeNames && c.typeNames.length > 0) c.typeNames.forEach((t) => types.add(t))
      else hasUntyped = true
      for (const e of HOLO_EDITIONS) if ((c.editions?.[e] ?? 0) > 0) holos.add(e)
    }
    return {
      creatures: [...creatures].sort(),
      types: [...types].sort(),
      holos: HOLO_EDITIONS.filter((e) => holos.has(e)),
      hasUnknownCreature,
      hasUntyped,
      rarities: RARITIES.filter((r) => cards.some((c) => c.rarity === r.value)),
    }
  }, [cards])

  const filtered = useMemo(() => {
    let r = cards
    if (search) { const q = search.toLowerCase(); r = r.filter((c) => c.name.toLowerCase().includes(q)) }
    if (rarity) r = r.filter((c) => c.rarity === rarity)
    if (creature) r = creature === '__unknown__' ? r.filter((c) => !c.creature_name) : r.filter((c) => c.creature_name === creature)
    if (type) r = type === '__untyped__' ? r.filter((c) => !c.typeNames || c.typeNames.length === 0) : r.filter((c) => c.typeNames?.includes(type))
    if (holo) r = holo === '__any__' ? r.filter((c) => ownsAnyHolo(c.editions ?? {})) : r.filter((c) => (c.editions?.[holo as Edition] ?? 0) > 0)
    const sorted = [...r]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    else sorted.sort((a, b) => (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99))
    return sorted
  }, [cards, search, rarity, creature, type, holo, sort])

  useEffect(() => { setPage(1) }, [search, rarity, creature, type, holo, sort])
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageCards = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const selects: FilterSelect[] = [
    { ariaLabel: 'Filter by rarity', placeholder: 'All rarities', value: rarity, onChange: setRarity, options: opts.rarities.map((r) => ({ value: r.value, label: r.label })) },
  ]
  if (opts.creatures.length > 0 || opts.hasUnknownCreature) {
    selects.push({ ariaLabel: 'Filter by creature', placeholder: 'All creatures', value: creature, onChange: setCreature,
      options: [...opts.creatures.map((n) => ({ value: n, label: n })), ...(opts.hasUnknownCreature ? [{ value: '__unknown__', label: 'Unknown' }] : [])] })
  }
  if (opts.types.length > 0 || opts.hasUntyped) {
    selects.push({ ariaLabel: 'Filter by type', placeholder: 'All types', value: type, onChange: setType,
      options: [...opts.types.map((n) => ({ value: n, label: n })), ...(opts.hasUntyped ? [{ value: '__untyped__', label: 'Untyped' }] : [])] })
  }
  if (opts.holos.length > 0) {
    selects.push({ ariaLabel: 'Filter by holo', placeholder: 'All finishes', value: holo, onChange: setHolo,
      options: [{ value: '__any__', label: 'Any holo' }, ...opts.holos.map((e) => ({ value: e, label: EDITION_LABEL[e] }))] })
  }

  return (
    <div data-testid="card-selector">
      <CompactFilterBar
        search={search}
        onSearchChange={setSearch}
        selects={selects}
        sortOptions={[{ value: 'rarity', label: 'Rarity' }, { value: 'name', label: 'Name' }]}
        sort={sort}
        onSortChange={setSort}
        countLabel={`${filtered.length} card${filtered.length !== 1 ? 's' : ''}`}
      />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" data-testid="card-picker">
        {pageCards.map((card) => {
          const isSelected = selectedIds.includes(card.id)
          const reason = isSelected ? null : selectedIds.length >= max ? `Max ${max}` : (disabledFor?.(card) ?? null)
          const disabled = reason !== null
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onToggle(card.id)}
              disabled={disabled}
              title={reason ?? undefined}
              className={`relative rounded-lg transition-all ${
                isSelected
                  ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-zinc-900'
                  : disabled
                    ? 'opacity-30 cursor-not-allowed'
                    : 'hover:opacity-80'
              }`}
            >
              <CompactCard card={card} />
              {isSelected && (
                <div className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[8px] font-bold text-white">✓</div>
              )}
            </button>
          )
        })}
      </div>
      <Pagination page={currentPage} pageCount={pageCount} onPage={setPage} />
    </div>
  )
}
