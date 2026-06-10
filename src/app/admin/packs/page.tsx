import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import PackCreateForm from './pack-create-form'
import PackList from './pack-list'

export default async function AdminPacksPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()

  const { data: packs } = await supabase
    .from('packs')
    .select('*, pack_cards(*, cards(*))')
    .order('created_at', { ascending: false })

  const { data: cards } = await supabase
    .from('cards')
    .select('*')
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-zinc-400 hover:text-white">
              &larr; Admin
            </Link>
            <h1 className="text-xl font-bold">Manage Packs</h1>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <PackCreateForm cards={cards || []} />
        <PackList packs={packs || []} />
      </main>
    </div>
  )
}
