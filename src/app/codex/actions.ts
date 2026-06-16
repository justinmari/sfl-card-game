'use server'

import { createClient } from '@/lib/supabase/server'
import { loadSynergyDefRows, buildSynergyDef } from '@/lib/synergies/loader'
import { metSynergies } from '@/lib/synergies'
import type { BattleCard } from '@/lib/battle-engine'

// Records (for the calling user only) every synergy their deck satisfies, so the
// Codex unlocks discovered synergies. Computed server-side from the deck's card
// types; RLS ensures a user can only insert their own discoveries.
export async function recordMyMetSynergies(cardIds: string[]) {
  if (!cardIds || cardIds.length === 0) return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const defs = (await loadSynergyDefRows(supabase)).map(buildSynergyDef).filter((d) => d.effects.length > 0 || d.requirements.length > 0)
  if (defs.length === 0) return

  const { data: ct } = await supabase.from('card_types').select('card_id, type_id').in('card_id', cardIds)
  const typeMap = new Map<string, string[]>()
  for (const r of (ct || []) as { card_id: string; type_id: string }[]) {
    const list = typeMap.get(r.card_id) ?? []
    list.push(r.type_id)
    typeMap.set(r.card_id, list)
  }
  const deck: BattleCard[] = cardIds.map((id) => ({ id, name: '', image_url: null, rarity: 'common', creature_name: null, types: typeMap.get(id) ?? [] }))

  const met = metSynergies(deck, defs)
  if (met.length === 0) return
  await supabase.from('discovered_synergies').upsert(
    met.map((s) => ({ user_id: user.id, synergy_id: s.id })),
    { onConflict: 'user_id,synergy_id', ignoreDuplicates: true },
  )
}
