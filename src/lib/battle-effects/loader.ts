import type { BattleEffect, EffectKind } from '@/lib/skills/types'
import { makeEffect } from './index'

// A battle_effects row as stored in the DB.
export type BattleEffectRow = {
  key: string
  name: string
  op: string
  params: Record<string, unknown> | null
  kind: string[] | null
  is_active?: boolean
}

// Build a runtime BattleEffect from a DB row by binding its op + params.
// Returns null (and logs) for a bad row — e.g. an unknown op — so a single
// malformed admin row can never crash battle computation. Callers filter nulls.
export function buildEffectFromRow(row: BattleEffectRow): BattleEffect | null {
  try {
    const kind = row.kind && row.kind.length > 0 ? (row.kind as EffectKind[]) : undefined
    return makeEffect(row.key, row.name, row.op, row.params ?? {}, kind)
  } catch (err) {
    console.warn(`[battle-effects] skipping invalid effect row "${row.key}" (op=${row.op}):`, err)
    return null
  }
}
