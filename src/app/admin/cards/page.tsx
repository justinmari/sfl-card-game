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
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/admin" backLabel="Admin" title="Manage Cards" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <CardUploadForm />
        <CardList cards={cards || []} />
      </main>
    </div>
  )
}
