import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import PackCreateForm from './pack-create-form'
import PackList from './pack-list'

export default async function AdminPacksPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()

  const { data: packs } = await supabase
    .from('packs')
    .select('*, pack_cards(id, card_id, pull_percentage, cards(*))')
    .order('created_at', { ascending: false })

  const { data: cards } = await supabase
    .from('cards')
    .select('*')
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Manage Packs" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <PackCreateForm cards={cards || []} />
        <PackList packs={packs || []} allCards={cards || []} />
      </main>
    </div>
  )
}
