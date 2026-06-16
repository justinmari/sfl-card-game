import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const serviceHeaders = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
const authedHeaders = (token: string) => ({ apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

async function getOrCreateUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${LOCAL_URL}/auth/v1/admin/users`, { method: 'POST', headers: serviceHeaders, body: JSON.stringify({ email, password, email_confirm: true }) })
  const data = await res.json()
  if (data.id) return data.id
  const list = await (await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=100`, { headers: serviceHeaders })).json()
  const u = list.users?.find((x: { email: string }) => x.email === email)
  if (u?.id) return u.id
  throw new Error(`get/create user failed: ${email}`)
}

async function upsertProfile(id: string, name: string, role: string, gruten: number) {
  await fetch(`${LOCAL_URL}/rest/v1/profiles`, { method: 'POST', headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id, full_name: name, role, gruten }) })
}

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${LOCAL_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const data = await res.json()
  if (!data.access_token) throw new Error(`sign in failed: ${email}`)
  return data.access_token
}

async function rpc(token: string, fn: string, body: object) {
  const res = await fetch(`${LOCAL_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: authedHeaders(token), body: JSON.stringify(body) })
  return { status: res.status, data: await res.json().catch(() => null) }
}

async function getGruten(id: string): Promise<number> {
  const d = await (await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${id}&select=gruten`, { headers: serviceHeaders })).json()
  return d[0].gruten
}
async function unopenedCount(id: string): Promise<number> {
  const d = await (await fetch(`${LOCAL_URL}/rest/v1/gruten_packages?user_id=eq.${id}&opened_at=is.null&select=id`, { headers: serviceHeaders })).json()
  return d.length
}
async function lastCareTxn(id: string) {
  const d = await (await fetch(`${LOCAL_URL}/rest/v1/gruten_transactions?user_id=eq.${id}&type=eq.care_package&select=amount,balance_after&order=created_at.desc&limit=1`, { headers: serviceHeaders })).json()
  return d[0]
}

describe('Gruten care packages (integration)', () => {
  let adminId: string, playerId: string, adminToken: string, playerToken: string

  beforeAll(async () => {
    adminId = await getOrCreateUser('cp-admin@test.com', 'password123')
    playerId = await getOrCreateUser('cp-player@test.com', 'password123')
    await upsertProfile(adminId, 'CP Admin', 'admin', 10000)
    await upsertProfile(playerId, 'CP Player', 'user', 1000)
    adminToken = await signIn('cp-admin@test.com', 'password123')
    playerToken = await signIn('cp-player@test.com', 'password123')
  })

  beforeEach(async () => {
    await fetch(`${LOCAL_URL}/rest/v1/gruten_packages?id=not.is.null`, { method: 'DELETE', headers: serviceHeaders })
    await upsertProfile(playerId, 'CP Player', 'user', 1000)
  })

  it('admin sends a package to a user; the user opens it and gains gruten + a logged transaction', async () => {
    const send = await rpc(adminToken, 'admin_send_care_package', { p_user_id: playerId, p_amount: 1000 })
    expect(send.status).toBe(200)
    expect(send.data.sent).toBe(1)
    expect(await unopenedCount(playerId)).toBe(1)

    const open = await rpc(playerToken, 'open_gruten_packages', {})
    expect(open.status).toBe(200)
    expect(open.data.opened).toBe(1)
    expect(open.data.amount).toBe(1000)
    expect(await getGruten(playerId)).toBe(2000)
    expect(await unopenedCount(playerId)).toBe(0)
    expect(await lastCareTxn(playerId)).toMatchObject({ amount: 1000, balance_after: 2000 })
  })

  it('opening collects all pending packages at once', async () => {
    await rpc(adminToken, 'admin_send_care_package', { p_user_id: playerId, p_amount: 500 })
    await rpc(adminToken, 'admin_send_care_package', { p_user_id: playerId, p_amount: 2000 })
    const open = await rpc(playerToken, 'open_gruten_packages', {})
    expect(open.data.opened).toBe(2)
    expect(open.data.amount).toBe(2500)
    expect(await getGruten(playerId)).toBe(3500)
  })

  it('send-to-all (null user) creates a package for every non-admin player', async () => {
    const send = await rpc(adminToken, 'admin_send_care_package', { p_user_id: null, p_amount: 500 })
    expect(send.data.sent).toBeGreaterThanOrEqual(1)
    expect(await unopenedCount(playerId)).toBe(1)
    // the admin should NOT receive one
    expect(await unopenedCount(adminId)).toBe(0)
  })

  it('non-admins cannot send care packages', async () => {
    const send = await rpc(playerToken, 'admin_send_care_package', { p_user_id: playerId, p_amount: 500 })
    expect(send.status).toBeGreaterThanOrEqual(400)
  })

  it('opening with no pending packages errors', async () => {
    const open = await rpc(playerToken, 'open_gruten_packages', {})
    expect(open.status).toBeGreaterThanOrEqual(400)
  })
})
