import { describe, it, expect } from 'vitest'
import { sectionize } from '@/components/card-filters'
import { rarityLabel } from '@/lib/rarities'

type Item = { rarity: string; date?: string }
const item = (rarity: string, date?: string): Item => ({ rarity, date })
const getR = (i: Item) => i.rarity
const getD = (i: Item) => i.date

describe('sectionize', () => {
  it('returns null for non-sectioned sorts', () => {
    expect(sectionize([item('common')], 'name', getR, getD)).toBeNull()
    expect(sectionize([item('common')], 'count', getR, getD)).toBeNull()
  })

  it('groups consecutive cards by rarity tier with rarity labels', () => {
    const secs = sectionize([item('secret_rare'), item('secret_rare'), item('common')], 'rarity', getR, getD)!
    expect(secs).toHaveLength(2)
    expect(secs[0].label).toBe(rarityLabel['secret_rare'])
    expect(secs[0].items).toHaveLength(2)
    expect(secs[1].label).toBe(rarityLabel['common'])
    expect(secs[1].items).toHaveLength(1)
  })

  it('groups by day for the date sort', () => {
    const secs = sectionize(
      [item('common', '2026-06-17T10:00:00Z'), item('rare', '2026-06-17T22:00:00Z'), item('common', '2026-06-16T09:00:00Z')],
      'date', getR, getD,
    )!
    expect(secs).toHaveLength(2) // two distinct days
    expect(secs[0].items).toHaveLength(2)
    expect(secs[1].items).toHaveLength(1)
  })

  it('labels undated items "Unknown" under the date sort', () => {
    const secs = sectionize([item('common')], 'date', getR, getD)!
    expect(secs[0].label).toBe('Unknown')
  })
})
