import { describe, it, expect } from 'vitest'
import { buildPackCardGrid, rarityRank, type PackCardSource } from '@/lib/pack-cards'

const src = (id: string, name: string, rarity: string, image: string | null = `${id}.webp`): PackCardSource => ({
  card_id: id,
  cards: { id, name, rarity, image_url: image },
})

describe('buildPackCardGrid', () => {
  it('reveals owned cards fully and reduces unowned cards to rarity only', () => {
    const pack = [src('a', 'Alpha', 'common'), src('b', 'Beta', 'rare')]
    const grid = buildPackCardGrid(pack, new Set(['a']))

    const alpha = grid.find((e) => e.owned && e.id === 'a')
    expect(alpha).toMatchObject({ owned: true, id: 'a', name: 'Alpha', rarity: 'common', image_url: 'a.webp' })

    const beta = grid.find((e) => !e.owned && e.rarity === 'rare')
    expect(beta).toEqual({ owned: false, rarity: 'rare' }) // no id/name/image
  })

  it('NEVER includes id/name/image for an unowned card (DOM-leak guard)', () => {
    const pack = [src('secret', 'Top Secret Card', 'secret_rare', 'secret.webp')]
    const grid = buildPackCardGrid(pack, new Set()) // owns nothing
    const blob = JSON.stringify(grid)
    expect(blob).not.toContain('Top Secret Card')
    expect(blob).not.toContain('secret.webp')
    expect(blob).not.toContain('"secret"') // the card id
    expect(grid[0]).toEqual({ owned: false, rarity: 'secret_rare' })
  })

  it('sorts rarest-first', () => {
    const pack = [src('a', 'A', 'common'), src('b', 'B', 'secret_rare'), src('c', 'C', 'rare')]
    const grid = buildPackCardGrid(pack, new Set(['a', 'b', 'c']))
    expect(grid.map((e) => e.rarity)).toEqual(['secret_rare', 'rare', 'common'])
  })

  it('dedupes cards that appear in multiple pack_cards rows', () => {
    const pack = [src('a', 'A', 'rare'), src('a', 'A', 'rare')]
    expect(buildPackCardGrid(pack, new Set(['a'])).length).toBe(1)
  })

  it('skips rows with a missing card join', () => {
    const pack: PackCardSource[] = [{ card_id: 'x', cards: null }, src('a', 'A', 'common')]
    const grid = buildPackCardGrid(pack, new Set(['a']))
    expect(grid.length).toBe(1)
    expect(grid[0]).toMatchObject({ id: 'a' })
  })

  it('rarityRank orders by the canonical rarity ladder', () => {
    expect(rarityRank('common')).toBeLessThan(rarityRank('secret_rare'))
    expect(rarityRank('rare')).toBeLessThan(rarityRank('legendary'))
  })
})
