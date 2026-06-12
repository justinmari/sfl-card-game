import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import PackCreator from './pack-creator'

export default async function CreatePackPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: cards } = await supabase
    .from('cards')
    .select('*, creatures(name)')
    .order('created_at', { ascending: false })

  const { data: packCards } = await supabase.from('pack_cards').select('card_id')
  const cardsInPacks = [...new Set((packCards || []).map((pc) => pc.card_id))] as string[]

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/admin/packs" backLabel="Packs" title="Create Pack" />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <PackCreator cards={cards || []} cardsInPacks={cardsInPacks} />
      </main>
    </div>
  )
}
