'use client'

import { RARITIES, rarityLabel } from '@/lib/rarities'

type SortOption = 'rarity' | 'name' | 'date'

/**
 * Group an already-sorted list into labeled sections for the "rarity" and
 * "date" sorts (returns null for any other sort, i.e. render flat). Shared by
 * the collection and admin card grids so both section the same way.
 */
export function sectionize<T>(
  items: T[],
  sort: string,
  getRarity: (item: T) => string,
  getDate: (item: T) => string | undefined,
): { label: string; items: T[] }[] | null {
  if (sort !== 'date' && sort !== 'rarity') return null
  const groups: { label: string; items: T[] }[] = []
  let currentKey = ''
  for (const item of items) {
    let key: string
    let label: string
    if (sort === 'date') {
      const d = getDate(item)
      key = d ? d.slice(0, 10) : 'Unknown'
      label = key === 'Unknown' ? 'Unknown' : new Date(key + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    } else {
      key = getRarity(item)
      label = rarityLabel[key] || key
    }
    if (key !== currentKey) {
      currentKey = key
      groups.push({ label, items: [] })
    }
    groups[groups.length - 1].items.push(item)
  }
  return groups
}

const rarityOrder: Record<string, number> = {
  secret_rare: 0,
  legendary: 1,
  ultra_rare: 2,
  rare: 3,
  uncommon: 4,
  common: 5,
}

type Card = {
  id: string
  name: string
  rarity: string
  created_at?: string
  creature_name?: string | null
  creatures?: { name: string } | null
}

export function useCardFilters<T extends Card>(cards: T[]) {
  return {
    sortCards: (items: T[], sort: SortOption): T[] => {
      const sorted = [...items]
      switch (sort) {
        case 'rarity':
          sorted.sort((a, b) => (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99))
          break
        case 'name':
          sorted.sort((a, b) => a.name.localeCompare(b.name))
          break
        case 'date':
          sorted.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
          break
      }
      return sorted
    },
    filterCards: (items: T[], search: string, rarity: string | null): T[] => {
      let result = items
      if (search) {
        const q = search.toLowerCase()
        result = result.filter((c) => c.name.toLowerCase().includes(q))
      }
      if (rarity) {
        result = result.filter((c) => c.rarity === rarity)
      }
      return result
    },
  }
}

export function CardFilterBar({
  search,
  onSearchChange,
  rarity,
  onRarityChange,
  sort,
  onSortChange,
  count,
}: {
  search: string
  onSearchChange: (v: string) => void
  rarity: string | null
  onRarityChange: (v: string | null) => void
  sort: SortOption
  onSortChange: (v: SortOption) => void
  count: number
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search cards..."
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
      />
      <select
        value={rarity || ''}
        onChange={(e) => onRarityChange(e.target.value || null)}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
      >
        <option value="">All rarities</option>
        {RARITIES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      <div className="flex items-center gap-1">
        <span className="text-xs text-zinc-500">Sort:</span>
        {(['rarity', 'name', 'date'] as SortOption[]).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSortChange(opt)}
            className={`rounded px-2 py-1 text-xs transition-colors ${
              sort === opt
                ? 'bg-zinc-700 text-white font-medium'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {opt === 'date' ? 'Date' : opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        ))}
      </div>
      <span className="text-xs text-zinc-500">{count} cards</span>
    </div>
  )
}

export type FilterSelect = {
  ariaLabel: string
  placeholder: string
  value: string | null
  onChange: (v: string | null) => void
  options: { value: string; label: string }[]
}

export type SortChoice = { value: string; label: string }

/**
 * Compact, responsive filter + sort bar shared by the collection and admin
 * card pages. Renders a single wrapping row: search, native-select filters,
 * compact sort buttons, an optional extras slot, and a count — staying tight
 * on both desktop and mobile.
 */
export function CompactFilterBar({
  search,
  onSearchChange,
  selects = [],
  sortOptions,
  sort,
  onSortChange,
  countLabel,
  children,
}: {
  search: string
  onSearchChange: (v: string) => void
  selects?: FilterSelect[]
  sortOptions: SortChoice[]
  sort: string
  onSortChange: (v: string) => void
  countLabel: string
  children?: React.ReactNode
}) {
  const selectClass =
    'min-w-0 max-w-[8.5rem] rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-sm text-white transition-colors focus:border-violet-400/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30'

  return (
    <div className="surface mb-6 flex flex-wrap items-center gap-2 rounded-xl p-2.5">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search cards..."
        className="w-full min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white placeholder-zinc-500 transition-colors focus:border-violet-400/70 focus:outline-none focus:ring-2 focus:ring-violet-500/30 sm:w-auto sm:max-w-[12rem]"
      />

      {selects.map((sel) => (
        <select
          key={sel.ariaLabel}
          aria-label={sel.ariaLabel}
          value={sel.value || ''}
          onChange={(e) => sel.onChange(e.target.value || null)}
          className={selectClass}
        >
          <option value="">{sel.placeholder}</option>
          {sel.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}

      <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/30 p-0.5">
        {sortOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSortChange(opt.value)}
            className={`rounded-md px-2 py-1 text-xs transition-colors ${
              sort === opt.value
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 font-semibold text-white shadow-[0_0_10px_-2px_rgba(167,139,250,0.6)]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {children}

      <span className="ml-auto whitespace-nowrap text-xs text-zinc-500">{countLabel}</span>
    </div>
  )
}

export type { SortOption }
