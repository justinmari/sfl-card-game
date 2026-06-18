export type { Skill, SkillHooks, BattleEffect, BattleEffectHooks, EffectKind, SynergyScope, SynergyTarget, FaceOffState, RoundContext, ActiveSkill } from './types'
export { SKILL_DOUBLE_EDGE } from './double-edge'
export { SKILL_LOADED_DICE } from './loaded-dice'
export { SKILL_SNAKE_EYES } from './snake-eyes'
export { SKILL_ALL_OR_NOTHING } from './all-or-nothing'
export { SKILL_SCRAMBLE } from './scramble'
export { SKILL_LEVELER } from './leveler'
export { SKILL_BEATDOWN } from './beatdown'
export { SKILL_REVERSE_UNO } from './reverse-uno'
export { SKILL_UNDERDOG } from './underdog'
export { SKILL_HEAL_INSTEAD } from './heal-instead'
export { SKILL_BROWN_TINT } from './brown-tint'
export { SKILL_GIFT_EXCHANGE } from './gift-exchange'
export { SKILL_FINAL_FORM } from './final-form'
export { SKILL_REFLECT } from './reflect'

import type { Skill } from './types'
import { SKILL_DOUBLE_EDGE } from './double-edge'
import { SKILL_LOADED_DICE } from './loaded-dice'
import { SKILL_SNAKE_EYES } from './snake-eyes'
import { SKILL_ALL_OR_NOTHING } from './all-or-nothing'
import { SKILL_SCRAMBLE } from './scramble'
import { SKILL_LEVELER } from './leveler'
import { SKILL_BEATDOWN } from './beatdown'
import { SKILL_REVERSE_UNO } from './reverse-uno'
import { SKILL_UNDERDOG } from './underdog'
import { SKILL_HEAL_INSTEAD } from './heal-instead'
import { SKILL_BROWN_TINT } from './brown-tint'
import { SKILL_GIFT_EXCHANGE } from './gift-exchange'
import { SKILL_FINAL_FORM } from './final-form'
import { SKILL_REFLECT } from './reflect'

// Registry — maps DB skill IDs to full definitions
// Add new skills here after creating their file
export const SKILL_REGISTRY: Record<string, Skill> = {
  'double-edge': SKILL_DOUBLE_EDGE,
  'loaded-dice': SKILL_LOADED_DICE,
  'snake-eyes': SKILL_SNAKE_EYES,
  'all-or-nothing': SKILL_ALL_OR_NOTHING,
  'scramble': SKILL_SCRAMBLE,
  'leveler': SKILL_LEVELER,
  'beatdown': SKILL_BEATDOWN,
  'reverse-uno': SKILL_REVERSE_UNO,
  'underdog': SKILL_UNDERDOG,
  'heal-instead': SKILL_HEAL_INSTEAD,
  'brown-tint': SKILL_BROWN_TINT,
  'gift-exchange': SKILL_GIFT_EXCHANGE,
  'final-form': SKILL_FINAL_FORM,
  'reflect': SKILL_REFLECT,
}

import { buildEffectFromRow, type BattleEffectRow } from '@/lib/battle-effects/loader'

// Maps a skill id to the ordered battle-effect rows that compose it (from the
// skill_effects + battle_effects tables). Serializable (no functions), so it
// can be passed from server components to client components.
export type SkillEffectRows = Record<string, BattleEffectRow[]>

// Resolve skill IDs into full Skill objects.
// - `dbSkills` overrides name/description from the skills table.
// - `skillEffectRows` (when present for an id) composes the skill's effects
//   from the DB; otherwise we fall back to the in-code SKILL_REGISTRY.
export function resolveSkills(
  skillIds: string[],
  dbSkills?: { id: string; name: string; description: string }[],
  skillEffectRows?: SkillEffectRows,
): Skill[] {
  return skillIds.map((id) => {
    const dbOverride = dbSkills?.find((s) => s.id === id)
    const rows = skillEffectRows?.[id]
    if (rows && rows.length > 0) {
      // Skip any invalid effect rows; only use the DB composition if at least
      // one valid effect survives, else fall through to the code registry.
      const effects = rows.map(buildEffectFromRow).filter((e): e is NonNullable<typeof e> => e !== null)
      if (effects.length > 0) {
        return {
          id,
          name: dbOverride?.name ?? id,
          description: dbOverride?.description ?? '',
          usesPerBattle: 1,
          effects,
        } as Skill
      }
    }
    const base = SKILL_REGISTRY[id]
    if (!base) return null
    if (dbOverride) return { ...base, name: dbOverride.name, description: dbOverride.description }
    return base
  }).filter(Boolean) as Skill[]
}
