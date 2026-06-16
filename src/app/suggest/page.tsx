import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import { isSuggestionsEnabled } from '@/lib/arena-settings'
import AppNavbar from '@/components/app-navbar'
import SuggestForm from './suggest-form'

export default async function SuggestPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!(await isSuggestionsEnabled())) redirect('/dashboard')

  const supabase = await createClient()

  const { data: count } = await supabase.rpc('get_suggestion_count')
  const pendingCount = count ?? 0

  const { data: creatures } = await supabase
    .from('creatures')
    .select('id, name')
    .order('name')

  return (
    <div className="min-h-screen text-white">
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
