import { describe, it, expect, beforeEach, afterAll } from 'vitest'

// Integration test for rpc_cleanup_stale_lobbies (auto-close, replaces the old
// manual per-lobby "Close" button). Runs against local Supabase.
const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

const HOST = '000000ff-0000-0000-0000-0000000000ff'
const PREFIX = 'STALETESTLOBBY-'

const rest = (path: string, init?: RequestInit) =>
  fetch(`${LOCAL_URL}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init?.headers || {}) } })

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString()

async function insertLobby(name: string, createdAt: string, status = 'waiting'): Promise<string> {
  const res = await rest('arena_lobbies', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ host_id: HOST, name: PREFIX + name, status, created_at: createdAt }),
  })
  const [row] = await res.json()
  return row.id
}

async function insertSession(lobbyId: string, createdAt: string): Promise<string> {
  const res = await rest('arena_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ lobby_id: lobbyId, arena_lobby_id: lobbyId, seed: 1, players: [], hp: {}, created_at: createdAt }),
  })
  const [row] = await res.json()
  return row.id
}

async function insertReady(sessionId: string, createdAt: string) {
  await rest('arena_ready', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, user_id: HOST, round_num: 1, is_ready: true, created_at: createdAt }),
  })
}

async function lobbyExists(id: string): Promise<boolean> {
  const res = await rest(`arena_lobbies?id=eq.${id}&select=id`)
  return (await res.json()).length > 0
}

async function runCleanup(): Promise<number> {
  const res = await fetch(`${LOCAL_URL}/rest/v1/rpc/rpc_cleanup_stale_lobbies`, { method: 'POST', headers, body: '{}' })
  return res.json()
}

const cleanup = () => rest(`arena_lobbies?name=like.${PREFIX}*`, { method: 'DELETE' })

describe('rpc_cleanup_stale_lobbies', () => {
  beforeEach(cleanup)
  afterAll(cleanup)

  it('closes a stale lobby (1hr+ old, no activity)', async () => {
    const id = await insertLobby('stale', hoursAgo(2))
    await runCleanup()
    expect(await lobbyExists(id)).toBe(false)
  })

  it('keeps a fresh lobby', async () => {
    const id = await insertLobby('fresh', hoursAgo(0))
    await runCleanup()
    expect(await lobbyExists(id)).toBe(true)
  })

  it('keeps an old lobby that has recent ready activity', async () => {
    const id = await insertLobby('recently-active', hoursAgo(2))
    const session = await insertSession(id, hoursAgo(2))
    await insertReady(session, hoursAgo(0)) // someone readied up just now
    await runCleanup()
    expect(await lobbyExists(id)).toBe(true)
  })

  it('closes an old lobby whose activity is also old', async () => {
    const id = await insertLobby('long-dead', hoursAgo(3))
    const session = await insertSession(id, hoursAgo(3))
    await insertReady(session, hoursAgo(3))
    await runCleanup()
    expect(await lobbyExists(id)).toBe(false)
  })

  it('returns the number of lobbies it closed', async () => {
    await insertLobby('a', hoursAgo(2))
    await insertLobby('b', hoursAgo(2))
    await insertLobby('c', hoursAgo(0)) // fresh — not counted
    const closed = await runCleanup()
    expect(closed).toBeGreaterThanOrEqual(2)
  })
})
