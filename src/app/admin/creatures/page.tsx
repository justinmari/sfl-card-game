import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import CreatureList from './creature-list'

export default async function AdminCreaturesPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: creatures } = await supabase
    .from('creatures')
    .select('*')
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Manage Creatures" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <CreatureList creatures={creatures || []} />
      </main>
    </div>
  )
}
