'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { compressAnimatedToWebp } from '@/lib/compress-animated'
import { useRouter } from 'next/navigation'
import TradingCard from '@/components/trading-card'
import { RARITIES } from '@/lib/rarities'
import { CompactFilterBar, sectionize, useCardFilters, type SortOption, type FilterSelect } from '@/components/card-filters'
import Pagination from '@/components/pagination'
import { usePreferences } from '@/lib/preferences'

const PAGE_SIZE = 24

type PackFilter = { id: string; name: string; isActive: boolean; cardIds: string[] }

type Creature = {
  id: string
  name: string
}

type CardType = {
  id: string
  name: string
}

type Card = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  creature_id: string | null
  creatures: { name: string } | null
  card_types: { type_id: string }[]
  created_at: string
}

export default function CardList({ cards, creatures, types, cardsInPacks = [], packFilters = [] }: { cards: Card[]; creatures: Creature[]; types: CardType[]; cardsInPacks?: string[]; packFilters?: PackFilter[] }) {
  const typeNameMap = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types])
  const { preferences } = usePreferences()
  const compact = preferences.compactCards
  const cardSize = compact ? 'sm' : 'md'
  const cardsInPacksSet = useMemo(() => new Set(cardsInPacks), [cardsInPacks])
  const packCardSets = useMemo(() => new Map(packFilters.map((p) => [p.id, new Set(p.cardIds)])), [packFilters])
  const [filterNotInPack, setFilterNotInPack] = useState(false)
  const [filterPack, setFilterPack] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editRarity, setEditRarity] = useState('')
  const [editCreatureId, setEditCreatureId] = useState('')
  const [editTypeIds, setEditTypeIds] = useState<Set<string>>(new Set())
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editPreview, setEditPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterRarity, setFilterRarity] = useState<string | null>(null)
  const [filterCreature, setFilterCreature] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('date')
  const router = useRouter()
  const { sortCards, filterCards } = useCardFilters(cards)

  const filteredCards = useMemo(() => {
    let result = filterCards(cards, search, filterRarity)
    if (filterCreature) result = result.filter((c) => c.creature_id === filterCreature)
    if (filterType) result = result.filter((c) => (c.card_types || []).some((ct) => ct.type_id === filterType))
    if (filterNotInPack) result = result.filter((c) => !cardsInPacksSet.has(c.id))
    if (filterPack) { const set = packCardSets.get(filterPack); result = result.filter((c) => set?.has(c.id)) }
    return sortCards(result, sort)
  }, [cards, search, filterRarity, filterCreature, filterType, sort, filterNotInPack, filterPack, packCardSets])

  // Numbered pagination over the filtered list (resets to page 1 on filter change).
  const [page, setPage] = useState(1)
  useEffect(() => { setPage(1) }, [search, filterRarity, filterCreature, filterType, filterPack, filterNotInPack, sort])
  const pageCount = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageCards = useMemo(() => filteredCards.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filteredCards, currentPage])
  const sections = useMemo(() => sectionize(pageCards, sort, (c) => c.rarity, (c) => c.created_at), [pageCards, sort])

  const filterSelects = useMemo(() => {
    const list: FilterSelect[] = []
    if (packFilters.length > 0) {
      list.push({
        ariaLabel: 'Filter by pack',
        placeholder: 'All packs',
        value: filterPack,
        onChange: setFilterPack,
        options: packFilters.map((p) => ({ value: p.id, label: p.isActive ? p.name : `${p.name} (inactive)` })),
      })
    }
    list.push(
      {
        ariaLabel: 'Filter by rarity',
        placeholder: 'All rarities',
        value: filterRarity,
        onChange: setFilterRarity,
        options: RARITIES.map((r) => ({ value: r.value, label: r.label })),
      },
    )
    if (creatures.length > 0) {
      list.push({
        ariaLabel: 'Filter by creature',
        placeholder: 'All creatures',
        value: filterCreature,
        onChange: setFilterCreature,
        options: creatures.map((c) => ({ value: c.id, label: c.name })),
      })
    }
    if (types.length > 0) {
      list.push({
        ariaLabel: 'Filter by type',
        placeholder: 'All types',
        value: filterType,
        onChange: setFilterType,
        options: types.map((t) => ({ value: t.id, label: t.name })),
      })
    }
    return list
  }, [creatures, types, packFilters, filterRarity, filterCreature, filterType, filterPack])

  const startEdit = (card: Card) => {
    setEditingId(card.id)
    setEditName(card.name)
    setEditDescription(card.description || '')
    setEditRarity(card.rarity)
    setEditCreatureId(card.creature_id || '')
    setEditTypeIds(new Set((card.card_types || []).map((ct) => ct.type_id)))
    setEditFile(null)
    setEditPreview(null)
  }

  const toggleEditType = (typeId: string) => {
    setEditTypeIds((prev) => {
      const next = new Set(prev)
      if (next.has(typeId)) next.delete(typeId)
      else next.add(typeId)
      return next
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditFile(null)
    setEditPreview(null)
  }

  const handleSave = async (card: Card) => {
    setSaving(true)
    try {
      const supabase = createClient()
      const updates: Record<string, string | null> = {
        name: editName,
        description: editDescription || null,
        rarity: editRarity,
        creature_id: editCreatureId || null,
      }

      // Upload new image if selected
      if (editFile) {
        const isAnimated = editFile.type === 'image/gif' || editFile.type === 'image/webp'
        const uploadBlob = isAnimated ? await compressAnimatedToWebp(editFile) : await compressImage(editFile)
        const contentType = 'image/webp'
        const fileName = `${Date.now()}-${editName.toLowerCase().replace(/\s+/g, '-')}.webp`

        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, uploadBlob, { contentType })

        if (uploadError) throw uploadError

        // Delete old image
        if (card.image_url) {
          const oldPath = card.image_url.split('/card-images/')[1]
          if (oldPath) await supabase.storage.from('card-images').remove([oldPath])
        }

        const { data: { publicUrl } } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName)

        updates.image_url = publicUrl
      }

      await supabase.from('cards').update(updates).eq('id', card.id)

      // Diff type assignments
      const currentTypeIds = new Set((card.card_types || []).map((ct) => ct.type_id))
      const newTypeIds = editTypeIds
      const typesToRemove = [...currentTypeIds].filter((id) => !newTypeIds.has(id))
      if (typesToRemove.length > 0) {
        await supabase.from('card_types').delete().eq('card_id', card.id).in('type_id', typesToRemove)
      }
      const typesToAdd = [...newTypeIds].filter((id) => !currentTypeIds.has(id))
      if (typesToAdd.length > 0) {
        await supabase.from('card_types').insert(typesToAdd.map((type_id) => ({ card_id: card.id, type_id })))
      }

      setEditingId(null)
      setEditFile(null)
      setEditPreview(null)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, imageUrl: string | null) => {
    if (!confirm('Delete this card?')) return

    const supabase = createClient()

    if (imageUrl) {
      const path = imageUrl.split('/card-images/')[1]
      if (path) await supabase.storage.from('card-images').remove([path])
    }

    await supabase.from('cards').delete().eq('id', id)
    router.refresh()
  }

  if (cards.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-10">
        No cards yet. Upload your first card above!
      </div>
    )
  }

  const renderCard = (card: Card) => (
    <TradingCard key={card.id} testId="admin-card" card={{ ...card, creature_name: card.creatures?.name || null, typeNames: (card.card_types || []).map((ct) => typeNameMap.get(ct.type_id) || '').filter(Boolean) }} size={cardSize} className="group">
      <div className="absolute right-1.5 top-1.5 hidden gap-1 group-hover:flex">
        <button onClick={() => startEdit(card)} className="rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600">Edit</button>
        <button onClick={() => handleDelete(card.id, card.image_url)} className="rounded bg-red-600 px-2 py-1 text-xs hover:bg-red-500">Delete</button>
      </div>
    </TradingCard>
  )

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">All Cards ({cards.length})</h2>
      <CompactFilterBar
        search={search}
        onSearchChange={setSearch}
        selects={filterSelects}
        sortOptions={[
          { value: 'rarity', label: 'Rarity' },
          { value: 'name', label: 'Name' },
          { value: 'date', label: 'Date' },
        ]}
        sort={sort}
        onSortChange={(v) => setSort(v as SortOption)}
        countLabel={`${filteredCards.length} cards`}
      >
        <button
          type="button"
          onClick={() => setFilterNotInPack(!filterNotInPack)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filterNotInPack ? 'bg-amber-600 text-white' : 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
        >
          Not in any pack {filterNotInPack ? `(${filteredCards.length})` : ''}
        </button>
      </CompactFilterBar>

      {/* Edit modal */}
      {editingId && (
        <div data-testid="edit-card-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold">Edit Card</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Rarity</label>
                <select
                  value={editRarity}
                  onChange={(e) => setEditRarity(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                >
                  {RARITIES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Creature</label>
                <select
                  value={editCreatureId}
                  onChange={(e) => setEditCreatureId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                >
                  <option value="">None (Unknown)</option>
                  {creatures.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {types.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Types</label>
                  <div className="flex flex-wrap gap-1.5">
                    {types.map((t) => {
                      const active = editTypeIds.has(t.id)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleEditType(t.id)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            active
                              ? 'border-cyan-600 bg-cyan-950/50 text-cyan-300'
                              : 'border-zinc-600 text-zinc-400 hover:bg-zinc-800'
                          }`}
                        >
                          {active ? '✓ ' : ''}{t.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Replace Image (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) {
                      setEditFile(f)
                      setEditPreview(URL.createObjectURL(f))
                    }
                  }}
                  className="w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-600"
                />
                {editPreview && (
                  <img src={editPreview} alt="New image" className="mt-2 h-32 rounded-lg object-cover" />
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => handleSave(cards.find((c) => c.id === editingId)!)}
                disabled={saving || !editName}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div data-testid="admin-cards" data-compact={compact ? 'true' : 'false'}>
        {filteredCards.length === 0 ? (
          <p className="py-10 text-center text-zinc-500">No cards match this filter.</p>
        ) : sections ? (
          <div className="space-y-8">
            {sections.map((section) => (
              <div key={section.label}>
                <h3 className="font-display mb-3 flex items-center gap-2 border-b border-white/10 pb-2 text-sm font-bold uppercase tracking-wider text-zinc-300">
                  <span className="h-3 w-1 rounded-full bg-gradient-to-b from-violet-400 to-fuchsia-500" />{section.label}
                </h3>
                <div className="flex flex-wrap gap-4">{section.items.map(renderCard)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">{pageCards.map(renderCard)}</div>
        )}
      </div>
      <Pagination page={currentPage} pageCount={pageCount} onPage={setPage} />
    </div>
  )
}
