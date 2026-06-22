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

async function rewardTxnCount(id: string): Promise<number> {
  const d = await (await fetch(`${LOCAL_URL}/rest/v1/gruten_transactions?user_id=eq.${id}&type=eq.suggestion_reward&select=id`, { headers: serviceHeaders })).json()
  return d.length
}

async function getSuggestion(id: string): Promise<{ reward_paid: boolean; reward_seen: boolean }> {
  const d = await (await fetch(`${LOCAL_URL}/rest/v1/card_suggestions?id=eq.${id}&select=reward_paid,reward_seen`, { headers: serviceHeaders })).json()
  return d[0]
}

// Seed a pending suggestion via the service role and return its id.
async function seedSuggestion(userId: string, title: string): Promise<string> {
  const res = await fetch(`${LOCAL_URL}/rest/v1/card_suggestions`, {
    method: 'POST',
    headers: { ...serviceHeaders, Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: userId, title, status: 'pending', rarity: 'common' }),
  })
  const d = await res.json()
  return d[0].id
}

describe('Card suggestion reward (integration)', () => {
  let adminId: string, playerId: string, unlimitedId: string
  let adminToken: string, playerToken: string

  beforeAll(async () => {
    adminId = await getOrCreateUser('sr-admin@test.com', 'password123')
    playerId = await getOrCreateUser('sr-player@test.com', 'password123')
    unlimitedId = await getOrCreateUser('sr-unlimited@test.com', 'password123')
    await upsertProfile(adminId, 'SR Admin', 'admin', 10000)
    await upsertProfile(unlimitedId, 'SR Unlimited', 'user', -1)
    adminToken = await signIn('sr-admin@test.com', 'password123')
    playerToken = await signIn('sr-player@test.com', 'password123')
  })

  beforeEach(async () => {
    // Clear this user's reward history + suggestions so each test starts clean.
    await fetch(`${LOCAL_URL}/rest/v1/gruten_transactions?user_id=eq.${playerId}&type=eq.suggestion_reward`, { method: 'DELETE', headers: serviceHeaders })
    await fetch(`${LOCAL_URL}/rest/v1/card_suggestions?user_id=eq.${playerId}`, { method: 'DELETE', headers: serviceHeaders })
    await fetch(`${LOCAL_URL}/rest/v1/card_suggestions?user_id=eq.${unlimitedId}`, { method: 'DELETE', headers: serviceHeaders })
    await upsertProfile(playerId, 'SR Player', 'user', 1000)
  })

  it('adding a suggestion pays the suggester a flat 500G and logs it', async () => {
    const id = await seedSuggestion(playerId, 'Reward me')
    const res = await rpc(adminToken, 'admin_review_suggestion', { p_id: id, p_status: 'added' })
    expect(res.status).toBeLessThan(400) // VOID RPC → 204 No Content
    expect(await getGruten(playerId)).toBe(1500)
    expect(await rewardTxnCount(playerId)).toBe(1)
  })

  it('is idempotent: re-reviewing an added suggestion does not pay again', async () => {
    const id = await seedSuggestion(playerId, 'Pay once only')
    await rpc(adminToken, 'admin_review_suggestion', { p_id: id, p_status: 'added' })
    await rpc(adminToken, 'admin_review_suggestion', { p_id: id, p_status: 'added' })
    expect(await getGruten(playerId)).toBe(1500)
    expect(await rewardTxnCount(playerId)).toBe(1)
  })

  it('archiving a suggestion pays nothing', async () => {
    const id = await seedSuggestion(playerId, 'Just archive me')
    await rpc(adminToken, 'admin_review_suggestion', { p_id: id, p_status: 'archived' })
    expect(await getGruten(playerId)).toBe(1000)
    expect(await rewardTxnCount(playerId)).toBe(0)
  })

  it('unlimited accounts (gruten = -1) keep their balance and get no transaction', async () => {
    const id = await seedSuggestion(unlimitedId, 'Unlimited suggester')
    await rpc(adminToken, 'admin_review_suggestion', { p_id: id, p_status: 'added' })
    expect(await getGruten(unlimitedId)).toBe(-1)
    expect(await rewardTxnCount(unlimitedId)).toBe(0)
  })

  it('non-admins cannot review suggestions (and so cannot trigger rewards)', async () => {
    const id = await seedSuggestion(playerId, 'No self-review')
    const res = await rpc(playerToken, 'admin_review_suggestion', { p_id: id, p_status: 'added' })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(await getGruten(playerId)).toBe(1000)
  })

  it('a freshly added reward starts unseen, then the owner can mark it seen', async () => {
    const id = await seedSuggestion(playerId, 'Notify me once')
    await rpc(adminToken, 'admin_review_suggestion', { p_id: id, p_status: 'added' })
    // Pending the toast: paid but not yet seen.
    expect(await getSuggestion(id)).toMatchObject({ reward_paid: true, reward_seen: false })

    const res = await rpc(playerToken, 'mark_suggestion_rewards_seen', {})
    expect(res.status).toBeLessThan(400)
    expect(await getSuggestion(id)).toMatchObject({ reward_paid: true, reward_seen: true })
  })

  it("marking seen only affects the caller's own rewards", async () => {
    const id = await seedSuggestion(playerId, 'Belongs to player')
    await rpc(adminToken, 'admin_review_suggestion', { p_id: id, p_status: 'added' })
    // The admin marking their own rewards seen must not touch the player's.
    await rpc(adminToken, 'mark_suggestion_rewards_seen', {})
    expect(await getSuggestion(id)).toMatchObject({ reward_seen: false })
  })
})
