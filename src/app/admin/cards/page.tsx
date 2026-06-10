import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
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
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-zinc-400 hover:text-white">
              &larr; Admin
            </Link>
            <h1 className="text-xl font-bold">Manage Cards</h1>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <CardUploadForm />
        <CardList cards={cards || []} />
      </main>
    </div>
  )
}
