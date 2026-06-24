'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import TradingCard from '@/components/trading-card'
import CompactCard from '@/components/compact-card'
import CardSelector from '@/components/card-selector'
import { rarestEdition, ownedEditionsRarestFirst, EDITION_DOT, EDITION_LABEL, type EditionCounts } from '@/lib/editions'

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

type Deck = {
  slot: number
  name: string
  cardIds: string[]
  cardEditions: string[]
}

export default function DeckManager({ decks, ownedCards }: { decks: Deck[]; ownedCards: Card[] }) {
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editCardIds, setEditCardIds] = useState<string[]>([])
  // Chosen finish per lineup slot, aligned by index with editCardIds.
  const [editCardEditions, setEditCardEditions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const startEdit = (deck: Deck) => {
    setEditingSlot(deck.slot)
    setEditName(deck.name)
    setEditCardIds([...deck.cardIds])
    setEditCardEditions(deck.cardIds.map((_, i) => deck.cardEditions[i] ?? 'regular'))
    setError(null)
  }

  const cancelEdit = () => {
    setEditingSlot(null)
    setError(null)
  }

  const secretRareCount = (ids: string[]) =>
    ids.filter((id) => ownedCards.find((c) => c.id === id)?.rarity === 'secret_rare').length

  const toggleCard = (cardId: string) => {
    const idx = editCardIds.indexOf(cardId)
    if (idx !== -1) {
      setEditCardIds(editCardIds.filter((_, i) => i !== idx))
      setEditCardEditions(editCardEditions.filter((_, i) => i !== idx))
    } else if (editCardIds.length < 5) {
      const card = ownedCards.find((c) => c.id === cardId)
      if (card?.rarity === 'secret_rare' && secretRareCount(editCardIds) >= 1) return
      setEditCardIds([...editCardIds, cardId])
      setEditCardEditions([...editCardEditions, card ? (rarestEdition(card.editions) ?? 'regular') : 'regular'])
    }
  }

  const setSlotEdition = (slotIdx: number, edition: string) => {
    setEditCardEditions((prev) => prev.map((e, i) => (i === slotIdx ? edition : e)))
  }

  const handleSave = async () => {
    if (!editingSlot) return
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: rpcError } = await supabase.rpc('save_deck', {
      p_slot: editingSlot,
      p_name: editName.trim() || `Deck ${editingSlot}`,
      p_card_ids: editCardIds,
      p_card_editions: editCardEditions,
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setEditingSlot(null)
      router.refresh()
    }
    setSaving(false)
  }

  // Aligned by index with editCardIds/editCardEditions.
  const selectedSlots = editCardIds.map((id, i) => ({
    card: ownedCards.find((c) => c.id === id),
    edition: editCardEditions[i] ?? 'regular',
  }))

  // Total power for a deck
  const starCount: Record<string, number> = {
    common: 1, uncommon: 2, rare: 3, ultra_rare: 4, legendary: 5, secret_rare: 6,
  }
  const getDeckPower = (cardIds: string[]) =>
    cardIds.reduce((sum, id) => {
      const card = ownedCards.find((c) => c.id === id)
      return sum + (card ? starCount[card.rarity] || 0 : 0)
    }, 0)

  return (
    <div>
      {/* Edit modal */}
      {editingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="surface max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Edit Deck</h3>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400">{editCardIds.length}/5 cards</span>
                {editCardIds.length > 0 && <span className="font-medium text-amber-400">⚡ {getDeckPower(editCardIds)}</span>}
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{error}</div>
            )}

            {/* Deck name */}
            <div className="mb-4">
              <label className="mb-1 block text-sm text-zinc-400">Deck Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={`Deck ${editingSlot}`}
                className="input-arcade w-full px-3 py-2 text-sm"
              />
            </div>

            {/* Selected cards */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm text-zinc-400">Your Lineup</label>
                {secretRareCount(editCardIds) >= 1 && <span className="text-[10px] text-pink-400">1/1 Secret Rare</span>}
              </div>
              <div className="grid grid-cols-5 gap-2 rounded-xl border border-white/5 bg-black/20 p-2">
                {[0, 1, 2, 3, 4].map((i) => {
                  const slot = selectedSlots[i]
                  const card = slot?.card
                  const ownedFinishes = card ? ownedEditionsRarestFirst(card.editions) : []
                  return card ? (
                    <div key={card.id} className="relative">
                      <CompactCard card={{ ...card, edition: slot.edition }} />
                      <button
                        onClick={() => toggleCard(card.id)}
                        className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
                      >
                        ×
                      </button>
                      {ownedFinishes.length > 1 && (
                        <div className="mt-1 flex flex-wrap justify-center gap-0.5" data-testid="deck-finish-picker">
                          {ownedFinishes.map((e) => (
                            <button
                              key={e}
                              type="button"
                              title={EDITION_LABEL[e]}
                              aria-pressed={e === slot.edition}
                              onClick={() => setSlotEdition(i, e)}
                              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                e === slot.edition ? 'border-white' : 'border-transparent hover:border-white/40'
                              }`}
                            >
                              <span className={`h-2 w-2 rounded-full ${EDITION_DOT[e]}`} aria-hidden />
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mt-0.5 text-center text-[9px] text-zinc-500">#{i + 1}</div>
                    </div>
                  ) : (
                    <div
                      key={i}
                      className="flex items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-800/50"
                      style={{ aspectRatio: '3/4' }}
                    >
                      <span className="text-xs text-zinc-600">#{i + 1}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Card picker */}
            <div className="mb-4">
              <label className="mb-2 block text-sm text-zinc-400">Add Cards</label>
              <CardSelector
                cards={ownedCards}
                selectedIds={editCardIds}
                onToggle={toggleCard}
                max={5}
                disabledFor={(card) =>
                  card.rarity === 'secret_rare' && secretRareCount(editCardIds) >= 1 ? 'Max 1 secret rare' : null
                }
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || editCardIds.length !== 5}
                title={editCardIds.length !== 5 ? 'Decks must have exactly 5 cards' : undefined}
                className="btn-arcade rounded-lg px-6 py-2 text-sm disabled:opacity-40"
              >
                {saving ? 'Saving...' : 'Save Deck'}
              </button>
              {editCardIds.length !== 5 && (
                <span className="text-xs text-amber-400">Pick exactly 5 cards ({editCardIds.length}/5)</span>
              )}
              <button
                onClick={cancelEdit}
                className="rounded-lg border border-white/10 px-6 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deck list */}
      <div className="space-y-6">
        {decks.map((deck) => {
          const cardSlots = deck.cardIds
            .map((id, i) => ({ card: ownedCards.find((c) => c.id === id), edition: deck.cardEditions[i] ?? 'regular' }))
            .filter((s) => s.card) as { card: Card; edition: string }[]
          const cards = cardSlots
          const power = getDeckPower(deck.cardIds)

          return (
            <div key={deck.slot} className="surface rounded-2xl p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold">{deck.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
                    <span>{cards.length}/5 cards</span>
                    {cards.length > 0 && <span className="text-amber-400">⚡ {power} power</span>}
                  </div>
                </div>
                <button
                  onClick={() => startEdit(deck)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Edit
                </button>
              </div>

              {cards.length > 0 ? (
                <div className="grid grid-cols-5 gap-1.5 sm:gap-3">
                  {cards.map((slot, i) => (
                    <div key={slot.card.id}>
                      <div className="sm:hidden" data-testid="deck-card-mobile">
                        <CompactCard card={{ ...slot.card, edition: slot.edition }} />
                      </div>
                      <div className="hidden sm:block" data-testid="deck-card-desktop">
                        <TradingCard card={{ ...slot.card, edition: slot.edition }} size="sm" className="!w-full" />
                      </div>
                      <div className="mt-1 text-center text-[9px] text-zinc-500">#{i + 1}</div>
                    </div>
                  ))}
                  {Array.from({ length: 5 - cards.length }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center justify-center rounded-2xl border border-dashed border-zinc-700"
                      style={{ aspectRatio: '5/8' }}
                    >
                      <span className="text-xs text-zinc-600">—</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
                  <span className="text-2xl opacity-60">🃏</span>
                  <p className="text-sm text-zinc-400">This deck is empty</p>
                  <p className="text-xs text-zinc-600">Tap Edit to add 5 cards</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
