export type { Skill, SkillEffect, ActiveSkill } from './types'
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
}

// Resolve skill IDs from DB into full Skill objects
// dbSkills can override name/description from the skills table
export function resolveSkills(
  skillIds: string[],
  dbSkills?: { id: string; name: string; description: string }[],
): Skill[] {
  return skillIds.map((id) => {
    const base = SKILL_REGISTRY[id]
    if (!base) return null
    const dbOverride = dbSkills?.find((s) => s.id === id)
    if (dbOverride) return { ...base, name: dbOverride.name, description: dbOverride.description }
    return base
  }).filter(Boolean) as Skill[]
}
