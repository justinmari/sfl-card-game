'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { useRouter } from 'next/navigation'

export default function CardUploadForm() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rarity, setRarity] = useState('common')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name) return

    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Compress image
      const compressed = await compressImage(file)
      const fileName = `${Date.now()}-${name.toLowerCase().replace(/\s+/g, '-')}.jpg`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('card-images')
        .upload(fileName, compressed, { contentType: 'image/jpeg' })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('card-images')
        .getPublicUrl(fileName)

      // Insert card record
      const { error: insertError } = await supabase.from('cards').insert({
        name,
        description,
        rarity,
        image_url: publicUrl,
      })

      if (insertError) throw insertError

      // Reset form
      setName('')
      setDescription('')
      setRarity('common')
      setFile(null)
      setPreview(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const rarityColors: Record<string, string> = {
    common: 'border-zinc-500',
    uncommon: 'border-green-500',
    rare: 'border-blue-500',
    legendary: 'border-amber-500',
  }

  return (
    <form onSubmit={handleSubmit} className="mb-10 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="mb-6 text-lg font-semibold">Upload New Card</h2>

      {error && (
        <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">Card Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              placeholder="Enter card name"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              placeholder="Card description (optional)"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">Rarity</label>
            <select
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-zinc-500 focus:outline-none"
            >
              <option value="common">Common</option>
              <option value="uncommon">Uncommon</option>
              <option value="rare">Rare</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">Image</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              required
              className="w-full text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-600"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Will be compressed to max 800x1100px JPEG
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="flex items-center justify-center">
          {preview ? (
            <div className={`overflow-hidden rounded-xl border-2 ${rarityColors[rarity]} bg-zinc-800`}>
              <img
                src={preview}
                alt="Preview"
                className="h-64 w-44 object-cover"
              />
              <div className="p-3">
                <p className="font-semibold">{name || 'Card Name'}</p>
                <p className="text-xs capitalize text-zinc-400">{rarity}</p>
              </div>
            </div>
          ) : (
            <div className="flex h-80 w-52 items-center justify-center rounded-xl border-2 border-dashed border-zinc-700">
              <span className="text-sm text-zinc-500">Card preview</span>
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={uploading || !file || !name}
        className="mt-6 rounded-lg bg-white px-6 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
      >
        {uploading ? 'Uploading...' : 'Upload Card'}
      </button>
    </form>
  )
}
