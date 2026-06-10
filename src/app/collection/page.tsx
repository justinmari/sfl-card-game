import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AppNavbar from '@/components/app-navbar'
import CollectionGrid from './collection-grid'

export default async function CollectionPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: userCards } = await supabase
    .from('user_cards')
    .select('*, cards(*, creatures(name))')
    .eq('user_id', profile.id)
    .order('obtained_at', { ascending: false })

  const { data: packs } = await supabase
    .from('packs')
    .select('id, name, pack_cards(card_id)')
    .eq('is_active', true)
    .order('name')

  const { data: creatures } = await supabase
    .from('creatures')
    .select('id, name')
    .order('name')

  const cards = userCards || []

  const cardCounts: { card: { id: string; name: string; description: string | null; image_url: string | null; rarity: string; creature_name: string | null }; count: number }[] = []
  const seen = new Map<string, number>()
  for (const uc of cards) {
    const idx = seen.get(uc.card_id)
    if (idx !== undefined) {
      cardCounts[idx].count++
    } else {
      seen.set(uc.card_id, cardCounts.length)
      const c = uc.cards
      cardCounts.push({
        card: {
          id: c.id,
          name: c.name,
          description: c.description,
          image_url: c.image_url,
          rarity: c.rarity,
          creature_name: c.creatures?.name || null,
        },
        count: 1,
      })
    }
  }

  const packFilters = (packs || []).map((p) => ({
    id: p.id,
    name: p.name,
    cardIds: p.pack_cards.map((pc: { card_id: string }) => pc.card_id),
  }))

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="My Collection" />

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
          <CollectionGrid cardCounts={cardCounts} packFilters={packFilters} creatures={creatures || []} />
        )}
      </main>
    </div>
  )
}
