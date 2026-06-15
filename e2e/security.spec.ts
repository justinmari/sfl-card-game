import { test, expect } from '@playwright/test'
import { login, TEST_PLAYER, TEST_ADMIN, cleanupArena } from './helpers'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const serviceHeaders = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function getUser(email: string) {
  const res = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers: serviceHeaders })
  const data = await res.json()
  return data.users?.find((u: any) => u.email === email)
}

async function loginAsUser(email: string, password: string) {
  const res = await fetch(`${LOCAL_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  return data.access_token as string
}

function userHeaders(token: string) {
  return {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function resetPlayer() {
  const player = await getUser('player@test.com')
  if (player) {
    await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${player.id}`, {
      method: 'PATCH',
      headers: { ...serviceHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ gruten: 5000, last_pack_purchase: null }),
    })
  }
  return player
}

// ============================================================
// 1. Pack purchase rate limiting
// ============================================================
test.describe('Security: Pack Purchase Rate Limiting', () => {
  test.beforeEach(async () => {
    await resetPlayer()
  })

  test('first purchase succeeds', async () => {
    const token = await loginAsUser('player@test.com', 'password123')
    const res = await fetch(`${LOCAL_URL}/rest/v1/rpc/buy_pack`, {
      method: 'POST',
      headers: userHeaders(token),
      body: JSON.stringify({ p_pack_id: 'eeeeeeee-0001-0000-0000-000000000000', p_quantity: 1 }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.cards).toBeDefined()
    expect(data.cards.length).toBe(3)
  })

  test('rapid second purchase is blocked by rate limit', async () => {
    const token = await loginAsUser('player@test.com', 'password123')
    const hdrs = userHeaders(token)
    const body = JSON.stringify({ p_pack_id: 'eeeeeeee-0001-0000-0000-000000000000', p_quantity: 1 })

    const res1 = await fetch(`${LOCAL_URL}/rest/v1/rpc/buy_pack`, { method: 'POST', headers: hdrs, body })
    expect(res1.status).toBe(200)

    const res2 = await fetch(`${LOCAL_URL}/rest/v1/rpc/buy_pack`, { method: 'POST', headers: hdrs, body })
    expect(res2.status).toBe(400)
    const err = await res2.json()
    expect(err.message).toContain('Please wait before purchasing again')
  })

  test('purchase succeeds after cooldown expires', async () => {
    const token = await loginAsUser('player@test.com', 'password123')
    const hdrs = userHeaders(token)
    const body = JSON.stringify({ p_pack_id: 'eeeeeeee-0001-0000-0000-000000000000', p_quantity: 1 })

    const res1 = await fetch(`${LOCAL_URL}/rest/v1/rpc/buy_pack`, { method: 'POST', headers: hdrs, body })
    expect(res1.status).toBe(200)

    // Wait for cooldown to expire
    await new Promise((r) => setTimeout(r, 2100))

    const res2 = await fetch(`${LOCAL_URL}/rest/v1/rpc/buy_pack`, { method: 'POST', headers: hdrs, body })
    expect(res2.status).toBe(200)
  })
})

// ============================================================
// 2. Arena lobby RLS - only host can update/delete
// ============================================================
test.describe('Security: Arena Lobby RLS', () => {
  test.beforeAll(async () => {
    await cleanupArena()
  })

  test.afterAll(async () => {
    await cleanupArena()
  })

  test('non-host cannot delete another players lobby', async () => {
    const admin = await getUser('admin@test.com')
    const player = await getUser('player@test.com')
    const adminToken = await loginAsUser('admin@test.com', 'password123')
    const playerToken = await loginAsUser('player@test.com', 'password123')

    // Admin creates a lobby
    const createRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies`, {
      method: 'POST',
      headers: { ...userHeaders(adminToken), 'Prefer': 'return=representation' },
      body: JSON.stringify({ host_id: admin.id, name: 'Admin Lobby' }),
    })
    expect(createRes.status).toBe(201)
    const [lobby] = await createRes.json()

    // Player tries to delete admin's lobby — should fail silently (RLS filters it out)
    const deleteRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies?id=eq.${lobby.id}`, {
      method: 'DELETE',
      headers: userHeaders(playerToken),
    })
    // RLS won't match the row, so the DELETE succeeds with 0 rows affected
    expect(deleteRes.status).toBe(204)

    // Verify lobby still exists
    const checkRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies?id=eq.${lobby.id}`, {
      method: 'GET',
      headers: serviceHeaders,
    })
    const remaining = await checkRes.json()
    expect(remaining.length).toBe(1)
    expect(remaining[0].name).toBe('Admin Lobby')
  })

  test('non-host cannot update another players lobby', async () => {
    const admin = await getUser('admin@test.com')
    const playerToken = await loginAsUser('player@test.com', 'password123')

    // Find the lobby created by the previous test (or create one)
    let lobbyId: string
    const existing = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies?host_id=eq.${admin.id}&select=id`, {
      method: 'GET',
      headers: serviceHeaders,
    })
    const existingData = await existing.json()
    if (existingData.length > 0) {
      lobbyId = existingData[0].id
    } else {
      const adminToken = await loginAsUser('admin@test.com', 'password123')
      const createRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies`, {
        method: 'POST',
        headers: { ...userHeaders(adminToken), 'Prefer': 'return=representation' },
        body: JSON.stringify({ host_id: admin.id, name: 'Admin Lobby 2' }),
      })
      const [lobby] = await createRes.json()
      lobbyId = lobby.id
    }

    // Player tries to update admin's lobby name — RLS should block
    await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies?id=eq.${lobbyId}`, {
      method: 'PATCH',
      headers: { ...userHeaders(playerToken), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ name: 'Hacked Lobby' }),
    })

    // Verify lobby name unchanged
    const checkRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies?id=eq.${lobbyId}`, {
      method: 'GET',
      headers: serviceHeaders,
    })
    const data = await checkRes.json()
    expect(data[0].name).not.toBe('Hacked Lobby')
  })

  test('host can delete their own lobby', async () => {
    const playerToken = await loginAsUser('player@test.com', 'password123')
    const player = await getUser('player@test.com')

    // Player creates a lobby
    const createRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies`, {
      method: 'POST',
      headers: { ...userHeaders(playerToken), 'Prefer': 'return=representation' },
      body: JSON.stringify({ host_id: player.id, name: 'Player Lobby' }),
    })
    expect(createRes.status).toBe(201)
    const [lobby] = await createRes.json()

    // Player deletes their own lobby — should succeed
    const deleteRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies?id=eq.${lobby.id}`, {
      method: 'DELETE',
      headers: userHeaders(playerToken),
    })
    expect(deleteRes.status).toBe(204)

    // Verify lobby is gone
    const checkRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies?id=eq.${lobby.id}`, {
      method: 'GET',
      headers: serviceHeaders,
    })
    const remaining = await checkRes.json()
    expect(remaining.length).toBe(0)
  })
})

// ============================================================
// 3. Pack price floor constraint
// ============================================================
test.describe('Security: Pack Price Constraint', () => {
  test('cannot create pack with negative price', async () => {
    const res = await fetch(`${LOCAL_URL}/rest/v1/packs`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ name: 'Evil Pack', price: -100, cards_per_pack: 3 }),
    })
    expect(res.status).toBe(400)
    const err = await res.json()
    expect(err.message).toContain('packs_price_check')
  })

  test('can create pack with zero price', async () => {
    const res = await fetch(`${LOCAL_URL}/rest/v1/packs`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Prefer': 'return=representation' },
      body: JSON.stringify({ name: 'Free Pack', price: 0, cards_per_pack: 3 }),
    })
    expect(res.status).toBe(201)
    const [pack] = await res.json()
    expect(pack.price).toBe(0)

    // Cleanup
    await fetch(`${LOCAL_URL}/rest/v1/packs?id=eq.${pack.id}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    })
  })

  test('can create pack with positive price', async () => {
    const res = await fetch(`${LOCAL_URL}/rest/v1/packs`, {
      method: 'POST',
      headers: { ...serviceHeaders, 'Prefer': 'return=representation' },
      body: JSON.stringify({ name: 'Normal Pack', price: 200, cards_per_pack: 3 }),
    })
    expect(res.status).toBe(201)
    const [pack] = await res.json()
    expect(pack.price).toBe(200)

    // Cleanup
    await fetch(`${LOCAL_URL}/rest/v1/packs?id=eq.${pack.id}`, {
      method: 'DELETE',
      headers: serviceHeaders,
    })
  })
})

// ============================================================
// 4. Empty lobby cleanup RPC
// ============================================================
test.describe('Security: Empty Lobby Cleanup', () => {
  test.afterAll(async () => {
    await cleanupArena()
  })

  test('rpc_cleanup_empty_lobbies deletes lobbies with no players', async () => {
    const adminToken = await loginAsUser('admin@test.com', 'password123')
    const admin = await getUser('admin@test.com')

    // Create a lobby directly (no players join)
    const createRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies`, {
      method: 'POST',
      headers: { ...userHeaders(adminToken), 'Prefer': 'return=representation' },
      body: JSON.stringify({ host_id: admin.id, name: 'Empty Lobby' }),
    })
    const [lobby] = await createRes.json()

    // Call cleanup RPC as regular player (non-host)
    const playerToken = await loginAsUser('player@test.com', 'password123')
    const rpcRes = await fetch(`${LOCAL_URL}/rest/v1/rpc/rpc_cleanup_empty_lobbies`, {
      method: 'POST',
      headers: userHeaders(playerToken),
      body: JSON.stringify({ p_lobby_ids: [lobby.id] }),
    })
    expect(rpcRes.status).toBe(204)

    // Verify lobby was deleted
    const checkRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies?id=eq.${lobby.id}`, {
      method: 'GET',
      headers: serviceHeaders,
    })
    const remaining = await checkRes.json()
    expect(remaining.length).toBe(0)
  })

  test('rpc_cleanup_empty_lobbies does NOT delete lobbies with players', async () => {
    const adminToken = await loginAsUser('admin@test.com', 'password123')
    const admin = await getUser('admin@test.com')

    // Create a lobby
    const createRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies`, {
      method: 'POST',
      headers: { ...userHeaders(adminToken), 'Prefer': 'return=representation' },
      body: JSON.stringify({ host_id: admin.id, name: 'Occupied Lobby' }),
    })
    const [lobby] = await createRes.json()

    // Add a player to it
    await fetch(`${LOCAL_URL}/rest/v1/arena_lobby_players`, {
      method: 'POST',
      headers: { ...userHeaders(adminToken), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ lobby_id: lobby.id, user_id: admin.id, user_name: 'Admin' }),
    })

    // Try to clean up — should NOT delete it
    const playerToken = await loginAsUser('player@test.com', 'password123')
    await fetch(`${LOCAL_URL}/rest/v1/rpc/rpc_cleanup_empty_lobbies`, {
      method: 'POST',
      headers: userHeaders(playerToken),
      body: JSON.stringify({ p_lobby_ids: [lobby.id] }),
    })

    // Verify lobby still exists
    const checkRes = await fetch(`${LOCAL_URL}/rest/v1/arena_lobbies?id=eq.${lobby.id}`, {
      method: 'GET',
      headers: serviceHeaders,
    })
    const remaining = await checkRes.json()
    expect(remaining.length).toBe(1)
    expect(remaining[0].name).toBe('Occupied Lobby')
  })
})

// ============================================================
// 5. Players cannot give themselves gruten or cards
// ============================================================
test.describe('Security: Players Cannot Cheat Currency/Cards', () => {
  test('player cannot update their own gruten directly', async () => {
    const player = await getUser('player@test.com')
    const playerToken = await loginAsUser('player@test.com', 'password123')

    await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${player.id}`, {
      method: 'PATCH',
      headers: { ...userHeaders(playerToken), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ gruten: 999999 }),
    })

    // Check actual value via service role
    const checkRes = await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${player.id}&select=gruten`, {
      method: 'GET',
      headers: serviceHeaders,
    })
    const [profile] = await checkRes.json()
    expect(profile.gruten).not.toBe(999999)
  })

  test('player cannot insert cards directly', async () => {
    const player = await getUser('player@test.com')
    const playerToken = await loginAsUser('player@test.com', 'password123')

    const res = await fetch(`${LOCAL_URL}/rest/v1/user_cards`, {
      method: 'POST',
      headers: { ...userHeaders(playerToken), 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        user_id: player.id,
        card_id: 'dddddddd-0009-0000-0000-000000000000',
        count: 100,
      }),
    })
    // Should be forbidden by RLS
    expect(res.status).toBe(403)
  })

  test('player cannot read other players cards', async () => {
    const admin = await getUser('admin@test.com')
    const playerToken = await loginAsUser('player@test.com', 'password123')

    const res = await fetch(`${LOCAL_URL}/rest/v1/user_cards?user_id=eq.${admin.id}`, {
      method: 'GET',
      headers: userHeaders(playerToken),
    })
    const data = await res.json()
    expect(data.length).toBe(0)
  })

  test('player cannot call admin RPCs', async () => {
    const playerToken = await loginAsUser('player@test.com', 'password123')
    const player = await getUser('player@test.com')

    const res = await fetch(`${LOCAL_URL}/rest/v1/rpc/admin_set_gruten`, {
      method: 'POST',
      headers: userHeaders(playerToken),
      body: JSON.stringify({ p_user_id: player.id, p_gruten: 999999 }),
    })
    expect(res.status).toBe(400)
    const err = await res.json()
    expect(err.message).toContain('Not authorized')
  })
})
