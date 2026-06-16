import { describe, it, expect } from 'vitest'
import { skillEffectKinds, rarityForStars } from '@/lib/skill-visuals'
import { SKILL_REGISTRY } from '@/lib/skills'

describe('skillEffectKinds', () => {
  it('uses explicit kinds where hooks are ambiguous (rarity vs power)', () => {
    expect(skillEffectKinds(SKILL_REGISTRY['final-form'])).toEqual(['rarity', 'power'])
    expect(skillEffectKinds(SKILL_REGISTRY['scramble'])).toEqual(['rarity', 'power'])
    expect(skillEffectKinds(SKILL_REGISTRY['leveler'])).toEqual(['power'])
  })

  it('maps round-level skills explicitly', () => {
    expect(skillEffectKinds(SKILL_REGISTRY['gift-exchange'])).toEqual(['deck'])
    expect(skillEffectKinds(SKILL_REGISTRY['heal-instead'])).toEqual(['heal'])
    expect(skillEffectKinds(SKILL_REGISTRY['brown-tint'])).toEqual(['visual'])
  })

  it('derives dice/total/damage from hooks', () => {
    expect(skillEffectKinds(SKILL_REGISTRY['loaded-dice'])).toContain('dice')
    expect(skillEffectKinds(SKILL_REGISTRY['snake-eyes'])).toContain('dice')
    expect(skillEffectKinds(SKILL_REGISTRY['underdog'])).toContain('dice')
    expect(skillEffectKinds(SKILL_REGISTRY['double-edge'])).toEqual(['total'])
    expect(skillEffectKinds(SKILL_REGISTRY['all-or-nothing'])).toEqual(['damage'])
    expect(skillEffectKinds(SKILL_REGISTRY['beatdown'])).toEqual(['damage'])
    expect(skillEffectKinds(SKILL_REGISTRY['reverse-uno'])).toEqual(['damage'])
  })

  it('every registered skill yields at least one effect kind', () => {
    for (const id of Object.keys(SKILL_REGISTRY)) {
      expect(skillEffectKinds(SKILL_REGISTRY[id]).length, `${id} should have a kind`).toBeGreaterThan(0)
    }
  })
})

describe('rarityForStars', () => {
  it('reverse-maps star counts to rarities', () => {
    expect(rarityForStars(1)).toBe('common')
    expect(rarityForStars(2)).toBe('uncommon')
    expect(rarityForStars(3)).toBe('rare')
    expect(rarityForStars(6)).toBe('secret_rare')
  })

  it('returns null for an unmapped star count', () => {
    expect(rarityForStars(0)).toBeNull()
    expect(rarityForStars(99)).toBeNull()
  })
})
