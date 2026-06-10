'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Card = {
  id: string
  name: string
  description: string | null
  image_url: string | null
  rarity: string
  created_at: string
}

const rarityColors: Record<string, string> = {
  common: 'border-zinc-500',
  uncommon: 'border-green-500',
  rare: 'border-blue-500',
  legendary: 'border-amber-500',
}

const rarityBadgeColors: Record<string, string> = {
  common: 'bg-zinc-600',
  uncommon: 'bg-green-700',
  rare: 'bg-blue-700',
  legendary: 'bg-amber-700',
}

export default function CardList({ cards }: { cards: Card[] }) {
  const router = useRouter()

  const handleDelete = async (id: string, imageUrl: string | null) => {
    if (!confirm('Delete this card?')) return

    const supabase = createClient()

    // Delete image from storage
    if (imageUrl) {
      const path = imageUrl.split('/card-images/')[1]
      if (path) {
        await supabase.storage.from('card-images').remove([path])
      }
    }

    await supabase.from('cards').delete().eq('id', id)
    router.refresh()
  }

  if (cards.length === 0) {
    return (
      <div className="text-center text-zinc-500 py-10">
        No cards yet. Upload your first card above!
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">All Cards ({cards.length})</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`group relative overflow-hidden rounded-xl border-2 ${rarityColors[card.rarity]} bg-zinc-900`}
          >
            {card.image_url && (
              <img
                src={card.image_url}
                alt={card.name}
                className="h-40 w-full object-cover"
              />
            )}
            <div className="p-3">
              <p className="text-sm font-semibold">{card.name}</p>
              <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs ${rarityBadgeColors[card.rarity]}`}>
                {card.rarity}
              </span>
            </div>
            <button
              onClick={() => handleDelete(card.id, card.image_url)}
              className="absolute right-2 top-2 hidden rounded bg-red-600 px-2 py-1 text-xs group-hover:block"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
