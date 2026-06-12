'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { useRouter } from 'next/navigation'
import TradingCard from '@/components/trading-card'
import { RARITIES, rarityBadgeColors } from '@/lib/rarities'
import { autoDistribute } from '@/lib/auto-distribute'
import { CardFilterBar, useCardFilters, type SortOption } from '@/components/card-filters'

type Card = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  creature_id: string | null
  creatures: { name: string } | null
  created_at: string
}

type SelectedCard = {
  card_id: string
  pull_percentage: number
}

const rarityOrder: Record<string, number> = {
  secret_rare: 0,
  legendary: 1,
  ultra_rare: 2,
  rare: 3,
  uncommon: 4,
  common: 5,
}

export default function PackCreator({ cards, cardsInPacks = [] }: { cards: Card[]; cardsInPacks?: string[] }) {
  const cardsInPacksSet = useMemo(() => new Set(cardsInPacks), [cardsInPacks])
  const [filterNotInPack, setFilterNotInPack] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cardsPerPack, setCardsPerPack] = useState(5)
  const [price, setPrice] = useState(100)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selected, setSelected] = useState<SelectedCard[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardSearch, setCardSearch] = useState('')
  const [cardFilterRarity, setCardFilterRarity] = useState<string | null>(null)
  const [cardSort, setCardSort] = useState<SortOption>('rarity')
  const router = useRouter()
  const { sortCards, filterCards } = useCardFilters(cards)

  // Get unique dates from cards
  const dates = useMemo(() => {
    const dateSet = new Set<string>()
    for (const card of cards) {
      dateSet.add(card.created_at.split('T')[0])
    }
    return [...dateSet].sort((a, b) => b.localeCompare(a))
  }, [cards])

  const [selectedDate, setSelectedDate] = useState(dates[0] || '')

  // Cards for the selected date, with search/rarity filters and sort
  const dayCards = useMemo(() => {
    let dateFiltered = cards.filter((c) => c.created_at.split('T')[0] === selectedDate)
    if (filterNotInPack) dateFiltered = dateFiltered.filter((c) => !cardsInPacksSet.has(c.id))
    return sortCards(filterCards(dateFiltered, cardSearch, cardFilterRarity), cardSort)
  }, [cards, selectedDate, cardSearch, cardFilterRarity, cardSort, filterNotInPack])

  // Group day cards by rarity
  const groupedDayCards = useMemo(() => {
    const groups = new Map<string, Card[]>()
    for (const card of dayCards) {
      const existing = groups.get(card.rarity) || []
      existing.push(card)
      groups.set(card.rarity, existing)
    }
    return groups
  }, [dayCards])

  const selectedCardIds = new Set(selected.map((s) => s.card_id))
  const totalPercentage = selected.reduce((sum, s) => sum + s.pull_percentage, 0)

  const toggleCard = (cardId: string) => {
    if (selectedCardIds.has(cardId)) {
      setSelected(selected.filter((s) => s.card_id !== cardId))
    } else {
      setSelected([...selected, { card_id: cardId, pull_percentage: 0 }])
    }
  }

  const updatePercentage = (cardId: string, value: number) => {
    setSelected(selected.map((s) => (s.card_id === cardId ? { ...s, pull_percentage: value } : s)))
  }

  const removeFromSelected = (cardId: string) => {
    setSelected(selected.filter((s) => s.card_id !== cardId))
  }

  const handleAutoDistribute = () => {
    setSelected(autoDistribute(selected, cards))
  }

  const selectAllDay = () => {
    const newSelected = [...selected]
    for (const card of dayCards) {
      if (!selectedCardIds.has(card.id)) {
        newSelected.push({ card_id: card.id, pull_percentage: 0 })
      }
    }
    setSelected(newSelected)
  }

  const deselectAllDay = () => {
    const dayCardIds = new Set(dayCards.map((c) => c.id))
    setSelected(selected.filter((s) => !dayCardIds.has(s.card_id)))
  }

  const handleSubmit = async () => {
    if (!name || selected.length === 0) return
    if (Math.abs(totalPercentage - 100) > 0.01) {
      setError(`Pull percentages must add up to 100% (currently ${totalPercentage.toFixed(2)}%)`)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()

      let imageUrl: string | null = null
      if (file) {
        const compressed = await compressImage(file, 600, 800)
        const fileName = `pack-${Date.now()}-${name.toLowerCase().replace(/\s+/g, '-')}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, compressed, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName)
        imageUrl = publicUrl
      }

      const { data: pack, error: packError } = await supabase
        .from('packs')
        .insert({ name, description: description || null, cards_per_pack: cardsPerPack, price, image_url: imageUrl })
        .select()
        .single()

      if (packError) throw packError

      const { error: cardsError } = await supabase.from('pack_cards').insert(
        selected.map((s) => ({
          pack_id: pack.id,
          card_id: s.card_id,
          pull_percentage: s.pull_percentage,
        }))
      )
      if (cardsError) throw cardsError

      router.push('/admin/packs')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pack')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Card browser */}
      <div className="flex-1 min-w-0">
        <CardFilterBar
          search={cardSearch}
          onSearchChange={setCardSearch}
          rarity={cardFilterRarity}
          onRarityChange={setCardFilterRarity}
          sort={cardSort}
          onSortChange={setCardSort}
          count={dayCards.length}
        />
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => setFilterNotInPack(!filterNotInPack)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filterNotInPack ? 'bg-amber-600 text-white' : 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
          >
            Not in any pack
          </button>
        </div>

        {/* Date selector */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => {
              const idx = dates.indexOf(selectedDate)
              if (idx < dates.length - 1) setSelectedDate(dates[idx + 1])
            }}
            disabled={dates.indexOf(selectedDate) >= dates.length - 1}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          >
            &larr; Older
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-medium text-white">{selectedDate ? formatDate(selectedDate) : 'No cards'}</p>
            <p className="text-xs text-zinc-500">{dayCards.length} card{dayCards.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => {
              const idx = dates.indexOf(selectedDate)
              if (idx > 0) setSelectedDate(dates[idx - 1])
            }}
            disabled={dates.indexOf(selectedDate) <= 0}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
          >
            Newer &rarr;
          </button>
        </div>

        {dayCards.length > 0 && (
          <div className="mb-4 flex gap-2">
            <button
              onClick={selectAllDay}
              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Select all from this day
            </button>
            <button
              onClick={deselectAllDay}
              className="rounded-lg border border-zinc-700 px-4 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Deselect all from this day
            </button>
          </div>
        )}

        {/* Cards grouped by rarity */}
        {Array.from(groupedDayCards.entries()).map(([rarity, rarityCards]) => (
          <div key={rarity} className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <span className={`rounded px-2 py-0.5 text-xs ${rarityBadgeColors[rarity]}`}>
                {RARITIES.find((r) => r.value === rarity)?.label || rarity}
              </span>
              <span className="text-zinc-500">({rarityCards.length})</span>
            </h3>
            <div className="flex flex-wrap gap-3">
              {rarityCards.map((card) => {
                const isSelected = selectedCardIds.has(card.id)
                return (
                  <div key={card.id} className="relative">
                    <TradingCard
                      card={{ ...card, creature_name: card.creatures?.name || null }}
                      size="sm"
                      onClick={() => toggleCard(card.id)}
                      className={isSelected ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-zinc-950' : 'opacity-70 hover:opacity-100'}
                    />
                    {isSelected && (
                      <div className="absolute -right-1 -top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                        ✓
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {dayCards.length === 0 && (
          <p className="py-10 text-center text-zinc-500">No cards uploaded on this day.</p>
        )}
      </div>

      {/* Pack builder sidebar */}
      <div className="w-full lg:w-80 lg:flex-shrink-0">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 lg:sticky lg:top-6">
          <h2 className="mb-4 text-lg font-semibold">New Pack</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-900/50 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="mb-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pack name"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Cards/Pack</label>
                <input
                  type="number"
                  value={cardsPerPack}
                  onChange={(e) => setCardsPerPack(Number(e.target.value))}
                  min={1}
                  max={20}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Price (G)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  min={0}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Pack Image (optional)</label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setFile(f)
                      setPreview(URL.createObjectURL(f))
                    }
                  }}
                  className="w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-700 file:px-3 file:py-1 file:text-xs file:text-white hover:file:bg-zinc-600"
                />
                {preview && (
                  <img src={preview} alt="Pack" className="h-10 w-10 rounded object-cover" />
                )}
              </div>
            </div>
          </div>

          {/* Selected cards list */}
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">
              Selected ({selected.length})
            </h3>
            {selected.length > 0 && (
              <button
                onClick={handleAutoDistribute}
                className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700"
              >
                Auto %
              </button>
            )}
          </div>

          {selected.length > 0 && (
            <div className="mb-3 text-right">
              <span className={`text-xs font-medium ${Math.abs(totalPercentage - 100) < 0.01 ? 'text-green-400' : 'text-amber-400'}`}>
                Total: {totalPercentage.toFixed(2)}%
              </span>
            </div>
          )}

          <div className="mb-4 max-h-64 overflow-y-auto space-y-1.5">
            {selected.length === 0 ? (
              <p className="py-4 text-center text-xs text-zinc-500">Click cards on the left to add them</p>
            ) : (
              selected.map((s) => {
                const card = cards.find((c) => c.id === s.card_id)
                if (!card) return null
                return (
                  <div key={s.card_id} className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5">
                    <span className="flex-1 truncate text-xs">{card.name}</span>
                    <span className={`rounded px-1 py-0.5 text-[9px] ${rarityBadgeColors[card.rarity]}`}>
                      {card.rarity}
                    </span>
                    <input
                      type="number"
                      value={s.pull_percentage || ''}
                      onChange={(e) => updatePercentage(s.card_id, Number(e.target.value))}
                      step="0.01"
                      min="0.01"
                      max="100"
                      className="w-16 rounded border border-zinc-600 bg-zinc-700 px-1.5 py-0.5 text-right text-xs text-white focus:border-zinc-500 focus:outline-none"
                      placeholder="0"
                    />
                    <span className="text-[10px] text-zinc-400">%</span>
                    <button
                      onClick={() => removeFromSelected(s.card_id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={saving || selected.length === 0 || !name || Math.abs(totalPercentage - 100) > 0.01}
            className="w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Pack'}
          </button>
        </div>
      </div>
    </div>
  )
}
