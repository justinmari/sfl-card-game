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
    .select('*, creatures(name)')
    .order('created_at', { ascending: false })

  const { data: creatures } = await supabase
    .from('creatures')
    .select('*')
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Manage Cards" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <CardUploadForm creatures={creatures || []} />
        <CardList cards={cards || []} creatures={creatures || []} />
      </main>
    </div>
  )
}
