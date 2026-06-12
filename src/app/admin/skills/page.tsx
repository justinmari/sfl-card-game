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
    .select('*, card_skills(card_id, cards(name, rarity))')
    .order('name')

  const { data: allCards } = await supabase
    .from('cards')
    .select('id, name, rarity, image_url')
    .order('name')

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/dashboard" title="Manage Skills" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <SkillList skills={skills || []} allCards={(allCards || []) as { id: string; name: string; rarity: string; image_url: string | null }[]} />
      </main>
    </div>
  )
}
