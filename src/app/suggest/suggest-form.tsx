'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compress-image'
import TradingCard from '@/components/trading-card'
import { RARITIES } from '@/lib/rarities'

type Creature = { id: string; name: string }

export default function SuggestForm({
  creatures,
  pendingCount,
}: {
  creatures: Creature[]
  pendingCount: number
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [rarity, setRarity] = useState('common')
  const [creatureId, setCreatureId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const atLimit = pendingCount >= 10
  const remaining = 10 - pendingCount

  const cardPreview = {
    id: 'preview',
    name: title || 'Card Title',
    description: description || null,
    image_url: preview,
    rarity,
    creature_name: creatures.find((c) => c.id === creatureId)?.name || null,
  }

  const canSubmit = title.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit || atLimit) return
    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      let imageUrl: string | null = null

      if (file) {
        const compressed = await compressImage(file, 400, 400, 0.85)
        const fileName = `suggestions/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, compressed, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName)
        imageUrl = publicUrl
      }

      const { error: rpcError } = await supabase.rpc('submit_card_suggestion', {
        p_title: title.trim(),
        p_description: description.trim() || null,
        p_image_url: imageUrl,
        p_rarity: rarity,
        p_creature_id: creatureId,
      })
      if (rpcError) throw rpcError

      setSuccess(true)
      setShowReview(false)
      setTitle('')
      setDescription('')
      setRarity('common')
      setCreatureId(null)
      setFile(null)
      setPreview(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit suggestion')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-10">
        <span className="mb-4 block text-5xl">✅</span>
        <h2 className="mb-2 text-xl font-bold">Suggestion Submitted!</h2>
        <p className="mb-6 text-sm text-zinc-400">An admin will review your card suggestion.</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => setSuccess(false)}
            className="rounded-lg border border-zinc-700 px-5 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Submit Another
          </button>
          <a
            href="/dashboard"
            className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      {atLimit && (
        <div className="mb-6 rounded-lg bg-amber-900/50 px-4 py-3 text-sm text-amber-300">
          You have reached the maximum of 10 pending suggestions. Wait for an admin to review your existing suggestions before submitting more.
        </div>
      )}

      {!atLimit && (
        <p className="mb-6 text-sm text-zinc-500">
          {remaining} suggestion{remaining !== 1 ? 's' : ''} remaining
        </p>
      )}

      {error && (
        <div className="mb-6 rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <div className="flex flex-col gap-8 sm:flex-row">
        {/* Card Preview */}
        <div className="flex flex-col items-center gap-2 sm:sticky sm:top-6 sm:self-start">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Preview</p>
          <TradingCard card={cardPreview} size="md" />
        </div>

        {/* Form */}
        <div className="flex-1 space-y-5">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={50}
              disabled={atLimit}
              placeholder="Card name"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              disabled={atLimit}
              rows={3}
              placeholder="Optional flavor text"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-50 resize-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">Image</label>
            <input
              type="file"
              accept="image/*"
              disabled={atLimit}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) {
                  setFile(f)
                  setPreview(URL.createObjectURL(f))
                }
              }}
              className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-600 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">Rarity</label>
            <select
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
              disabled={atLimit}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-zinc-500 focus:outline-none disabled:opacity-50"
            >
              {RARITIES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">Creature Type</label>
            <select
              value={creatureId || ''}
              onChange={(e) => setCreatureId(e.target.value || null)}
              disabled={atLimit}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white focus:border-zinc-500 focus:outline-none disabled:opacity-50"
            >
              <option value="">None</option>
              {creatures.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowReview(true)}
            disabled={!canSubmit || atLimit}
            className="w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            Review & Submit
          </button>
        </div>
      </div>

      {/* Review Modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-center">
            <h3 className="mb-4 text-lg font-bold">Review Your Suggestion</h3>
            <div className="mb-4 flex justify-center">
              <TradingCard card={cardPreview} size="sm" />
            </div>
            <div className="mb-4 space-y-1 text-sm text-zinc-400">
              <p><span className="text-zinc-300">Title:</span> {title}</p>
              {description && <p><span className="text-zinc-300">Description:</span> {description}</p>}
              <p><span className="text-zinc-300">Rarity:</span> {RARITIES.find((r) => r.value === rarity)?.label}</p>
              {cardPreview.creature_name && (
                <p><span className="text-zinc-300">Creature:</span> {cardPreview.creature_name}</p>
              )}
            </div>
            <p className="mb-6 text-xs text-amber-400">You will not be able to remove this submission once confirmed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReview(false)}
                className="flex-1 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
