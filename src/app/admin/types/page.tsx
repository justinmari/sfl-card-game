import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import TypeList from './type-list'

export default async function AdminTypesPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: types } = await supabase
    .from('types')
    .select('*')
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Manage Types" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <TypeList types={types || []} />
      </main>
    </div>
  )
}
