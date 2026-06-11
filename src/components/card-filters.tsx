'use client'

import { RARITIES, rarityLabel } from '@/lib/rarities'

type SortOption = 'rarity' | 'name' | 'date'

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

export type { SortOption }
