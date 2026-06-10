'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { useRouter } from 'next/navigation'
import { rarityBadgeColors } from '@/lib/rarities'

type Card = {
  id: string
  name: string
  rarity: string
  image_url: string | null
}

type CardEntry = {
  card_id: string
  pull_percentage: number
}

export default function PackCreateForm({ cards }: { cards: Card[] }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cardsPerPack, setCardsPerPack] = useState(5)
  const [price, setPrice] = useState(100)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [entries, setEntries] = useState<CardEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const totalPercentage = entries.reduce((sum, e) => sum + e.pull_percentage, 0)

  const addCard = (cardId: string) => {
    if (entries.some((e) => e.card_id === cardId)) return
    setEntries([...entries, { card_id: cardId, pull_percentage: 0 }])
  }

  const removeCard = (cardId: string) => {
    setEntries(entries.filter((e) => e.card_id !== cardId))
  }

  const updatePercentage = (cardId: string, value: number) => {
    setEntries(entries.map((e) => (e.card_id === cardId ? { ...e, pull_percentage: value } : e)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (entries.length === 0) {
      setError('Add at least one card to the pack')
      return
    }
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
        .insert({ name, description, cards_per_pack: cardsPerPack, price, image_url: imageUrl })
        .select()
        .single()

      if (packError) throw packError

      const packCards = entries.map((entry) => ({
        pack_id: pack.id,
        card_id: entry.card_id,
        pull_percentage: entry.pull_percentage,
      }))

      const { error: cardsError } = await supabase.from('pack_cards').insert(packCards)
      if (cardsError) throw cardsError

      setName('')
      setDescription('')
      setCardsPerPack(5)
      setPrice(100)
      setFile(null)
      setPreview(null)
      setEntries([])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create pack')
    } finally {
      setSaving(false)
    }
  }

  const availableCards = cards.filter((c) => !entries.some((e) => e.card_id === c.id))

  return (
    <form onSubmit={handleSubmit} className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-6 text-lg font-semibold">Create New Pack</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Pack Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            placeholder="e.g. Starter Pack"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            placeholder="Optional description"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Cards Per Pack</label>
          <input
            type="number"
            value={cardsPerPack}
            onChange={(e) => setCardsPerPack(Number(e.target.value))}
            min={1}
            max={20}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Price (Gruten)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            min={0}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
            placeholder="100"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="mb-1 block text-sm text-zinc-400">Pack Image (optional)</label>
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const selected = e.target.files?.[0]
              if (selected) {
                setFile(selected)
                setPreview(URL.createObjectURL(selected))
              }
            }}
            className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-600"
          />
          {preview && (
            <img src={preview} alt="Pack preview" className="h-16 w-16 rounded-lg object-cover" />
          )}
        </div>
      </div>

      {/* Add cards */}
      <div className="mb-4">
        <label className="mb-2 block text-sm text-zinc-400">Add Cards to Pack</label>
        {availableCards.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availableCards.map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => addCard(card.id)}
                className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm hover:border-zinc-500"
              >
                <span>+</span>
                <span>{card.name}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs ${rarityBadgeColors[card.rarity]}`}>
                  {card.rarity}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">
            {cards.length === 0 ? 'No cards created yet. Upload cards first.' : 'All cards added.'}
          </p>
        )}
      </div>

      {/* Card entries with percentages */}
      {entries.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm text-zinc-400">Pull Percentages</label>
            <span className={`text-sm font-medium ${Math.abs(totalPercentage - 100) < 0.01 ? 'text-green-400' : 'text-amber-400'}`}>
              Total: {totalPercentage.toFixed(2)}%
            </span>
          </div>
          <div className="space-y-2">
            {entries.map((entry) => {
              const card = cards.find((c) => c.id === entry.card_id)!
              return (
                <div key={entry.card_id} className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2">
                  <span className="flex-1 text-sm">{card.name}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${rarityBadgeColors[card.rarity]}`}>
                    {card.rarity}
                  </span>
                  <input
                    type="number"
                    value={entry.pull_percentage || ''}
                    onChange={(e) => updatePercentage(entry.card_id, Number(e.target.value))}
                    step="0.01"
                    min="0.01"
                    max="100"
                    className="w-24 rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-right text-sm text-white focus:border-zinc-500 focus:outline-none"
                    placeholder="0.00"
                  />
                  <span className="text-sm text-zinc-400">%</span>
                  <button
                    type="button"
                    onClick={() => removeCard(entry.card_id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    &times;
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={saving || entries.length === 0 || !name}
        className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
      >
        {saving ? 'Creating...' : 'Create Pack'}
      </button>
    </form>
  )
}
