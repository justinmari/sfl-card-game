import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import DeckManager from './deck-manager'

export default async function DecksPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  const { data: decks } = await supabase
    .from('decks')
    .select('*')
    .eq('user_id', profile.id)
    .order('slot')

  const { data: userCards } = await supabase
    .from('user_cards')
    .select('card_id, cards(*, creatures(name), card_types(types(name)))')
    .eq('user_id', profile.id)
    .gt('count', 0)

  const ownedCards = (userCards || []).map((uc) => {
    const c = uc.cards as unknown as { id: string; name: string; description: string | null; image_url: string | null; rarity: string; creatures: { name: string } | null; card_types: { types: { name: string } | null }[] }
    return {
      id: uc.card_id,
      name: c.name,
      description: c.description,
      image_url: c.image_url,
      rarity: c.rarity,
      creature_name: c.creatures?.name || null,
      typeNames: (c.card_types || []).map((ct) => ct.types?.name || '').filter(Boolean),
    }
  })

  // Build deck data for all 3 slots
  const deckMap = new Map((decks || []).map((d) => [d.slot, d]))
  const allDecks = [1, 2, 3].map((slot) => {
    const deck = deckMap.get(slot)
    return {
      slot,
      name: deck?.name || `Deck ${slot}`,
      cardIds: deck?.card_ids || [],
    }
  })

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Decks" />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <DeckManager decks={allDecks} ownedCards={ownedCards} />
      </main>
    </div>
  )
}
