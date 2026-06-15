import { describe, it, expect } from 'vitest'
import { SKILL_REGISTRY, resolveSkills } from '@/lib/skills'

describe('SKILL_REGISTRY', () => {
  it('contains all 13 skills', () => {
    expect(Object.keys(SKILL_REGISTRY)).toHaveLength(13)
  })

  it('every skill has required fields', () => {
    for (const [id, skill] of Object.entries(SKILL_REGISTRY)) {
      expect(skill.id).toBe(id)
      expect(skill.name).toBeTruthy()
      expect(skill.description).toBeTruthy()
      expect(skill.usesPerBattle).toBeGreaterThan(0)
      expect(skill.hooks).toBeDefined()
      expect(typeof skill.hooks).toBe('object')
    }
  })

  const expectedSkills = [
    'double-edge', 'loaded-dice', 'snake-eyes', 'all-or-nothing',
    'scramble', 'leveler', 'beatdown', 'reverse-uno', 'underdog',
    'heal-instead', 'brown-tint', 'gift-exchange', 'final-form',
  ]

  it.each(expectedSkills)('contains skill: %s', (id) => {
    expect(SKILL_REGISTRY[id]).toBeDefined()
  })
})

describe('resolveSkills', () => {
  it('resolves valid skill IDs to full Skill objects', () => {
    const skills = resolveSkills(['double-edge', 'scramble'])
    expect(skills).toHaveLength(2)
    expect(skills[0].id).toBe('double-edge')
    expect(skills[1].id).toBe('scramble')
  })

  it('filters out invalid skill IDs', () => {
    const skills = resolveSkills(['double-edge', 'nonexistent', 'scramble'])
    expect(skills).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    expect(resolveSkills([])).toEqual([])
  })

  it('applies DB overrides for name and description', () => {
    const dbSkills = [
      { id: 'double-edge', name: 'Custom Name', description: 'Custom Desc' },
    ]
    const skills = resolveSkills(['double-edge'], dbSkills)
    expect(skills[0].name).toBe('Custom Name')
    expect(skills[0].description).toBe('Custom Desc')
    expect(skills[0].hooks).toEqual(SKILL_REGISTRY['double-edge'].hooks)
  })

  it('keeps original name when no DB override exists', () => {
    const skills = resolveSkills(['scramble'], [])
    expect(skills[0].name).toBe(SKILL_REGISTRY['scramble'].name)
  })
})
