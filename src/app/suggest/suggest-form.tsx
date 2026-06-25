'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { compressImage } from '@/lib/compress-image'
import { compressAnimatedToWebp } from '@/lib/compress-animated'
import TradingCard from '@/components/trading-card'
import { RARITIES } from '@/lib/rarities'

type Creature = { id: string; name: string }

// Upload size caps. Animated images (gif / webp) are sent raw to the
// convertToAnimatedWebp Server Action, and Vercel hard-caps a function request
// body at 4.5 MB — so the raw animation must clear that bar BEFORE it's
// compressed to <200 KB server-side. Static images are compressed in the
// browser and uploaded straight to Supabase Storage (no function involved), so
// they aren't subject to that cap and only need a sane upper bound.
const MAX_ANIMATED_MB = 4
const MAX_STATIC_MB = 25

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
  const [anonymous, setAnonymous] = useState(false)
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
        const isAnimated = file.type === 'image/gif' || file.type === 'image/webp'
        const blob = isAnimated ? await compressAnimatedToWebp(file) : await compressImage(file, 400, 400, 0.85)
        const contentType = 'image/webp'
        const fileName = `suggestions/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`
        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, blob, { contentType })
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
        p_is_anonymous: anonymous,
      })
      if (rpcError) throw rpcError

      setSuccess(true)
      setShowReview(false)
      setTitle('')
      setDescription('')
      setRarity('common')
      setCreatureId(null)
      setAnonymous(false)
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
            className="rounded-lg border border-white/10 px-5 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            Submit Another
          </button>
          <a
            href="/dashboard"
            className="btn-arcade rounded-lg px-5 py-2 text-sm"
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
              className="input-arcade w-full px-4 py-3 disabled:opacity-50"
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
              className="input-arcade w-full resize-none px-4 py-3 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">
              Image <span className="text-xs text-zinc-600">(photos up to {MAX_STATIC_MB} MB, GIFs {MAX_ANIMATED_MB} MB)</span>
            </label>
            <input
              type="file"
              accept="image/*"
              disabled={atLimit}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const isAnimated = f.type === 'image/gif' || f.type === 'image/webp'
                const limitMb = isAnimated ? MAX_ANIMATED_MB : MAX_STATIC_MB
                if (f.size > limitMb * 1024 * 1024) {
                  const mb = (f.size / 1024 / 1024).toFixed(1)
                  setError(
                    isAnimated
                      ? `That animated image is ${mb} MB. GIFs and animated WebPs must be under ${MAX_ANIMATED_MB} MB — try trimming it to a shorter loop or lowering its resolution (a tool like ezgif.com works well), then upload again.`
                      : `That image is ${mb} MB. Please keep it under ${MAX_STATIC_MB} MB.`
                  )
                  setFile(null)
                  setPreview(null)
                  e.target.value = ''
                  return
                }
                setError(null)
                setFile(f)
                setPreview(URL.createObjectURL(f))
              }}
              className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600/80 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-violet-600 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">Rarity</label>
            <select
              value={rarity}
              onChange={(e) => setRarity(e.target.value)}
              disabled={atLimit}
              className="input-arcade w-full px-4 py-3 disabled:opacity-50"
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
              className="input-arcade w-full px-4 py-3 disabled:opacity-50"
            >
              <option value="">None</option>
              {creatures.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              disabled={atLimit}
              className="h-4 w-4 accent-violet-500"
            />
            Submit anonymously
            <span className="text-xs text-zinc-600">(your name is hidden from players)</span>
          </label>

          <button
            type="button"
            onClick={() => setShowReview(true)}
            disabled={!canSubmit || atLimit}
            className="btn-arcade w-full rounded-lg px-6 py-3 text-sm"
          >
            Review & Submit
          </button>
        </div>
      </div>

      {/* Review Modal */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="surface w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl">
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
              <p><span className="text-zinc-300">Author:</span> {anonymous ? 'Anonymous' : 'Credited to you'}</p>
            </div>
            <p className="mb-6 text-xs text-amber-400">You will not be able to remove this submission once confirmed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowReview(false)}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-arcade flex-1 rounded-lg px-4 py-2 text-sm"
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
