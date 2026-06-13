'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { useRouter } from 'next/navigation'
import { rarityBadgeColors, rarityLabel } from '@/lib/rarities'
import { autoDistribute } from '@/lib/auto-distribute'
import PackWrapper from '@/components/pack-wrapper'

type Pack = {
  id: string
  name: string
  description: string | null
  cards_per_pack: number
  price: number
  image_url: string | null
  is_active: boolean
  created_at: string
  pack_cards: {
    id: string
    pull_percentage: number
    card_id: string
    cards: {
      id: string
      name: string
      rarity: string
    }
  }[]
}

type Card = {
  id: string
  name: string
  rarity: string
}

export default function PackList({ packs, allCards }: { packs: Pack[]; allCards: Card[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editCardsPerPack, setEditCardsPerPack] = useState(5)
  const [editPrice, setEditPrice] = useState(100)
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editPreview, setEditPreview] = useState<string | null>(null)
  const [editEntries, setEditEntries] = useState<{ card_id: string; pull_percentage: number }[]>([])
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const startEdit = (pack: Pack) => {
    setEditingId(pack.id)
    setEditName(pack.name)
    setEditDescription(pack.description || '')
    setEditCardsPerPack(pack.cards_per_pack)
    setEditPrice(pack.price)
    setEditFile(null)
    setEditPreview(null)
    setEditEntries(
      pack.pack_cards.map((pc) => ({
        card_id: pc.card_id,
        pull_percentage: pc.pull_percentage,
      }))
    )
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditFile(null)
    setEditPreview(null)
  }

  const totalPercentage = editEntries.reduce((sum, e) => sum + e.pull_percentage, 0)

  const addCardToEdit = (cardId: string) => {
    if (editEntries.some((e) => e.card_id === cardId)) return
    setEditEntries([...editEntries, { card_id: cardId, pull_percentage: 0 }])
  }

  const removeCardFromEdit = (cardId: string) => {
    setEditEntries(editEntries.filter((e) => e.card_id !== cardId))
  }

  const updateEditPercentage = (cardId: string, value: number) => {
    setEditEntries(editEntries.map((e) => (e.card_id === cardId ? { ...e, pull_percentage: value } : e)))
  }

  const handleSave = async (pack: Pack) => {
    if (editEntries.length === 0) return
    if (Math.abs(totalPercentage - 100) > 0.01) return

    setSaving(true)
    try {
      const supabase = createClient()

      const updates: Record<string, unknown> = {
        name: editName,
        description: editDescription || null,
        cards_per_pack: editCardsPerPack,
        price: editPrice,
      }

      if (editFile) {
        const compressed = await compressImage(editFile, 600, 800)
        const fileName = `pack-${Date.now()}-${editName.toLowerCase().replace(/\s+/g, '-')}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, compressed, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError

        if (pack.image_url) {
          const oldPath = pack.image_url.split('/card-images/')[1]
          if (oldPath) await supabase.storage.from('card-images').remove([oldPath])
        }

        const { data: { publicUrl } } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName)
        updates.image_url = publicUrl
      }

      await supabase.from('packs').update(updates).eq('id', pack.id)

      // Replace pack_cards: delete old, insert new
      await supabase.from('pack_cards').delete().eq('pack_id', pack.id)
      await supabase.from('pack_cards').insert(
        editEntries.map((e) => ({
          pack_id: pack.id,
          card_id: e.card_id,
          pull_percentage: e.pull_percentage,
        }))
      )

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
    if (!confirm('Delete this pack?')) return
    const supabase = createClient()
    if (imageUrl) {
      const path = imageUrl.split('/card-images/')[1]
      if (path) await supabase.storage.from('card-images').remove([path])
    }
    await supabase.from('packs').delete().eq('id', id)
    router.refresh()
  }

  const toggleActive = async (id: string, current: boolean) => {
    const supabase = createClient()
    await supabase.from('packs').update({ is_active: !current }).eq('id', id)
    router.refresh()
  }

  const getRarityChances = (pack: Pack) => {
    const byRarity = new Map<string, number>()
    for (const pc of pack.pack_cards) {
      const r = pc.cards.rarity
      byRarity.set(r, (byRarity.get(r) || 0) + pc.pull_percentage)
    }
    return [...byRarity.entries()]
      .map(([rarity, chance]) => ({ rarity, chance }))
      .sort((a, b) => b.chance - a.chance)
  }

  if (packs.length === 0) {
    return (
      <div className="py-10 text-center text-zinc-500">
        No packs yet. Create your first pack above!
      </div>
    )
  }

  const availableEditCards = allCards.filter((c) => !editEntries.some((e) => e.card_id === c.id))

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">All Packs ({packs.length})</h2>

      {/* Edit modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
            <h3 className="mb-4 text-lg font-semibold">Edit Pack</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Cards Per Pack</label>
                  <input
                    type="number"
                    value={editCardsPerPack}
                    onChange={(e) => setEditCardsPerPack(Number(e.target.value))}
                    min={1}
                    max={20}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Price (Gruten)</label>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    min={0}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-zinc-400">Replace Image (optional)</label>
                <div className="flex items-center gap-3">
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
                    className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-600"
                  />
                  {editPreview && (
                    <img src={editPreview} alt="New image" className="h-12 w-12 rounded-lg object-cover" />
                  )}
                </div>
              </div>

              {/* Add cards */}
              {availableEditCards.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm text-zinc-400">Add Cards</label>
                  <div className="flex flex-wrap gap-1">
                    {availableEditCards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => addCardToEdit(card.id)}
                        className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs hover:border-zinc-500"
                      >
                        <span>+</span>
                        <span>{card.name}</span>
                        <span className={`rounded px-1 py-0.5 text-[10px] ${rarityBadgeColors[card.rarity]}`}>
                          {card.rarity}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pull percentages */}
              {editEntries.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-zinc-400">Pull Percentages</label>
                      <button
                        type="button"
                        onClick={() => setEditEntries(autoDistribute(editEntries, allCards))}
                        className="rounded border border-zinc-600 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-700"
                      >
                        Auto
                      </button>
                    </div>
                    <span className={`text-sm font-medium ${Math.abs(totalPercentage - 100) < 0.01 ? 'text-green-400' : 'text-amber-400'}`}>
                      Total: {totalPercentage.toFixed(2)}%
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {editEntries.map((entry) => {
                      const card = allCards.find((c) => c.id === entry.card_id)
                      if (!card) return null
                      return (
                        <div key={entry.card_id} className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5">
                          <span className="flex-1 text-sm">{card.name}</span>
                          <span className={`rounded px-1 py-0.5 text-[10px] ${rarityBadgeColors[card.rarity]}`}>
                            {card.rarity}
                          </span>
                          <input
                            type="number"
                            value={entry.pull_percentage || ''}
                            onChange={(e) => updateEditPercentage(entry.card_id, Number(e.target.value))}
                            step="0.01"
                            min="0.01"
                            max="100"
                            className="w-20 rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-right text-xs text-white focus:border-zinc-500 focus:outline-none"
                          />
                          <span className="text-xs text-zinc-400">%</span>
                          <button onClick={() => removeCardFromEdit(entry.card_id)} className="text-red-400 hover:text-red-300">
                            &times;
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => handleSave(packs.find((p) => p.id === editingId)!)}
                disabled={saving || !editName || editEntries.length === 0 || Math.abs(totalPercentage - 100) > 0.01}
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

      <div className="space-y-6">
        {packs.map((pack) => (
          <div key={pack.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            {/* Pack visual + details */}
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <div className="flex-shrink-0 self-center scale-[0.75] origin-top -mb-20 sm:scale-[0.55] sm:origin-top-left sm:-mb-32 sm:-mr-14">
                <PackWrapper
                  name={pack.name}
                  imageUrl={pack.image_url}
                  price={pack.price}
                />
              </div>
              <div className="flex-1 min-w-0">
            {/* Header: name + buttons */}
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{pack.name}</h3>
                  <span className={`rounded px-2 py-0.5 text-xs ${pack.is_active ? 'bg-green-700' : 'bg-zinc-700'}`}>
                    {pack.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-400">
                  <span>{pack.cards_per_pack} cards/pack</span>
                  <span className="font-medium text-amber-400">{pack.price} G</span>
                </div>
                {pack.description && (
                  <p className="mt-1 text-sm text-zinc-500">{pack.description}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => startEdit(pack)}
                  className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(pack.id, pack.is_active)}
                  className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  {pack.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(pack.id, pack.image_url)}
                    className="rounded border border-red-800 px-3 py-1 text-xs text-red-400 hover:bg-red-900/30"
                  >
                    Delete
                  </button>
                </div>
              </div>

              </div>
            </div>

            {/* Rarity drop rates */}
            <div className="mb-4 space-y-1.5">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Drop Rates</p>
              {getRarityChances(pack).map(({ rarity, chance }) => (
                <div key={rarity} className="flex items-center gap-2">
                  <span className={`w-20 rounded px-1.5 py-0.5 text-[10px] text-center ${rarityBadgeColors[rarity]}`}>
                    {rarityLabel[rarity] || rarity}
                  </span>
                  <div className="h-2 flex-1 rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-zinc-500"
                      style={{ width: `${Math.max(chance, 1)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-xs text-zinc-400">
                    {chance < 0.1 ? chance.toFixed(2) : chance < 1 ? chance.toFixed(1) : Math.round(chance)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Pull rates */}
            <div className="space-y-1 overflow-x-auto">
              {pack.pack_cards
                .sort((a, b) => b.pull_percentage - a.pull_percentage)
                .map((pc) => (
                  <div key={pc.cards.id} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 flex-shrink-0 rounded-full bg-zinc-700" style={{ width: '80px' }}>
                      <div
                        className="h-full rounded-full bg-white/30"
                        style={{ width: `${Math.min(pc.pull_percentage, 100)}%` }}
                      />
                    </div>
                    <span className="w-12 flex-shrink-0 text-right text-xs text-zinc-400">
                      {pc.pull_percentage}%
                    </span>
                    <span className="truncate text-xs">{pc.cards.name}</span>
                    <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] ${rarityBadgeColors[pc.cards.rarity]}`}>
                      {pc.cards.rarity}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
