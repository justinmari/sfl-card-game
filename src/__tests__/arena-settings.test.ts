import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMaybeSingle = vi.fn()
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ from: mockFrom })),
}))

import { isArenaEnabled } from '@/lib/arena-settings'

describe('isArenaEnabled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
  })

  it('returns true when value is true (boolean)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: true } })
    expect(await isArenaEnabled()).toBe(true)
  })

  it('returns true when value is "true" (string)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: 'true' } })
    expect(await isArenaEnabled()).toBe(true)
  })

  it('returns false when value is false (boolean)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: false } })
    expect(await isArenaEnabled()).toBe(false)
  })

  it('returns false when value is "false" (string)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: 'false' } })
    expect(await isArenaEnabled()).toBe(false)
  })

  it('returns true when no row exists (default)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null })
    expect(await isArenaEnabled()).toBe(true)
  })

  it('queries the correct table and key', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: true } })
    await isArenaEnabled()
    expect(mockFrom).toHaveBeenCalledWith('app_settings')
    expect(mockSelect).toHaveBeenCalledWith('value')
    expect(mockEq).toHaveBeenCalledWith('key', 'arena_enabled')
  })
})
