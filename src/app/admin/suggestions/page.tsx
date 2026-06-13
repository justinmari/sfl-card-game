import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import SuggestionList from './suggestion-list'

export default async function AdminSuggestionsPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()

  const { data: pending } = await supabase.rpc('admin_get_suggestions', { p_status: 'pending' })
  const { data: archived } = await supabase.rpc('admin_get_suggestions', { p_status: 'archived' })

  const { data: creatures } = await supabase
    .from('creatures')
    .select('id, name')
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Card Suggestions" />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <SuggestionList
          pending={pending || []}
          archived={archived || []}
          creatures={creatures || []}
        />
      </main>
    </div>
  )
}
