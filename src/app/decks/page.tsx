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
    .select('card_id, edition, count, cards(*, creatures(name), card_types(types(name)))')
    .eq('user_id', profile.id)
    .gt('count', 0)

  // One entry per card_id, carrying which finishes the player owns so the deck
  // editor can offer a finish picker per card.
  type Owned = { id: string; name: string; description: string | null; image_url: string | null; rarity: string; creature_name: string | null; typeNames: string[]; author_name: string | null; author_anonymous: boolean | null; editions: Record<string, number> }
  const ownedById = new Map<string, Owned>()
  for (const uc of userCards || []) {
    const edition = (uc.edition as string) || 'regular'
    const existing = ownedById.get(uc.card_id)
    if (existing) {
      existing.editions[edition] = (existing.editions[edition] ?? 0) + uc.count
      continue
    }
    const c = uc.cards as unknown as { id: string; name: string; description: string | null; image_url: string | null; rarity: string; creatures: { name: string } | null; card_types: { types: { name: string } | null }[]; author_name: string | null; author_anonymous: boolean | null }
    ownedById.set(uc.card_id, {
      id: uc.card_id,
      name: c.name,
      description: c.description,
      image_url: c.image_url,
      rarity: c.rarity,
      creature_name: c.creatures?.name || null,
      typeNames: (c.card_types || []).map((ct) => ct.types?.name || '').filter(Boolean),
      author_name: c.author_name,
      author_anonymous: c.author_anonymous,
      editions: { [edition]: uc.count },
    })
  }
  const ownedCards = [...ownedById.values()]

  // Build deck data for all 3 slots
  const deckMap = new Map((decks || []).map((d) => [d.slot, d]))
  const allDecks = [1, 2, 3].map((slot) => {
    const deck = deckMap.get(slot)
    return {
      slot,
      name: deck?.name || `Deck ${slot}`,
      cardIds: deck?.card_ids || [],
      cardEditions: deck?.card_editions || [],
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
