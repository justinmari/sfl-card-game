import { describe, it, expect } from 'vitest'
import { resolveSkills, SKILL_REGISTRY, type SkillEffectRows } from '@/lib/skills'
import { resolveFaceOff, type BattleCard, type ActiveSkill, type FaceOffDetail } from '@/lib/battle-engine'
import { createSeededRng } from '@/lib/seeded-random'
import { serviceSelect } from './rpc-helpers'

const card = (rarity: string, id: string): BattleCard => ({ id, name: 'x', image_url: null, rarity, creature_name: null })
const mk = (skill: ActiveSkill['skill']): ActiveSkill => ({ skill, activatedBy: 'p1', roundActivated: 1 })
const snap = (r: FaceOffDetail) => ({ star1: r.star1, star2: r.star2, roll1: r.roll1, roll2: r.roll2, effective1: r.effective1, effective2: r.effective2, damage1: r.damage1, damage2: r.damage2 })

describe('DB-composed skills parity with code registry', () => {
  it('a skill composed from the DB battle_effects row matches the in-code skill', async () => {
    const rows = await serviceSelect('battle_effects', 'key=eq.double-totals&select=key,name,op,params,kind,is_active')
    expect(rows.length).toBe(1)
    const skillEffectRows: SkillEffectRows = { 'db-double': rows }

    const [dbSkill] = resolveSkills(['db-double'], undefined, skillEffectRows)
    const codeSkill = SKILL_REGISTRY['double-edge']

    const fromDb = resolveFaceOff(card('rare', 'a'), card('rare', 'b'), [mk(dbSkill)], createSeededRng(42))
    const fromCode = resolveFaceOff(card('rare', 'a'), card('rare', 'b'), [mk(codeSkill)], createSeededRng(42))
    expect(snap(fromDb)).toEqual(snap(fromCode))
  })

  it('Final Form composed from DB (two effects) matches the code skill', async () => {
    const rows = await serviceSelect('battle_effects', 'key=in.(ascend-rarity,ascend-power)&select=key,name,op,params,kind,is_active&order=key.desc')
    // order: ascend-rarity before ascend-power (rarity then power); key.desc gives rarity,power
    const skillEffectRows: SkillEffectRows = { 'db-ff': rows }
    const [dbSkill] = resolveSkills(['db-ff'], undefined, skillEffectRows)
    const codeSkill = SKILL_REGISTRY['final-form']

    const fromDb = resolveFaceOff(card('common', 'a'), card('rare', 'b'), [mk(dbSkill)], createSeededRng(7))
    const fromCode = resolveFaceOff(card('common', 'a'), card('rare', 'b'), [mk(codeSkill)], createSeededRng(7))
    expect(snap(fromDb)).toEqual(snap(fromCode))
  })

  it('falls back to the code registry when no DB effect rows exist', () => {
    const [skill] = resolveSkills(['double-edge'], undefined, {})
    expect(skill.effects).toEqual(SKILL_REGISTRY['double-edge'].effects)
  })
})
