import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import PackShop from './pack-shop'

export default async function ShopPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  const { data: packs } = await supabase
    .from('packs')
    .select('*, pack_cards(card_id)')
    .eq('is_active', true)
    .order('price')

  // Get user's owned card IDs
  const { data: userCards } = await supabase
    .from('user_cards')
    .select('card_id')
    .eq('user_id', profile.id)

  const ownedCardIds = new Set((userCards || []).map((uc) => uc.card_id))

  // Build ownership counts per pack
  const packOwnership: Record<string, { owned: number; total: number }> = {}
  for (const pack of packs || []) {
    const cardIds = pack.pack_cards.map((pc: { card_id: string }) => pc.card_id)
    const uniqueCardIds = [...new Set(cardIds)] as string[]
    packOwnership[pack.id] = {
      total: uniqueCardIds.length,
      owned: uniqueCardIds.filter((id) => ownedCardIds.has(id)).length,
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Shop" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <PackShop
          packs={packs || []}
          gruten={profile.gruten}
          packOwnership={packOwnership}
        />
      </main>
    </div>
  )
}
