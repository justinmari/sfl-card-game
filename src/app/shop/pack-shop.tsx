'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import PackWrapper from '@/components/pack-wrapper'
import SwipeableReveal from '@/components/swipeable-reveal'
import { rarityBadgeColors, rarityLabel } from '@/lib/rarities'

type Pack = {
  id: string
  name: string
  description: string | null
  cards_per_pack: number
  price: number
  image_url: string | null
  created_at: string
  pack_cards: { card_id: string }[]
}

type PulledCard = {
  id: string
  name: string
  rarity: string
  image_url: string | null
  description: string | null
  creature_name: string | null
  is_new?: boolean
}

type RarityChance = { rarity: string; chance: number }

export default function PackShop({ packs, gruten, packOwnership, packRarityChances }: { packs: Pack[]; gruten: number; packOwnership: Record<string, { owned: number; total: number }>; packRarityChances: Record<string, RarityChance[]> }) {
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

      {/* Pull results — shared for mobile and desktop */}
      {pulledCards && (
        <SwipeableReveal
          cards={pulledCards}
          flipAll={flipAll}
          onFlipAll={() => setFlipAll(true)}
          onDone={closeResults}
        />
      )}

      {/* Buy modal */}
      {selectedPack && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => !buying && setSelectedPack(null)}
        >
          <div
            className="surface w-full max-w-sm rounded-2xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display mb-1 text-lg font-bold">{selectedPack.name}</h3>
            {selectedPack.description && (
              <p className="mb-4 text-sm text-zinc-400">{selectedPack.description}</p>
            )}
            <p className="mb-4 text-sm text-zinc-500">
              {selectedPack.cards_per_pack} cards per pack
            </p>

            {/* Rarity chances */}
            {packRarityChances[selectedPack.id] && (
              <div className="mb-5 space-y-1.5">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Drop Rates</p>
                {packRarityChances[selectedPack.id].map(({ rarity, chance }) => (
                  <div key={rarity} className="flex items-center gap-2">
                    <span className={`w-20 rounded px-1.5 py-0.5 text-[10px] text-center ${rarityBadgeColors[rarity]}`}>
                      {rarityLabel[rarity] || rarity}
                    </span>
                    <div className="h-2 flex-1 rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-zinc-500"
                        style={{ width: `${Math.max(chance, 1)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-xs text-zinc-400">
                      {chance < 0.1 ? chance.toFixed(2) : chance < 1 ? chance.toFixed(1) : Math.round(chance)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              {[1, 5, 10].map((qty) => {
                const cost = selectedPack.price * qty
                const affordable = canAfford(cost)
                return (
                  <button
                    key={qty}
                    onClick={() => handleBuy(selectedPack.id, qty)}
                    disabled={!affordable || buying}
                    className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium ${
                      affordable
                        ? 'btn-arcade'
                        : 'cursor-not-allowed bg-zinc-800/50 text-zinc-600 transition-colors'
                    } disabled:opacity-50`}
                  >
                    <span>Buy {qty} pack{qty > 1 ? 's' : ''}</span>
                    <span className={affordable ? 'font-semibold text-white/95' : 'text-zinc-600'}>
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
              className="mt-4 w-full rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
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
                isNew={Date.now() - new Date(pack.created_at).getTime() < 7 * 24 * 60 * 60 * 1000}
                createdAt={pack.created_at}
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
