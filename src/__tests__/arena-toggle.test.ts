import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockMaybeSingle = vi.fn()
const mockSingle = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: mockGetUser },
  })),
}))

import { toggleArena, getArenaStatus } from '@/app/admin/arena/arena-actions'

describe('getArenaStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle })
  })

  it('returns true when arena is enabled', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: true } })
    expect(await getArenaStatus()).toBe(true)
  })

  it('returns false when arena is disabled', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: false } })
    expect(await getArenaStatus()).toBe(false)
  })

  it('defaults to true when no setting exists', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null })
    expect(await getArenaStatus()).toBe(true)
  })
})

describe('toggleArena', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFrom.mockReturnValue({ select: mockSelect })
    mockSelect.mockReturnValue({ eq: mockEq })
  })

  it('returns error when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const result = await toggleArena(true)
    expect(result).toEqual({ success: false, error: 'Not authenticated' })
  })

  it('returns error when not admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user1' } } })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { role: 'player' } })
    const result = await toggleArena(true)
    expect(result).toEqual({ success: false, error: 'Not authorized' })
  })

  it('calls rpc_admin_enable_arena when enabling', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { role: 'admin' } })
    mockRpc.mockResolvedValue({ error: null })
    const result = await toggleArena(true)
    expect(result).toEqual({ success: true })
    expect(mockRpc).toHaveBeenCalledWith('rpc_admin_enable_arena')
  })

  it('calls rpc_admin_disable_arena when disabling', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { role: 'admin' } })
    mockRpc.mockResolvedValue({ error: null })
    const result = await toggleArena(false)
    expect(result).toEqual({ success: true })
    expect(mockRpc).toHaveBeenCalledWith('rpc_admin_disable_arena')
  })

  it('returns error when RPC fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'admin1' } } })
    mockEq.mockReturnValue({ single: mockSingle })
    mockSingle.mockResolvedValue({ data: { role: 'admin' } })
    mockRpc.mockResolvedValue({ error: { message: 'DB error' } })
    const result = await toggleArena(false)
    expect(result).toEqual({ success: false, error: 'DB error' })
  })
})
