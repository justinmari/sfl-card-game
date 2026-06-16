import { buildEffectFromRow, type BattleEffectRow } from '@/lib/battle-effects/loader'
import type { SynergyScope, SynergyTarget } from '@/lib/skills'
import type { SynergyDef } from './index'

// Serializable synergy definition (passed server → client; no functions).
export type SynergyDefRow = {
  id: string
  name: string
  description: string
  requirements: { typeId: string; count: number }[]
  effects: { effectRow: BattleEffectRow; scope: SynergyScope; target: SynergyTarget }[]
}

// Build a runtime SynergyDef (with effect hooks) from a serializable row.
// Invalid effect rows are skipped (buildEffectFromRow logs + returns null).
export function buildSynergyDef(row: SynergyDefRow): SynergyDef {
  const effects: SynergyDef['effects'] = []
  for (const e of row.effects) {
    const effect = buildEffectFromRow(e.effectRow)
    if (effect) effects.push({ effect, scope: e.scope, target: e.target })
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    requirements: row.requirements,
    effects,
  }
}

type QueryClient = { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

type SynergyJoin = {
  id: string
  name: string
  description: string
  is_active: boolean
  synergy_requirements: { type_id: string; count: number }[]
  synergy_effects: {
    scope: SynergyScope
    target: SynergyTarget
    ordinal: number
    battle_effects: { key: string; name: string; op: string; params: Record<string, unknown> | null; kind: string[] | null; is_active: boolean } | null
  }[]
}

// Load active synergy definitions as serializable rows.
export async function loadSynergyDefRows(supabase: QueryClient): Promise<SynergyDefRow[]> {
  const { data } = (await supabase
    .from('synergies')
    .select('id, name, description, is_active, synergy_requirements(type_id, count), synergy_effects(scope, target, ordinal, battle_effects(key, name, op, params, kind, is_active))')
    .eq('is_active', true)) as { data: SynergyJoin[] | null }

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    requirements: (s.synergy_requirements ?? []).map((r) => ({ typeId: r.type_id, count: r.count })),
    effects: (s.synergy_effects ?? [])
      .filter((e) => e.battle_effects && e.battle_effects.is_active !== false)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((e) => ({
        effectRow: {
          key: e.battle_effects!.key, name: e.battle_effects!.name, op: e.battle_effects!.op,
          params: e.battle_effects!.params, kind: e.battle_effects!.kind,
        },
        scope: e.scope,
        target: e.target,
      })),
  }))
}
