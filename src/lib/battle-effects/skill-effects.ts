import type { SkillEffectRows } from '@/lib/skills'

type EffectJoin = {
  skill_id: string
  ordinal: number
  battle_effects: { key: string; name: string; op: string; params: Record<string, unknown> | null; kind: string[] | null; is_active: boolean } | null
}

// Minimal shape we need from a Supabase client (server or browser). Loosely
// typed so both the server and browser clients satisfy it.
type QueryClient = { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

// Load the skill → ordered battle-effect-rows map from the DB. The result is
// serializable (plain data), so a server component can pass it to the client
// where resolveSkills() builds the actual effect hooks.
export async function loadSkillEffectRows(supabase: QueryClient): Promise<SkillEffectRows> {
  const { data } = (await supabase
    .from('skill_effects')
    .select('skill_id, ordinal, battle_effects(key, name, op, params, kind, is_active)')
    .order('ordinal')) as { data: EffectJoin[] | null }

  const map: SkillEffectRows = {}
  for (const row of data ?? []) {
    const be = row.battle_effects
    if (!be || be.is_active === false) continue
    ;(map[row.skill_id] ??= []).push({ key: be.key, name: be.name, op: be.op, params: be.params, kind: be.kind })
  }
  return map
}
