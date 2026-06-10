import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

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

export default async function CollectionPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: userCards } = await supabase
    .from('user_cards')
    .select('*, cards(*)')
    .eq('user_id', profile.id)
    .order('obtained_at', { ascending: false })

  const cards = userCards || []

  // Count duplicates
  const cardCounts = new Map<string, { card: typeof cards[0]['cards']; count: number }>()
  for (const uc of cards) {
    const existing = cardCounts.get(uc.card_id)
    if (existing) {
      existing.count++
    } else {
      cardCounts.set(uc.card_id, { card: uc.cards, count: 1 })
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-zinc-400 hover:text-white">
              &larr; Back
            </Link>
            <h1 className="text-xl font-bold">My Collection</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">
              {cards.length} card{cards.length !== 1 ? 's' : ''} ({cardCounts.size} unique)
            </span>
            {profile.user_metadata?.avatar_url && (
              <img
                src={profile.user_metadata.avatar_url}
                alt="Avatar"
                className="h-8 w-8 rounded-full"
              />
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="mb-6 text-5xl">📭</span>
            <h2 className="mb-2 text-xl font-bold">No cards yet</h2>
            <p className="mb-4 text-sm text-zinc-400">
              Open some packs to start your collection!
            </p>
            <Link
              href="/shop"
              className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
            >
              Visit Shop
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from(cardCounts.values()).map(({ card, count }) => (
              <div
                key={card.id}
                className={`relative overflow-hidden rounded-xl border-2 ${rarityColors[card.rarity]} bg-zinc-900`}
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
                  <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${rarityBadgeColors[card.rarity]}`}>
                    {card.rarity}
                  </span>
                </div>
                {count > 1 && (
                  <span className="absolute right-2 top-2 rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-bold">
                    x{count}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
