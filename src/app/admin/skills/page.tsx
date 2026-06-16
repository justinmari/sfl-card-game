import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import SkillList from './skill-list'

export default async function AdminSkillsPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: skills } = await supabase
    .from('skills')
    .select('*, card_skills(card_id, cards(name, rarity)), skill_effects(battle_effect_id, ordinal)')
    .order('name')

  const { data: allCards } = await supabase
    .from('cards')
    .select('id, name, rarity, image_url')
    .order('name')

  const { data: allEffects } = await supabase
    .from('battle_effects')
    .select('id, key, name')
    .eq('is_active', true)
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Manage Skills" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <SkillList
          skills={skills || []}
          allCards={(allCards || []) as { id: string; name: string; rarity: string; image_url: string | null }[]}
          allEffects={(allEffects || []) as { id: string; key: string; name: string }[]}
        />
      </main>
    </div>
  )
}
