import { describe, it, expect, beforeAll } from 'vitest'
import { serviceSelect } from './rpc-helpers'
import { buildEffectFromRow, type BattleEffectRow } from '@/lib/battle-effects/loader'
import { OP_REGISTRY } from '@/lib/battle-effects'

// Verifies the seeded battle_effects rows load into valid runtime effects.

describe('battle_effects (DB) → runtime effects', () => {
  let rows: BattleEffectRow[]

  beforeAll(async () => {
    rows = await serviceSelect('battle_effects', 'select=key,name,op,params,kind,is_active&order=key')
  })

  it('seeds the 14 built-in effects', () => {
    expect(rows.length).toBe(14)
    const keys = rows.map((r) => r.key)
    expect(keys).toContain('ascend-rarity')
    expect(keys).toContain('ascend-power')
    expect(keys).toContain('redeal-all')
  })

  it('every seeded op exists in OP_REGISTRY', () => {
    for (const r of rows) {
      expect(OP_REGISTRY[r.op], `op ${r.op} (effect ${r.key})`).toBeDefined()
    }
  })

  it('builds a valid BattleEffect from every row', () => {
    for (const r of rows) {
      const fx = buildEffectFromRow(r)
      expect(fx, `${r.key} should build`).not.toBeNull()
      expect(fx!.id).toBe(r.key)
      expect(fx!.kind.length).toBeGreaterThan(0)
      expect(typeof fx!.hooks).toBe('object')
      const hookCount = Object.values(fx!.hooks).filter(Boolean).length
      expect(hookCount, `${r.key} should bind at least one hook`).toBeGreaterThan(0)
    }
  })

  it('the DB-loaded double-totals effect doubles totals like the code path', () => {
    const row = rows.find((r) => r.key === 'double-totals')!
    const fx = buildEffectFromRow(row)!
    const out = fx.hooks.onTotals!({
      card1: { id: 'a', name: 'A', image_url: null, rarity: 'rare', creature_name: null },
      card2: { id: 'b', name: 'B', image_url: null, rarity: 'rare', creature_name: null },
      star1: 3, star2: 3, rarity1: 'rare', rarity2: 'rare',
      roll1: 1, roll2: 0, bonusRoll1: 0, bonusRoll2: 0, effective1: 4, effective2: 3, damage1: 0, damage2: 0, rand: () => 0,
    })
    expect(out.effective1).toBe(8)
    expect(out.effective2).toBe(6)
  })
})
