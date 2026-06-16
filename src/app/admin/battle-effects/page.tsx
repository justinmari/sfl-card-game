import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import EffectList from './effect-list'

export default async function AdminBattleEffectsPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: effects } = await supabase
    .from('battle_effects')
    .select('id, key, name, op, params, kind, is_active')
    .order('name')

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Battle Effects" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <EffectList effects={(effects || []) as never} />
      </main>
    </div>
  )
}
