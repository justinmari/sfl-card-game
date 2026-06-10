'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { useRouter } from 'next/navigation'
import TradingCard from '@/components/trading-card'

type Card = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  creature_name: string | null
}

export default function ProfileForm({
  fullName,
  avatarUrl,
  topCardIds,
  ownedCards,
}: {
  fullName: string
  avatarUrl: string | null
  topCardIds: string[]
  ownedCards: Card[]
}) {
  const [name, setName] = useState(fullName)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedCards, setSelectedCards] = useState<string[]>(topCardIds)
  const [showCardPicker, setShowCardPicker] = useState(false)
  const [cardSearch, setCardSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const toggleCard = (cardId: string) => {
    if (selectedCards.includes(cardId)) {
      setSelectedCards(selectedCards.filter((id) => id !== cardId))
    } else if (selectedCards.length < 4) {
      setSelectedCards([...selectedCards, cardId])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let newAvatarUrl: string | null = null

      if (file) {
        const compressed = await compressImage(file, 200, 200, 0.9)
        const fileName = `avatars/${user.id}-${Date.now()}.jpg`
        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, compressed, { contentType: 'image/jpeg' })
        if (uploadError) throw uploadError
        const { data: { publicUrl } } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName)
        newAvatarUrl = publicUrl

        await supabase.auth.updateUser({
          data: { full_name: name.trim(), avatar_url: newAvatarUrl },
        })
      }

      const { error: rpcError } = await supabase.rpc('update_profile', {
        p_full_name: name.trim(),
        p_avatar_url: newAvatarUrl,
        p_top_cards: selectedCards,
      })
      if (rpcError) throw rpcError

      setSuccess(true)
      setFile(null)
      setPreview(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const filteredCards = ownedCards.filter((c) =>
    !cardSearch || c.name.toLowerCase().includes(cardSearch.toLowerCase())
  )

  const topCards = selectedCards
    .map((id) => ownedCards.find((c) => c.id === id))
    .filter(Boolean) as Card[]

  return (
    <form onSubmit={handleSubmit}>
      {success && (
        <div className="mb-6 rounded-lg bg-green-900/50 px-4 py-2 text-sm text-green-300">
          Profile updated!
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Avatar */}
      <div className="mb-8 flex items-center gap-6">
        <div className="relative">
          {preview || avatarUrl ? (
            <img
              src={preview || avatarUrl!}
              alt="Avatar"
              className="h-24 w-24 rounded-full object-cover border-2 border-zinc-700"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-800 border-2 border-zinc-700 text-3xl text-zinc-500">
              ?
            </div>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm text-zinc-400">Change Avatar</label>
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
            className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-zinc-600"
          />
        </div>
      </div>

      {/* Display Name */}
      <div className="mb-8">
        <label className="mb-2 block text-sm text-zinc-400">Display Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {/* Top 4 Cards */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm text-zinc-400">Top 4 ({selectedCards.length}/4)</label>
          <button
            type="button"
            onClick={() => setShowCardPicker(!showCardPicker)}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            {showCardPicker ? 'Done' : 'Edit'}
          </button>
        </div>

        {/* Current top cards — 2 per row */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => {
            const card = topCards[i]
            return card ? (
              <div key={card.id} className="relative flex justify-center">
                <TradingCard card={card} size="md" />
                {showCardPicker && (
                  <button
                    type="button"
                    onClick={() => toggleCard(card.id)}
                    className="absolute -right-1 -top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
                  >
                    ×
                  </button>
                )}
              </div>
            ) : (
              <div
                key={i}
                className="flex items-center justify-center rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 py-16"
              >
                <span className="text-sm text-zinc-600">{showCardPicker ? 'Select a card' : 'Empty'}</span>
              </div>
            )
          })}
        </div>

        {/* Card picker */}
        {showCardPicker && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <input
              type="text"
              value={cardSearch}
              onChange={(e) => setCardSearch(e.target.value)}
              placeholder="Search cards..."
              className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            />
            <div className="max-h-64 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {filteredCards.map((card) => {
                  const isSelected = selectedCards.includes(card.id)
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => toggleCard(card.id)}
                      disabled={!isSelected && selectedCards.length >= 4}
                      className={`relative rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'border-green-500 bg-green-950/30 text-white'
                          : selectedCards.length >= 4
                            ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
                            : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                      }`}
                    >
                      {card.name}
                      {isSelected && <span className="ml-2 text-green-400">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full rounded-lg bg-white px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  )
}
