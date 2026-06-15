import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import AppNavbar from '@/components/app-navbar'
import CollectionGrid from './collection-grid'
import { SKILL_REGISTRY } from '@/lib/skills'

export default async function CollectionPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: userCards } = await supabase
    .from('user_cards')
    .select('card_id, count, obtained_at, cards(*, creatures(name), card_skills(skill_id), card_types(types(name)))')
    .eq('user_id', profile.id)
    .gt('count', 0)
    .order('obtained_at', { ascending: false })

  const { data: packs } = await supabase
    .from('packs')
    .select('id, name, pack_cards(card_id)')
    .eq('is_active', true)
    .order('name')

  const { data: creatures } = await supabase
    .from('creatures')
    .select('id, name')
    .order('name')

  const { data: dbSkills } = await supabase.from('skills').select('id, name, description')
  const skillNameMap = new Map((dbSkills || []).map((s) => [s.id, s.name]))
  const skillDescMap = new Map((dbSkills || []).map((s) => [s.id, s.description]))

  const rows = userCards || []
  const totalCards = rows.reduce((sum, uc) => sum + uc.count, 0)

  const cardCounts = rows.map((uc) => {
    const c = uc.cards as unknown as { id: string; name: string; description: string | null; image_url: string | null; rarity: string; creatures: { name: string } | null; card_skills: { skill_id: string }[]; card_types: { types: { name: string } | null }[] }
    return {
      card: {
        id: uc.card_id,
        name: c.name,
        description: c.description,
        image_url: c.image_url,
        rarity: c.rarity,
        creature_name: c.creatures?.name || null,
        skillNames: (c.card_skills || []).map((s) => skillNameMap.get(s.skill_id) || SKILL_REGISTRY[s.skill_id]?.name || s.skill_id),
        skillDescriptions: (c.card_skills || []).map((s) => skillDescMap.get(s.skill_id) || SKILL_REGISTRY[s.skill_id]?.description || ''),
        typeNames: (c.card_types || []).map((ct) => ct.types?.name || '').filter(Boolean),
      },
      count: uc.count,
      obtainedAt: uc.obtained_at as string,
    }
  })

  const packFilters = (packs || []).map((p) => ({
    id: p.id,
    name: p.name,
    cardIds: p.pack_cards.map((pc: { card_id: string }) => pc.card_id),
  }))

  return (
    <div className="min-h-screen text-white">
      <AppNavbar backHref="/dashboard" title="My Collection" />

      <main className="mx-auto max-w-5xl px-6 py-10">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="mb-6 text-5xl">📭</span>
            <h2 className="mb-2 text-xl font-bold">No cards yet</h2>
            <p className="mb-4 text-sm text-zinc-400">
              Open some packs to start your collection!
            </p>
            <Link
              href="/shop"
              className="btn-arcade rounded-lg px-5 py-2 text-sm"
            >
              Visit Shop
            </Link>
          </div>
        ) : (
          <CollectionGrid cardCounts={cardCounts} packFilters={packFilters} creatures={creatures || []} totalCards={totalCards} />
        )}
      </main>
    </div>
  )
}
