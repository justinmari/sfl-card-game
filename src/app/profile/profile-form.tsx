'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/compress-image'
import { useRouter } from 'next/navigation'
import TradingCard from '@/components/trading-card'
import CompactCard from '@/components/compact-card'
import Pagination from '@/components/pagination'
import { rarestEdition, ownedEditionsRarestFirst, EDITION_DOT, EDITION_LABEL, type EditionCounts } from '@/lib/editions'

const PAGE_SIZE = 12

type Card = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  creature_name: string | null
  typeNames?: string[]
  editions: EditionCounts
}

export default function ProfileForm({
  fullName,
  avatarUrl,
  topCardIds,
  topCardEditions,
  ownedCards,
}: {
  fullName: string
  avatarUrl: string | null
  topCardIds: string[]
  topCardEditions: string[]
  ownedCards: Card[]
}) {
  const [name, setName] = useState(fullName)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [selectedCards, setSelectedCards] = useState<string[]>(topCardIds)
  // Chosen finish per showcase slot, aligned by index with selectedCards.
  const [selectedEditions, setSelectedEditions] = useState<string[]>(
    topCardIds.map((_, i) => topCardEditions[i] ?? 'regular')
  )
  const [showCardPicker, setShowCardPicker] = useState(false)
  const [cardSearch, setCardSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingCards, setSavingCards] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const router = useRouter()

  const toggleCard = (cardId: string) => {
    const idx = selectedCards.indexOf(cardId)
    if (idx !== -1) {
      setSelectedCards(selectedCards.filter((_, i) => i !== idx))
      setSelectedEditions(selectedEditions.filter((_, i) => i !== idx))
    } else if (selectedCards.length < 4) {
      // Default a newly-added card to the rarest finish the player owns of it.
      const card = ownedCards.find((c) => c.id === cardId)
      const def = card ? (rarestEdition(card.editions) ?? 'regular') : 'regular'
      setSelectedCards([...selectedCards, cardId])
      setSelectedEditions([...selectedEditions, def])
    }
  }

  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return
    const cards = [...selectedCards]
    const eds = [...selectedEditions]
    const [mc] = cards.splice(dragIdx, 1)
    const [me] = eds.splice(dragIdx, 1)
    cards.splice(targetIdx, 0, mc)
    eds.splice(targetIdx, 0, me)
    setSelectedCards(cards)
    setSelectedEditions(eds)
    setDragIdx(null)
    setDragOverIdx(null)
  }

  const setSlotEdition = (slotIdx: number, edition: string) => {
    setSelectedEditions((prev) => prev.map((e, i) => (i === slotIdx ? edition : e)))
  }

  const saveTopCards = async () => {
    setSavingCards(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: rpcError } = await supabase.rpc('update_profile', {
        p_full_name: name.trim() || fullName,
        p_avatar_url: null,
        p_top_cards: selectedCards,
        p_top_card_editions: selectedEditions,
      })
      if (rpcError) throw rpcError
      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cards')
    } finally {
      setSavingCards(false)
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
        const fileName = `avatars/${user.id}-${Date.now()}.webp`
        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, compressed, { contentType: 'image/webp' })
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
        p_top_card_editions: selectedEditions,
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

  const [cardPage, setCardPage] = useState(1)
  useEffect(() => { setCardPage(1) }, [cardSearch, showCardPicker])
  const cardPageCount = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE))
  const currentCardPage = Math.min(cardPage, cardPageCount)
  const pagedCards = filteredCards.slice((currentCardPage - 1) * PAGE_SIZE, currentCardPage * PAGE_SIZE)

  // Aligned by index with selectedCards/selectedEditions (so drag + finish edits stay in sync).
  const topSlots = selectedCards.map((id, i) => ({
    card: ownedCards.find((c) => c.id === id),
    edition: selectedEditions[i] ?? 'regular',
  }))

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
      <div className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <div className="flex-shrink-0">
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
            className="text-sm text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600/80 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-violet-600"
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
          className="input-arcade w-full px-4 py-3"
        />
      </div>

      {/* Top 4 Cards */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <label className="text-sm text-zinc-400">Top 4 ({selectedCards.length}/4)</label>
          <button
            type="button"
            disabled={savingCards}
            onClick={async () => {
              if (showCardPicker) {
                await saveTopCards()
              }
              setShowCardPicker(!showCardPicker)
            }}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            {savingCards ? 'Saving...' : showCardPicker ? 'Done' : 'Edit'}
          </button>
        </div>

        {/* Current top cards */}
        <div className="mb-4 grid grid-cols-4 gap-2 sm:flex sm:justify-center">
          {[0, 1, 2, 3].map((i) => {
            const slot = topSlots[i]
            const card = slot?.card
            const ownedFinishes = card ? ownedEditionsRarestFirst(card.editions) : []
            return card ? (
              <div
                key={card.id}
                className={`relative ${showCardPicker ? 'cursor-grab active:cursor-grabbing' : ''} ${dragOverIdx === i && dragIdx !== i ? 'ring-2 ring-blue-500 rounded-2xl' : ''}`}
                draggable={showCardPicker}
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIdx(i) }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={(e) => { e.preventDefault(); handleDrop(i) }}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
              >
                <TradingCard card={{ ...card, edition: slot.edition }} size="sm" />
                {showCardPicker && (
                  <button
                    type="button"
                    onClick={() => toggleCard(card.id)}
                    className="absolute -right-1 -top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
                  >
                    ×
                  </button>
                )}
                {/* Finish picker — only when editing and the player owns more than one finish */}
                {showCardPicker && ownedFinishes.length > 1 && (
                  <div className="mt-1.5 flex flex-wrap justify-center gap-1" data-testid="showcase-finish-picker">
                    {ownedFinishes.map((e) => (
                      <button
                        key={e}
                        type="button"
                        title={EDITION_LABEL[e]}
                        aria-pressed={e === slot.edition}
                        onClick={() => setSlotEdition(i, e)}
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                          e === slot.edition ? 'border-white' : 'border-transparent hover:border-white/40'
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${EDITION_DOT[e]}`} aria-hidden />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                key={i}
                className="flex items-center justify-center rounded-2xl border-2 border-dashed border-zinc-700 bg-zinc-900/50 sm:w-[8.5rem]"
                style={{ minHeight: '12rem' }}
              >
                <span className="text-xs text-zinc-600">{showCardPicker ? 'Select a card' : 'Empty'}</span>
              </div>
            )
          })}
        </div>

        {/* Card picker */}
        {showCardPicker && (
          <div className="surface rounded-xl p-4">
            <input
              type="text"
              value={cardSearch}
              onChange={(e) => setCardSearch(e.target.value)}
              placeholder="Search cards..."
              className="input-arcade mb-3 w-full px-3 py-2 text-sm"
            />
            <div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {pagedCards.map((card) => {
                  const isSelected = selectedCards.includes(card.id)
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => toggleCard(card.id)}
                      disabled={!isSelected && selectedCards.length >= 4}
                      className={`relative rounded-lg transition-all ${
                        isSelected
                          ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-zinc-900'
                          : selectedCards.length >= 4
                            ? 'opacity-30 cursor-not-allowed'
                            : 'hover:opacity-80'
                      }`}
                    >
                      <CompactCard card={card} />
                      {isSelected && (
                        <div className="absolute -right-1 -top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[8px] font-bold text-white">
                          ✓
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
              <Pagination page={currentCardPage} pageCount={cardPageCount} onPage={setCardPage} />
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="btn-arcade w-full rounded-lg px-6 py-3 text-sm"
      >
        {saving ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  )
}
