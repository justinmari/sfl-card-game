'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Pack = {
  id: string
  name: string
  description: string | null
  cards_per_pack: number
  price: number
  is_active: boolean
  created_at: string
  pack_cards: {
    pull_percentage: number
    cards: {
      id: string
      name: string
      rarity: string
    }
  }[]
}

const rarityBadgeColors: Record<string, string> = {
  common: 'bg-zinc-600',
  uncommon: 'bg-green-700',
  rare: 'bg-blue-700',
  legendary: 'bg-amber-700',
}

export default function PackList({ packs }: { packs: Pack[] }) {
  const router = useRouter()

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this pack?')) return
    const supabase = createClient()
    await supabase.from('packs').delete().eq('id', id)
    router.refresh()
  }

  const toggleActive = async (id: string, current: boolean) => {
    const supabase = createClient()
    await supabase.from('packs').update({ is_active: !current }).eq('id', id)
    router.refresh()
  }

  if (packs.length === 0) {
    return (
      <div className="py-10 text-center text-zinc-500">
        No packs yet. Create your first pack above!
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">All Packs ({packs.length})</h2>
      <div className="space-y-4">
        {packs.map((pack) => (
          <div key={pack.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">{pack.name}</h3>
                <span className={`rounded px-2 py-0.5 text-xs ${pack.is_active ? 'bg-green-700' : 'bg-zinc-700'}`}>
                  {pack.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-sm text-zinc-400">
                  {pack.cards_per_pack} cards/pack
                </span>
                <span className="text-sm font-medium text-amber-400">
                  {pack.price} G
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleActive(pack.id, pack.is_active)}
                  className="rounded border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  {pack.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(pack.id)}
                  className="rounded border border-red-800 px-3 py-1 text-xs text-red-400 hover:bg-red-900/30"
                >
                  Delete
                </button>
              </div>
            </div>

            {pack.description && (
              <p className="mb-3 text-sm text-zinc-400">{pack.description}</p>
            )}

            <div className="space-y-1">
              {pack.pack_cards
                .sort((a, b) => b.pull_percentage - a.pull_percentage)
                .map((pc) => (
                  <div key={pc.cards.id} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 rounded-full bg-zinc-700" style={{ width: '120px' }}>
                      <div
                        className="h-full rounded-full bg-white/30"
                        style={{ width: `${Math.min(pc.pull_percentage, 100)}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-zinc-400">
                      {pc.pull_percentage}%
                    </span>
                    <span>{pc.cards.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${rarityBadgeColors[pc.cards.rarity]}`}>
                      {pc.cards.rarity}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
