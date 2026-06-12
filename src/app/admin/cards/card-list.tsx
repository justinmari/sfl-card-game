'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { useRouter } from 'next/navigation'
import TradingCard from '@/components/trading-card'
import { RARITIES } from '@/lib/rarities'
import { CardFilterBar, useCardFilters, type SortOption } from '@/components/card-filters'

type Creature = {
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
  created_at: string
}

export default function CardList({ cards, creatures, cardsInPacks = [] }: { cards: Card[]; creatures: Creature[]; cardsInPacks?: string[] }) {
  const cardsInPacksSet = useMemo(() => new Set(cardsInPacks), [cardsInPacks])
  const [filterNotInPack, setFilterNotInPack] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editRarity, setEditRarity] = useState('')
  const [editCreatureId, setEditCreatureId] = useState('')
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editPreview, setEditPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterRarity, setFilterRarity] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('date')
  const router = useRouter()
  const { sortCards, filterCards } = useCardFilters(cards)

  const filteredCards = useMemo(() => {
    let result = filterCards(cards, search, filterRarity)
    if (filterNotInPack) result = result.filter((c) => !cardsInPacksSet.has(c.id))
    return sortCards(result, sort)
  }, [cards, search, filterRarity, sort, filterNotInPack])

  const startEdit = (card: Card) => {
    setEditingId(card.id)
    setEditName(card.name)
    setEditDescription(card.description || '')
    setEditRarity(card.rarity)
    setEditCreatureId(card.creature_id || '')
    setEditFile(null)
    setEditPreview(null)
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
        const isGif = editFile.type === 'image/gif'
        const uploadBlob = isGif ? editFile : await compressImage(editFile)
        const ext = isGif ? 'gif' : 'jpg'
        const contentType = isGif ? 'image/gif' : 'image/jpeg'
        const fileName = `${Date.now()}-${editName.toLowerCase().replace(/\s+/g, '-')}.${ext}`

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

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">All Cards ({cards.length})</h2>
      <CardFilterBar
        search={search}
        onSearchChange={setSearch}
        rarity={filterRarity}
        onRarityChange={setFilterRarity}
        sort={sort}
        onSortChange={setSort}
        count={filteredCards.length}
      />
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setFilterNotInPack(!filterNotInPack)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filterNotInPack ? 'bg-amber-600 text-white' : 'border border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}
        >
          Not in any pack {filterNotInPack ? `(${filteredCards.length})` : ''}
        </button>
      </div>

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
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

      <div className="flex flex-wrap gap-4">
        {filteredCards.map((card) => (
          <TradingCard key={card.id} card={{ ...card, creature_name: card.creatures?.name || null }} size="md" className="group">
            <div className="absolute right-1.5 top-1.5 hidden gap-1 group-hover:flex">
              <button
                onClick={() => startEdit(card)}
                className="rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(card.id, card.image_url)}
                className="rounded bg-red-600 px-2 py-1 text-xs hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </TradingCard>
        ))}
      </div>
    </div>
  )
}
