'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import FlippableCard from '@/components/flippable-card'
import PackWrapper from '@/components/pack-wrapper'
import SwipeableReveal from '@/components/swipeable-reveal'

type Pack = {
  id: string
  name: string
  description: string | null
  cards_per_pack: number
  price: number
  image_url: string | null
  pack_cards: { card_id: string }[]
}

type PulledCard = {
  id: string
  name: string
  rarity: string
  image_url: string | null
  description: string | null
  creature_name: string | null
}

export default function PackShop({ packs, gruten, packOwnership }: { packs: Pack[]; gruten: number; packOwnership: Record<string, { owned: number; total: number }> }) {
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null)
  const [buying, setBuying] = useState(false)
  const [pulledCards, setPulledCards] = useState<PulledCard[] | null>(null)
  const [flipAll, setFlipAll] = useState(false)
  const [currentGruten, setCurrentGruten] = useState(gruten)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleBuy = async (packId: string, quantity: number) => {
    setBuying(true)
    setError(null)
    setPulledCards(null)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch('/api/packs/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ pack_id: packId, quantity }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to buy pack')
      }

      setPulledCards(data.cards)
      setCurrentGruten(data.gruten_remaining)
      setSelectedPack(null)
      setFlipAll(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBuying(false)
    }
  }

  const closeResults = () => {
    setPulledCards(null)
    router.refresh()
  }

  const canAfford = (price: number) => currentGruten === -1 || currentGruten >= price

  if (packs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <span className="mb-6 text-5xl">🏪</span>
        <h2 className="mb-2 text-xl font-bold">No packs available</h2>
        <p className="text-sm text-zinc-400">Check back later!</p>
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="mb-6 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Pull results modal */}
      {pulledCards && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          {/* Mobile: swipeable */}
          <div className="w-full sm:hidden">
            <SwipeableReveal
              cards={pulledCards}
              flipAll={flipAll}
              onFlipAll={() => setFlipAll(true)}
              onDone={closeResults}
            />
          </div>

          {/* Desktop: grid */}
          <div className="hidden sm:flex w-full max-w-3xl flex-col rounded-2xl border border-zinc-700 bg-zinc-900 p-8" style={{ maxHeight: '85vh' }}>
            <h2 className="mb-4 text-center text-2xl font-bold">Click to reveal!</h2>
            <div className="mb-6 flex-1 overflow-y-auto pr-1" style={{ maxHeight: '60vh' }}>
              <div className="flex flex-wrap justify-center gap-3">
                {pulledCards.map((card, i) => (
                  <FlippableCard key={i} card={card} size="sm" forceFlip={flipAll} />
                ))}
              </div>
            </div>
            <div className="flex justify-center gap-3">
              {!flipAll && (
                <button
                  onClick={() => setFlipAll(true)}
                  className="rounded-lg border border-zinc-600 px-6 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  Flip All
                </button>
              )}
              <button
                onClick={closeResults}
                className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buy modal */}
      {selectedPack && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => !buying && setSelectedPack(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-bold">{selectedPack.name}</h3>
            {selectedPack.description && (
              <p className="mb-4 text-sm text-zinc-400">{selectedPack.description}</p>
            )}
            <p className="mb-5 text-sm text-zinc-500">
              {selectedPack.cards_per_pack} cards per pack
            </p>

            <div className="space-y-2">
              {[1, 5, 10].map((qty) => {
                const cost = selectedPack.price * qty
                const affordable = canAfford(cost)
                return (
                  <button
                    key={qty}
                    onClick={() => handleBuy(selectedPack.id, qty)}
                    disabled={!affordable || buying}
                    className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                      affordable
                        ? 'bg-zinc-800 text-white hover:bg-zinc-700'
                        : 'cursor-not-allowed bg-zinc-800/50 text-zinc-600'
                    } disabled:opacity-50`}
                  >
                    <span>Buy {qty} pack{qty > 1 ? 's' : ''}</span>
                    <span className={affordable ? 'text-amber-400' : 'text-zinc-600'}>
                      {cost.toLocaleString()} G
                    </span>
                  </button>
                )
              })}
            </div>

            {buying && (
              <p className="mt-4 text-center text-sm text-zinc-400">Opening packs...</p>
            )}

            <button
              onClick={() => setSelectedPack(null)}
              disabled={buying}
              className="mt-4 w-full rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pack grid */}
      <div className="flex flex-wrap justify-center gap-8">
        {packs.map((pack) => (
          <div key={pack.id} className="flex flex-col items-center gap-3">
            <div onClick={() => setSelectedPack(pack)}>
              <PackWrapper
                name={pack.name}
                imageUrl={pack.image_url}
                price={pack.price}
              />
            </div>
            {(() => {
              const ownership = packOwnership[pack.id]
              if (!ownership) return null
              const complete = ownership.owned === ownership.total
              return (
                <div className="flex items-center gap-2 text-sm">
                  <span className={complete ? 'text-green-400 font-medium' : 'text-zinc-400'}>
                    {ownership.owned}/{ownership.total} collected
                  </span>
                  {complete && <span className="text-green-400">✓</span>}
                </div>
              )
            })()}
          </div>
        ))}
      </div>
    </>
  )
}
