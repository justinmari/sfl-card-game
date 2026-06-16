import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/get-profile'
import { createClient } from '@/lib/supabase/server'
import AppNavbar from '@/components/app-navbar'
import { loadSkillEffectRows } from '@/lib/battle-effects/skill-effects'
import { loadSynergyDefRows } from '@/lib/synergies/loader'
import TestArena from './test-arena'

export default async function TestArenaPage() {
  const profile = await getProfile()
  if (!profile || profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()

  // Get admin's legal decks
  const { data: decks } = await supabase
    .from('decks')
    .select('slot, name, card_ids')
    .eq('user_id', profile.id)
    .order('slot')

  // Get all cards for bot decks
  const { data: allCards } = await supabase
    .from('cards')
    .select('id, name, image_url, rarity, creatures(name), card_skills(skill_id), card_types(type_id)')

  // Get skill display info + battle-effect composition + synergies from DB
  const { data: dbSkills } = await supabase.from('skills').select('id, name, description')
  const skillEffectRows = await loadSkillEffectRows(supabase)
  const synergyDefs = await loadSynergyDefRows(supabase)

  const cardList = (allCards || []).map((c) => {
    const card = c as unknown as { id: string; name: string; image_url: string | null; rarity: string; creatures: { name: string } | null; card_skills: { skill_id: string }[]; card_types: { type_id: string }[] }
    return {
      id: card.id, name: card.name, image_url: card.image_url, rarity: card.rarity,
      creature_name: card.creatures?.name || null,
      dbSkillIds: (card.card_skills || []).map((s) => s.skill_id),
      types: (card.card_types || []).map((t) => t.type_id),
    }
  })

  // Get card details for admin decks
  const allDeckCardIds = (decks || []).flatMap((d) => d.card_ids || [])
  const cardMap = new Map(cardList.map((c) => [c.id, c]))

  const adminDecks = (decks || [])
    .filter((d) => d.card_ids?.length === 5)
    .map((d) => ({
      slot: d.slot as number,
      name: d.name as string,
      cards: (d.card_ids as string[]).map((id) => cardMap.get(id)).filter((c): c is typeof cardList[0] => !!c),
    }))

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <AppNavbar backHref="/arena" title="Test Arena" />

      <main className="mx-auto max-w-4xl px-6 py-10">
        {adminDecks.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-zinc-400">You need a legal deck (5 cards) to test. Go to Decks first.</p>
          </div>
        ) : (
          <TestArena
            userId={profile.id}
            userName={profile.full_name || 'Admin'}
            avatarUrl={profile.avatar_url || null}
            adminDecks={adminDecks}
            allCards={cardList}
            dbSkills={(dbSkills || []) as { id: string; name: string; description: string }[]}
            skillEffectRows={skillEffectRows}
            synergyDefs={synergyDefs}
          />
        )}
      </main>
    </div>
  )
}
