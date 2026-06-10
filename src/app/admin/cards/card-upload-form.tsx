'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { useRouter } from 'next/navigation'
import { RARITIES, rarityBadgeColors } from '@/lib/rarities'
import { rarityColors } from '@/components/trading-card'

type Creature = {
  id: string
  name: string
}

type PendingCard = {
  id: string
  file: File
  preview: string
  name: string
  description: string
  rarity: string
  creature_id: string
}

export default function CardUploadForm({ creatures }: { creatures: Creature[] }) {
  const [pending, setPending] = useState<PendingCard[]>([])
  const [defaultRarity, setDefaultRarity] = useState('common')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newCards: PendingCard[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      name: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
      description: '',
      rarity: defaultRarity,
      creature_id: '',
    }))
    setPending((prev) => [...prev, ...newCards])
    e.target.value = ''
  }

  const updateCard = (id: string, updates: Partial<PendingCard>) => {
    setPending((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const removeCard = (id: string) => {
    setPending((prev) => prev.filter((c) => c.id !== id))
  }

  const handleUploadAll = async () => {
    if (pending.length === 0) return

    setUploading(true)
    setError(null)
    setProgress(0)

    try {
      const supabase = createClient()

      for (let i = 0; i < pending.length; i++) {
        const card = pending[i]
        setProgress(i + 1)

        const isGif = card.file.type === 'image/gif'
        const uploadBlob = isGif ? card.file : await compressImage(card.file)
        const ext = isGif ? 'gif' : 'jpg'
        const contentType = isGif ? 'image/gif' : 'image/jpeg'
        const fileName = `${Date.now()}-${card.name.toLowerCase().replace(/\s+/g, '-')}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, uploadBlob, { contentType })

        if (uploadError) throw new Error(`Failed to upload "${card.name}": ${uploadError.message}`)

        const { data: { publicUrl } } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName)

        const { error: insertError } = await supabase.from('cards').insert({
          name: card.name,
          description: card.description || null,
          rarity: card.rarity,
          image_url: publicUrl,
          creature_id: card.creature_id || null,
        })

        if (insertError) throw new Error(`Failed to save "${card.name}": ${insertError.message}`)
      }

      setPending([])
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-6 text-lg font-semibold">Upload Cards</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Select Images</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-zinc-400">Default Rarity</label>
          <select
            value={defaultRarity}
            onChange={(e) => setDefaultRarity(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-zinc-500 focus:outline-none"
          >
            {RARITIES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {pending.length > 0 && (
        <>
          <div className="mb-4 space-y-3">
            {pending.map((card) => (
              <div key={card.id} className="flex items-center gap-4 rounded-lg border border-zinc-700 bg-zinc-800 p-3">
                <img
                  src={card.preview}
                  alt={card.name}
                  className={`h-20 w-14 flex-shrink-0 rounded-lg border-2 object-cover ${rarityColors[card.rarity]}`}
                />
                <div className="flex flex-1 flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={card.name}
                    onChange={(e) => updateCard(card.id, { name: e.target.value })}
                    className="w-48 rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none"
                    placeholder="Card name"
                  />
                  <input
                    type="text"
                    value={card.description}
                    onChange={(e) => updateCard(card.id, { description: e.target.value })}
                    className="w-48 rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none"
                    placeholder="Description (optional)"
                  />
                  <select
                    value={card.rarity}
                    onChange={(e) => updateCard(card.id, { rarity: e.target.value })}
                    className="rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none"
                  >
                    {RARITIES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <select
                    value={card.creature_id}
                    onChange={(e) => updateCard(card.id, { creature_id: e.target.value })}
                    className="rounded border border-zinc-600 bg-zinc-700 px-2 py-1 text-sm text-white focus:border-zinc-500 focus:outline-none"
                  >
                    <option value="">No creature</option>
                    {creatures.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${rarityBadgeColors[card.rarity]}`}>
                    {card.rarity}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeCard(card.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleUploadAll}
              disabled={uploading || pending.some((c) => !c.name)}
              className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
            >
              {uploading
                ? `Uploading ${progress}/${pending.length}...`
                : `Upload ${pending.length} Card${pending.length !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => setPending([])}
              disabled={uploading}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              Clear All
            </button>
          </div>
        </>
      )}

      {pending.length === 0 && (
        <p className="text-sm text-zinc-500">
          Select one or more images to create cards. Names are auto-generated from filenames.
        </p>
      )}
    </div>
  )
}
