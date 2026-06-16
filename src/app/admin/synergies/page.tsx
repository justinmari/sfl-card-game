import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import SynergyList from './synergy-list'

export default async function AdminSynergiesPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: synergies } = await supabase
    .from('synergies')
    .select('id, name, description, is_active, synergy_requirements(id, type_id, count), synergy_effects(id, battle_effect_id, scope, target, ordinal)')
    .order('name')
  const { data: types } = await supabase.from('types').select('id, name').order('name')
  const { data: effects } = await supabase.from('battle_effects').select('id, key, name, op').eq('is_active', true).order('name')

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="Synergies" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <SynergyList
          synergies={(synergies || []) as never}
          types={(types || []) as { id: string; name: string }[]}
          effects={(effects || []) as { id: string; key: string; name: string; op: string }[]}
        />
      </main>
    </div>
  )
}
