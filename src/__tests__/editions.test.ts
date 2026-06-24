import { describe, it, expect } from 'vitest'
import {
  rarestEdition, ownsAnyHolo, ownedEditionsRarestFirst, isHoloEdition,
} from '@/lib/editions'

describe('editions helpers', () => {
  describe('rarestEdition', () => {
    it('returns the highest-rank owned finish', () => {
      expect(rarestEdition({ regular: 3, golden: 2, galaxy: 1 })).toBe('galaxy')
      expect(rarestEdition({ regular: 3, golden: 2 })).toBe('golden')
      expect(rarestEdition({ regular: 5 })).toBe('regular')
      expect(rarestEdition({ diamond: 1, golden: 4 })).toBe('diamond')
    })
    it('ignores zero counts and returns null when nothing is owned', () => {
      expect(rarestEdition({ regular: 0, golden: 0 })).toBeNull()
      expect(rarestEdition({})).toBeNull()
      expect(rarestEdition({ regular: 0, galaxy: 2 })).toBe('galaxy')
    })
  })

  describe('ownsAnyHolo', () => {
    it('is true only when a holo finish is owned', () => {
      expect(ownsAnyHolo({ regular: 5 })).toBe(false)
      expect(ownsAnyHolo({ regular: 5, golden: 1 })).toBe(true)
      expect(ownsAnyHolo({ galaxy: 1 })).toBe(true)
      expect(ownsAnyHolo({ golden: 0 })).toBe(false)
    })
  })

  describe('ownedEditionsRarestFirst', () => {
    it('lists owned finishes rarest-first', () => {
      expect(ownedEditionsRarestFirst({ regular: 3, golden: 2, galaxy: 1 })).toEqual(['galaxy', 'golden', 'regular'])
      expect(ownedEditionsRarestFirst({ regular: 1 })).toEqual(['regular'])
      expect(ownedEditionsRarestFirst({ diamond: 1, regular: 0 })).toEqual(['diamond'])
    })
  })

  describe('isHoloEdition', () => {
    it('treats only golden/diamond/galaxy as holo', () => {
      expect(isHoloEdition('golden')).toBe(true)
      expect(isHoloEdition('diamond')).toBe(true)
      expect(isHoloEdition('galaxy')).toBe(true)
      expect(isHoloEdition('regular')).toBe(false)
      expect(isHoloEdition(null)).toBe(false)
      expect(isHoloEdition(undefined)).toBe(false)
    })
  })
})
