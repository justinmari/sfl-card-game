import { describe, it, expect } from 'vitest'
import { createSeededRng, seededShuffle } from '@/lib/seeded-random'

describe('createSeededRng', () => {
  it('produces deterministic output for the same seed', () => {
    const rng1 = createSeededRng(42)
    const rng2 = createSeededRng(42)
    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())
    expect(seq1).toEqual(seq2)
  })

  it('produces different output for different seeds', () => {
    const rng1 = createSeededRng(1)
    const rng2 = createSeededRng(2)
    const val1 = rng1()
    const val2 = rng2()
    expect(val1).not.toEqual(val2)
  })

  it('returns values in [0, 1)', () => {
    const rng = createSeededRng(123)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('produces varied output (not stuck)', () => {
    const rng = createSeededRng(99)
    const values = new Set(Array.from({ length: 100 }, () => rng()))
    expect(values.size).toBeGreaterThan(90)
  })
})

describe('seededShuffle', () => {
  it('produces deterministic shuffle for the same RNG', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result1 = seededShuffle(arr, createSeededRng(42))
    const result2 = seededShuffle(arr, createSeededRng(42))
    expect(result1).toEqual(result2)
  })

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5]
    const copy = [...arr]
    seededShuffle(arr, createSeededRng(42))
    expect(arr).toEqual(copy)
  })

  it('contains all original elements', () => {
    const arr = [1, 2, 3, 4, 5]
    const result = seededShuffle(arr, createSeededRng(42))
    expect(result.sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('actually shuffles (not identity)', () => {
    const arr = Array.from({ length: 20 }, (_, i) => i)
    const result = seededShuffle(arr, createSeededRng(42))
    expect(result).not.toEqual(arr)
  })

  it('handles empty array', () => {
    expect(seededShuffle([], createSeededRng(1))).toEqual([])
  })

  it('handles single element', () => {
    expect(seededShuffle([42], createSeededRng(1))).toEqual([42])
  })
})
