'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import TradingCard from '@/components/trading-card'
import CompactCard from '@/components/compact-card'

type Card = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  creature_name: string | null
}

type Deck = {
  slot: number
  name: string
  cardIds: string[]
}

const rarityOrder: Record<string, number> = {
  secret_rare: 0, legendary: 1, ultra_rare: 2, rare: 3, uncommon: 4, common: 5,
}

export default function DeckManager({ decks, ownedCards }: { decks: Deck[]; ownedCards: Card[] }) {
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editCardIds, setEditCardIds] = useState<string[]>([])
  const [cardSearch, setCardSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const startEdit = (deck: Deck) => {
    setEditingSlot(deck.slot)
    setEditName(deck.name)
    setEditCardIds([...deck.cardIds])
    setCardSearch('')
    setError(null)
  }

  const cancelEdit = () => {
    setEditingSlot(null)
    setError(null)
  }

  const secretRareCount = (ids: string[]) =>
    ids.filter((id) => ownedCards.find((c) => c.id === id)?.rarity === 'secret_rare').length

  const toggleCard = (cardId: string) => {
    if (editCardIds.includes(cardId)) {
      setEditCardIds(editCardIds.filter((id) => id !== cardId))
    } else if (editCardIds.length < 5) {
      const card = ownedCards.find((c) => c.id === cardId)
      if (card?.rarity === 'secret_rare' && secretRareCount(editCardIds) >= 1) return
      setEditCardIds([...editCardIds, cardId])
    }
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
    })

    if (rpcError) {
      setError(rpcError.message)
    } else {
      setEditingSlot(null)
      router.refresh()
    }
    setSaving(false)
  }

  const filteredCards = ownedCards
    .filter((c) => !cardSearch || c.name.toLowerCase().includes(cardSearch.toLowerCase()))
    .sort((a, b) => (rarityOrder[a.rarity] ?? 99) - (rarityOrder[b.rarity] ?? 99))

  const selectedCards = editCardIds
    .map((id) => ownedCards.find((c) => c.id === id))
    .filter(Boolean) as Card[]

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Deck</h3>
              <span className="text-sm text-zinc-400">{editCardIds.length}/5 cards</span>
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
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </div>

            {/* Selected cards */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm text-zinc-400">Your Lineup</label>
                {secretRareCount(editCardIds) >= 1 && <span className="text-[10px] text-pink-400">1/1 Secret Rare</span>}
              </div>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4].map((i) => {
                  const card = selectedCards[i]
                  return card ? (
                    <div key={card.id} className="relative w-1/5">
                      <CompactCard card={card} />
                      <button
                        onClick={() => toggleCard(card.id)}
                        className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
                      >
                        ×
                      </button>
                      <div className="mt-1 text-center text-[9px] text-zinc-500">#{i + 1}</div>
                    </div>
                  ) : (
                    <div
                      key={i}
                      className="flex w-1/5 items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-800/50"
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
              <input
                type="text"
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
                placeholder="Search cards..."
                className="mb-3 w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
              <div className="max-h-48 overflow-y-auto">
                <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                  {filteredCards.map((card) => {
                    const isSelected = editCardIds.includes(card.id)
                    const atSecretLimit = !isSelected && card.rarity === 'secret_rare' && secretRareCount(editCardIds) >= 1
                    const isDisabled = !isSelected && (editCardIds.length >= 5 || atSecretLimit)
                    return (
                      <button
                        key={card.id}
                        onClick={() => toggleCard(card.id)}
                        disabled={isDisabled}
                        className={`relative rounded-lg transition-all ${
                          isSelected
                            ? 'ring-2 ring-green-500 ring-offset-1 ring-offset-zinc-900'
                            : isDisabled
                              ? 'opacity-30'
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
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Deck'}
              </button>
              <button
                onClick={cancelEdit}
                className="rounded-lg border border-zinc-700 px-6 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
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
          const cards = deck.cardIds
            .map((id) => ownedCards.find((c) => c.id === id))
            .filter(Boolean) as Card[]
          const power = getDeckPower(deck.cardIds)

          return (
            <div key={deck.slot} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{deck.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-zinc-400">
                    <span>{cards.length}/5 cards</span>
                    {cards.length > 0 && <span className="text-amber-400">⚡ {power} power</span>}
                  </div>
                </div>
                <button
                  onClick={() => startEdit(deck)}
                  className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
                >
                  Edit
                </button>
              </div>

              {cards.length > 0 ? (
                <div className="flex gap-3">
                  {cards.map((card, i) => (
                    <div key={card.id} className="w-1/5">
                      <TradingCard card={card} size="sm" />
                      <div className="mt-1 text-center text-[9px] text-zinc-500">#{i + 1}</div>
                    </div>
                  ))}
                  {Array.from({ length: 5 - cards.length }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex w-1/5 items-center justify-center rounded-2xl border border-dashed border-zinc-700"
                      style={{ aspectRatio: '5/8' }}
                    >
                      <span className="text-xs text-zinc-600">—</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-sm text-zinc-600">
                  No cards — tap Edit to build this deck
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
