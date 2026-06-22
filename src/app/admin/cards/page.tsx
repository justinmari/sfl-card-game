import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import CardUploadForm from './card-upload-form'
import CardList from './card-list'

export default async function AdminCardsPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: cards } = await supabase
    .from('cards')
    .select('*, creatures(name), card_types(type_id)')
    .order('created_at', { ascending: false })

  const { data: creatures } = await supabase
    .from('creatures')
    .select('*')
    .order('name')

  const { data: types } = await supabase
    .from('types')
    .select('id, name')
    .order('name')

  // Users an admin can attribute a card to (admins can read all profiles).
  const { data: users } = await supabase
    .from('profiles')
    .select('id, full_name')
    .not('full_name', 'is', null)
    .order('full_name')

  // Get all card IDs that are in at least one pack
  const { data: packCards } = await supabase
    .from('pack_cards')
    .select('card_id')
  const cardsInPacks = new Set((packCards || []).map((pc) => pc.card_id))

  // All packs (active or not) with their card ids, for the per-pack filter.
  const { data: packsData } = await supabase
    .from('packs')
    .select('id, name, is_active, pack_cards(card_id)')
    .order('name')
  const packFilters = (packsData || []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    isActive: p.is_active as boolean,
    cardIds: ((p.pack_cards as { card_id: string }[]) || []).map((pc) => pc.card_id),
  }))

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Manage Cards" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <CardUploadForm creatures={creatures || []} types={types || []} authorId={profile.id} authorName={profile.full_name || null} />
        <CardList cards={cards || []} creatures={creatures || []} types={types || []} cardsInPacks={[...cardsInPacks] as string[]} packFilters={packFilters} users={users || []} />
      </main>
    </div>
  )
}
