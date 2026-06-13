import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import SuggestForm from './suggest-form'

export default async function SuggestPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()

  const { data: count } = await supabase.rpc('get_suggestion_count')
  const pendingCount = count ?? 0

  const { data: creatures } = await supabase
    .from('creatures')
    .select('id, name')
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Suggest a Card" />

      <main className="mx-auto max-w-2xl px-6 py-10">
        <SuggestForm
          creatures={creatures || []}
          pendingCount={pendingCount}
        />
      </main>
    </div>
  )
}
