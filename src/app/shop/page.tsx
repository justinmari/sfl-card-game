import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import PackShop from './pack-shop'
import { buildPackCardGrid, type PackCardSource, type TinyCardEntry } from '@/lib/pack-cards'

export default async function ShopPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  const { data: packs } = await supabase
    .from('packs')
    .select('*, pack_cards(card_id, pull_percentage, cards(id, name, rarity, image_url))')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  // Get user's owned card IDs (only count > 0)
  const { data: userCards } = await supabase
    .from('user_cards')
    .select('card_id')
    .eq('user_id', profile.id)
    .gt('count', 0)

  const ownedCardIds = new Set((userCards || []).map((uc) => uc.card_id))

  // Build ownership counts per pack
  const packOwnership: Record<string, { owned: number; total: number }> = {}
  const packRarityChances: Record<string, { rarity: string; chance: number }[]> = {}
  const packCards: Record<string, TinyCardEntry[]> = {}
  for (const pack of packs || []) {
    const cardIds = pack.pack_cards.map((pc: { card_id: string }) => pc.card_id)
    const uniqueCardIds = [...new Set(cardIds)] as string[]
    packOwnership[pack.id] = {
      total: uniqueCardIds.length,
      owned: uniqueCardIds.filter((id) => ownedCardIds.has(id)).length,
    }
    // Card grid for the buy modal. Unowned cards are stripped to rarity-only
    // server-side so undiscovered cards never reach the client DOM.
    packCards[pack.id] = buildPackCardGrid(pack.pack_cards as PackCardSource[], ownedCardIds)

    const rarityMap = new Map<string, number>()
    for (const pc of pack.pack_cards as { pull_percentage: number; cards: { rarity: string } }[]) {
      const r = pc.cards.rarity
      rarityMap.set(r, (rarityMap.get(r) || 0) + pc.pull_percentage)
    }
    packRarityChances[pack.id] = Array.from(rarityMap.entries())
      .map(([rarity, chance]) => ({ rarity, chance }))
      .sort((a, b) => b.chance - a.chance)
  }

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Shop" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight">
            <span className="text-arcade-gradient">Card Packs</span>
          </h2>
          <p className="mt-1 text-sm text-zinc-400">Spend your Gruten and chase the secret rares.</p>
        </div>
        <PackShop
          packs={packs || []}
          gruten={profile.gruten}
          packOwnership={packOwnership}
          packRarityChances={packRarityChances}
          packCards={packCards}
        />
      </main>
    </div>
  )
}
