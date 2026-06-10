'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import TradingCard from '@/components/trading-card'

type Pack = {
  id: string
  name: string
  description: string | null
  cards_per_pack: number
  price: number
  image_url: string | null
  pack_cards: { count: number }[]
}

type PulledCard = {
  id: string
  name: string
  rarity: string
  image_url: string | null
  description: string | null
}

export default function PackShop({ packs, gruten }: { packs: Pack[]; gruten: number }) {
  const [buying, setBuying] = useState<string | null>(null)
  const [pulledCards, setPulledCards] = useState<PulledCard[] | null>(null)
  const [currentGruten, setCurrentGruten] = useState(gruten)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleBuy = async (packId: string) => {
    setBuying(packId)
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
        body: JSON.stringify({ pack_id: packId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to buy pack')
      }

      setPulledCards(data.cards)
      setCurrentGruten(data.gruten_remaining)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBuying(null)
    }
  }

  const closeResults = () => {
    setPulledCards(null)
    router.refresh()
  }

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

      {/* Pack results overlay */}
      {pulledCards && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-8">
            <h2 className="mb-6 text-center text-2xl font-bold">You pulled:</h2>
            <div className="mb-6 flex flex-wrap justify-center gap-4">
              {pulledCards.map((card, i) => (
                <TradingCard key={i} card={card} size="sm" />
              ))}
            </div>
            <div className="text-center">
              <button
                onClick={closeResults}
                className="rounded-lg bg-white px-6 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
              >
                Nice!
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {packs.map((pack) => {
          const canAfford = currentGruten === -1 || currentGruten >= pack.price

          return (
            <div
              key={pack.id}
              className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-6"
            >
              <div className="mb-4 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-b from-zinc-800 to-zinc-900">
                {pack.image_url ? (
                  <img src={pack.image_url} alt={pack.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-5xl">🃏</span>
                )}
              </div>
              <h3 className="mb-1 text-lg font-semibold">{pack.name}</h3>
              {pack.description && (
                <p className="mb-3 text-sm text-zinc-400">{pack.description}</p>
              )}
              <div className="mb-4 flex items-center gap-3 text-sm text-zinc-400">
                <span>{pack.cards_per_pack} cards</span>
                <span className="font-medium text-amber-400">{pack.price} G</span>
              </div>
              <button
                onClick={() => handleBuy(pack.id)}
                disabled={!canAfford || buying === pack.id}
                className={`mt-auto rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  canAfford
                    ? 'bg-amber-600 text-white hover:bg-amber-500'
                    : 'cursor-not-allowed bg-zinc-700 text-zinc-500'
                } disabled:opacity-50`}
              >
                {buying === pack.id
                  ? 'Opening...'
                  : canAfford
                    ? `Buy for ${pack.price} G`
                    : 'Not enough Gruten'}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}
