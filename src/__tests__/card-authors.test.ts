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

async function getSuggestion(id: string) {
  const d = await (await fetch(`${LOCAL_URL}/rest/v1/card_suggestions?id=eq.${id}&select=is_anonymous`, { headers: serviceHeaders })).json()
  return d[0]
}

describe('Card authors (integration)', () => {
  let playerId: string, adminId: string, playerToken: string, adminToken: string

  beforeAll(async () => {
    playerId = await getOrCreateUser('ca-player@test.com', 'password123')
    adminId = await getOrCreateUser('ca-admin@test.com', 'password123')
    await upsertProfile(playerId, 'CA Player', 'user', 1000)
    await upsertProfile(adminId, 'CA Admin', 'admin', 10000)
    playerToken = await signIn('ca-player@test.com', 'password123')
    adminToken = await signIn('ca-admin@test.com', 'password123')
  })

  beforeEach(async () => {
    await fetch(`${LOCAL_URL}/rest/v1/card_suggestions?user_id=eq.${playerId}`, { method: 'DELETE', headers: serviceHeaders })
  })

  it('submit_card_suggestion records the anonymity choice', async () => {
    const anon = await rpc(playerToken, 'submit_card_suggestion', { p_title: 'Secret card', p_is_anonymous: true })
    expect(anon.status).toBe(200)
    expect(await getSuggestion(anon.data)).toMatchObject({ is_anonymous: true })

    const credited = await rpc(playerToken, 'submit_card_suggestion', { p_title: 'Credited card' })
    expect(credited.status).toBe(200)
    expect(await getSuggestion(credited.data)).toMatchObject({ is_anonymous: false })
  })

  it('admin_get_suggestions exposes is_anonymous to admins', async () => {
    const created = await rpc(playerToken, 'submit_card_suggestion', { p_title: 'Anon for review', p_is_anonymous: true })
    const res = await rpc(adminToken, 'admin_get_suggestions', { p_status: 'pending' })
    expect(res.status).toBe(200)
    const row = (res.data as { id: string; is_anonymous: boolean }[]).find((r) => r.id === created.data)
    expect(row?.is_anonymous).toBe(true)
  })

  it('get_players returns author credit on top cards', async () => {
    // Make a card authored by the player, and pin it as their top card.
    const ins = await fetch(`${LOCAL_URL}/rest/v1/cards`, {
      method: 'POST', headers: { ...serviceHeaders, Prefer: 'return=representation' },
      body: JSON.stringify({ name: 'CA Authored', rarity: 'common', author_id: playerId, author_name: 'CA Player', author_anonymous: false }),
    })
    const cardId = (await ins.json())[0].id
    await upsertProfile(playerId, 'CA Player', 'user', 1000)
    await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${playerId}`, {
      method: 'PATCH', headers: serviceHeaders, body: JSON.stringify({ top_cards: [cardId] }),
    })

    const res = await rpc(adminToken, 'get_players', {})
    const me = (res.data as { id: string; top_cards: { id: string; author_name: string | null; author_anonymous: boolean }[] }[]).find((p) => p.id === playerId)
    const top = me?.top_cards.find((c) => c.id === cardId)
    expect(top).toMatchObject({ author_name: 'CA Player', author_anonymous: false })

    await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${playerId}`, { method: 'PATCH', headers: serviceHeaders, body: JSON.stringify({ top_cards: [] }) })
    await fetch(`${LOCAL_URL}/rest/v1/cards?id=eq.${cardId}`, { method: 'DELETE', headers: serviceHeaders })
  })
})
