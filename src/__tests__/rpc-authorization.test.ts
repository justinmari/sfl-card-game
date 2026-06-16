import { describe, it, expect, beforeAll } from 'vitest'
import {
  getOrCreateUser, upsertProfile, signIn, rpc, serviceDelete, serviceSelect,
} from './rpc-helpers'

// Verifies the authorization fixes: admin-only RPCs reject non-admins, the
// arena feature toggle is admin-gated, and arena session/round RPCs reject
// callers who are not participants/host of the session.

describe('admin RPC authorization', () => {
  let adminToken: string, playerToken: string, victimId: string

  beforeAll(async () => {
    const adminId = await getOrCreateUser('authz-admin@test.com', 'password123')
    const playerId = await getOrCreateUser('authz-player@test.com', 'password123')
    victimId = await getOrCreateUser('authz-victim@test.com', 'password123')
    await upsertProfile(adminId, { full_name: 'Authz Admin', role: 'admin', gruten: -1 })
    await upsertProfile(playerId, { full_name: 'Authz Player', role: 'user', gruten: 0 })
    await upsertProfile(victimId, { full_name: 'Authz Victim', role: 'user', hidden: false })
    adminToken = await signIn('authz-admin@test.com', 'password123')
    playerToken = await signIn('authz-player@test.com', 'password123')
  })

  it('admin_create_user rejects a non-admin caller', async () => {
    const res = await rpc(playerToken, 'admin_create_user', {
      p_email: 'should-not-exist@test.com', p_password: 'password123', p_full_name: 'Nope',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('admin_reset_password rejects a non-admin caller', async () => {
    const res = await rpc(playerToken, 'admin_reset_password', { p_user_id: victimId, p_password: 'hacked123' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('admin_toggle_hidden rejects a non-admin caller', async () => {
    const before = (await serviceSelect('profiles', `id=eq.${victimId}&select=hidden`))[0].hidden
    const res = await rpc(playerToken, 'admin_toggle_hidden', { p_user_id: victimId })
    expect(res.status).toBeGreaterThanOrEqual(400)
    const after = (await serviceSelect('profiles', `id=eq.${victimId}&select=hidden`))[0].hidden
    expect(after).toBe(before) // unchanged
  })

  it('admin can toggle hidden (control: the RPC works for an admin)', async () => {
    const before = (await serviceSelect('profiles', `id=eq.${victimId}&select=hidden`))[0].hidden
    const res = await rpc(adminToken, 'admin_toggle_hidden', { p_user_id: victimId })
    expect(res.status).toBeLessThan(300)
    const after = (await serviceSelect('profiles', `id=eq.${victimId}&select=hidden`))[0].hidden
    expect(after).toBe(!before)
  })
})

describe('arena feature-toggle authorization', () => {
  let adminToken: string, playerToken: string

  beforeAll(async () => {
    const adminId = await getOrCreateUser('arena-admin@test.com', 'password123')
    const playerId = await getOrCreateUser('arena-player@test.com', 'password123')
    await upsertProfile(adminId, { full_name: 'Arena Admin', role: 'admin', gruten: -1 })
    await upsertProfile(playerId, { full_name: 'Arena Player', role: 'user', gruten: 0 })
    adminToken = await signIn('arena-admin@test.com', 'password123')
    playerToken = await signIn('arena-player@test.com', 'password123')
  })

  it('a non-admin cannot enable or disable the arena', async () => {
    expect((await rpc(playerToken, 'rpc_admin_enable_arena', {})).status).toBeGreaterThanOrEqual(400)
    expect((await rpc(playerToken, 'rpc_admin_disable_arena', {})).status).toBeGreaterThanOrEqual(400)
  })

  it('an admin can toggle the arena', async () => {
    expect((await rpc(adminToken, 'rpc_admin_enable_arena', {})).status).toBeLessThan(300)
    expect((await rpc(adminToken, 'rpc_admin_disable_arena', {})).status).toBeLessThan(300)
    await rpc(adminToken, 'rpc_admin_enable_arena', {}) // leave enabled for e2e
  })
})

describe('arena session/round authorization', () => {
  const LOBBY = 'authz-arena-lobby'
  let victimToken: string, attackerToken: string
  let victimId: string, attackerId: string
  let sessionId: string

  beforeAll(async () => {
    victimId = await getOrCreateUser('arena-victim@test.com', 'password123')
    attackerId = await getOrCreateUser('arena-attacker@test.com', 'password123')
    await upsertProfile(victimId, { full_name: 'Arena Victim', role: 'user', gruten: 0 })
    await upsertProfile(attackerId, { full_name: 'Arena Attacker', role: 'user', gruten: 0 })
    victimToken = await signIn('arena-victim@test.com', 'password123')
    attackerToken = await signIn('arena-attacker@test.com', 'password123')

    // Clean any leftover session, then the victim creates one (they are a participant).
    await serviceDelete('arena_sessions', `lobby_id=eq.${LOBBY}`)
    const created = await rpc(victimToken, 'rpc_create_arena_session', {
      p_lobby_id: LOBBY,
      p_arena_lobby_id: null,
      p_players: [{ id: victimId, name: 'Victim', avatar_url: null, deck: [] }],
      p_hp: { [victimId]: 10 },
      p_connected_players: [victimId],
    })
    sessionId = (created.data as { id: string }).id
  })

  it('a participant can create their own session', () => {
    expect(sessionId).toBeTruthy()
  })

  it('rejects creating a session you are not a participant of', async () => {
    const res = await rpc(attackerToken, 'rpc_create_arena_session', {
      p_lobby_id: 'authz-arena-lobby-2',
      p_arena_lobby_id: null,
      p_players: [{ id: victimId, name: 'Victim', avatar_url: null, deck: [] }], // attacker not included
      p_hp: { [victimId]: 10 },
      p_connected_players: [victimId],
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('a non-participant cannot update the session (rig HP/status)', async () => {
    const res = await rpc(attackerToken, 'rpc_update_arena_session', {
      p_session_id: sessionId,
      p_hp: { [victimId]: 0 },
      p_status: 'done',
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    const s = (await serviceSelect('arena_sessions', `id=eq.${sessionId}&select=hp,status`))[0]
    expect(s.hp[victimId]).toBe(10) // unchanged
  })

  it('a non-participant cannot inject a round result', async () => {
    const res = await rpc(attackerToken, 'rpc_insert_arena_round', {
      p_session_id: sessionId, p_round_num: 0, p_result: { fake: true }, p_skills_used: [],
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    const rounds = await serviceSelect('arena_rounds', `session_id=eq.${sessionId}&select=round_num`)
    expect(rounds).toHaveLength(0)
  })

  it('a non-participant cannot delete an active session', async () => {
    const res = await rpc(attackerToken, 'rpc_delete_arena_session', { p_lobby_id: LOBBY })
    expect(res.status).toBeGreaterThanOrEqual(400)
    const s = await serviceSelect('arena_sessions', `lobby_id=eq.${LOBBY}&select=id`)
    expect(s).toHaveLength(1) // still there
  })

  it('the participant CAN update and insert (control)', async () => {
    const upd = await rpc(victimToken, 'rpc_update_arena_session', {
      p_session_id: sessionId, p_hp: { [victimId]: 7 },
    })
    expect(upd.status).toBeLessThan(300)
    const ins = await rpc(victimToken, 'rpc_insert_arena_round', {
      p_session_id: sessionId, p_round_num: 1, p_result: { real: true }, p_skills_used: [],
    })
    expect(ins.status).toBeLessThan(300)
  })
})
