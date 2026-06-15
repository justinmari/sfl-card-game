import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const serviceHeaders = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function getOrCreateUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${LOCAL_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const data = await res.json()
  if (data.id) return data.id
  const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, { headers: serviceHeaders })
  const listData = await listRes.json()
  const user = listData.users?.find((u: any) => u.email === email)
  if (user?.id) return user.id
  throw new Error(`Failed to get or create user ${email}`)
}

async function upsertProfile(userId: string, name: string, role: string, gruten: number) {
  await fetch(`${LOCAL_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...serviceHeaders, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: userId, full_name: name, role, gruten }),
  })
}

async function signIn(email: string, password: string) {
  const res = await fetch(`${LOCAL_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Sign in failed for ${email}: ${JSON.stringify(data)}`)
  return data.access_token as string
}

function authedHeaders(token: string) {
  return {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function getTransactions(userId: string) {
  const res = await fetch(
    `${LOCAL_URL}/rest/v1/gruten_transactions?user_id=eq.${userId}&order=created_at.asc`,
    { headers: serviceHeaders },
  )
  return res.json()
}

async function clearTransactions(userId: string) {
  await fetch(`${LOCAL_URL}/rest/v1/gruten_transactions?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers: serviceHeaders,
  })
}

async function setGruten(userId: string, amount: number) {
  await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...serviceHeaders, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ gruten: amount, last_daily_claim: null, last_pack_purchase: null }),
  })
}

describe('gruten_transactions (integration)', () => {
  let playerId: string
  let playerToken: string
  let adminToken: string

  beforeAll(async () => {
    const adminId = await getOrCreateUser('admin@test.com', 'password123')
    playerId = await getOrCreateUser('player@test.com', 'password123')
    await upsertProfile(adminId, 'Test Admin', 'admin', 10000)
    await upsertProfile(playerId, 'Test Player', 'user', 5000)
    playerToken = await signIn('player@test.com', 'password123')
    adminToken = await signIn('admin@test.com', 'password123')
  })

  beforeEach(async () => {
    await clearTransactions(playerId)
    await setGruten(playerId, 5000)
  })

  describe('buy_pack', () => {
    it('logs a pack_purchase transaction', async () => {
      const packRes = await fetch(`${LOCAL_URL}/rest/v1/packs?is_active=eq.true&limit=1`, { headers: serviceHeaders })
      const packs = await packRes.json()
      const pack = packs[0]

      const res = await fetch(`${LOCAL_URL}/rest/v1/rpc/buy_pack`, {
        method: 'POST',
        headers: authedHeaders(playerToken),
        body: JSON.stringify({ p_pack_id: pack.id, p_quantity: 1 }),
      })
      expect(res.ok).toBe(true)

      const txns = await getTransactions(playerId)
      expect(txns).toHaveLength(1)
      expect(txns[0].type).toBe('pack_purchase')
      expect(txns[0].amount).toBe(-100)
      expect(txns[0].balance_after).toBe(4900)
      expect(txns[0].metadata.pack_id).toBe(pack.id)
      expect(txns[0].metadata.pack_name).toBe(pack.name)
      expect(txns[0].metadata.quantity).toBe(1)
    })

    it('logs correct amount for multi-pack purchase', async () => {
      const packRes = await fetch(`${LOCAL_URL}/rest/v1/packs?is_active=eq.true&limit=1`, { headers: serviceHeaders })
      const packs = await packRes.json()
      const pack = packs[0]

      const res = await fetch(`${LOCAL_URL}/rest/v1/rpc/buy_pack`, {
        method: 'POST',
        headers: authedHeaders(playerToken),
        body: JSON.stringify({ p_pack_id: pack.id, p_quantity: 5 }),
      })
      expect(res.ok).toBe(true)

      const txns = await getTransactions(playerId)
      expect(txns).toHaveLength(1)
      expect(txns[0].amount).toBe(-500)
      expect(txns[0].balance_after).toBe(4500)
      expect(txns[0].metadata.quantity).toBe(5)
    })

    it('logs -1 balance for unlimited gruten users', async () => {
      await setGruten(playerId, -1)
      const packRes = await fetch(`${LOCAL_URL}/rest/v1/packs?is_active=eq.true&limit=1`, { headers: serviceHeaders })
      const packs = await packRes.json()

      await fetch(`${LOCAL_URL}/rest/v1/rpc/buy_pack`, {
        method: 'POST',
        headers: authedHeaders(playerToken),
        body: JSON.stringify({ p_pack_id: packs[0].id, p_quantity: 1 }),
      })

      const txns = await getTransactions(playerId)
      expect(txns).toHaveLength(1)
      expect(txns[0].amount).toBe(-100)
      expect(txns[0].balance_after).toBe(-1)
    })
  })

  describe('claim_daily_gruten', () => {
    it('logs a daily_claim transaction', async () => {
      const res = await fetch(`${LOCAL_URL}/rest/v1/rpc/claim_daily_gruten`, {
        method: 'POST',
        headers: authedHeaders(playerToken),
        body: '{}',
      })
      expect(res.ok).toBe(true)

      const txns = await getTransactions(playerId)
      expect(txns).toHaveLength(1)
      expect(txns[0].type).toBe('daily_claim')
      expect(txns[0].amount).toBe(500)
      expect(txns[0].balance_after).toBe(5500)
    })

    it('does not log when claim is rejected (already claimed)', async () => {
      await fetch(`${LOCAL_URL}/rest/v1/rpc/claim_daily_gruten`, {
        method: 'POST',
        headers: authedHeaders(playerToken),
        body: '{}',
      })

      // Second claim should fail
      const res2 = await fetch(`${LOCAL_URL}/rest/v1/rpc/claim_daily_gruten`, {
        method: 'POST',
        headers: authedHeaders(playerToken),
        body: '{}',
      })
      expect(res2.ok).toBe(false)

      const txns = await getTransactions(playerId)
      expect(txns).toHaveLength(1)
    })
  })

  describe('admin_set_gruten', () => {
    it('logs an admin_grant transaction with correct diff', async () => {
      const res = await fetch(`${LOCAL_URL}/rest/v1/rpc/admin_set_gruten`, {
        method: 'POST',
        headers: authedHeaders(adminToken),
        body: JSON.stringify({ p_user_id: playerId, p_gruten: 8000 }),
      })
      expect(res.ok).toBe(true)

      const txns = await getTransactions(playerId)
      expect(txns).toHaveLength(1)
      expect(txns[0].type).toBe('admin_grant')
      expect(txns[0].amount).toBe(3000)
      expect(txns[0].balance_after).toBe(8000)
      expect(txns[0].metadata.admin_id).toBeTruthy()
      expect(txns[0].metadata.admin_name).toBe('Test Admin')
    })

    it('logs negative diff when admin reduces gruten', async () => {
      const res = await fetch(`${LOCAL_URL}/rest/v1/rpc/admin_set_gruten`, {
        method: 'POST',
        headers: authedHeaders(adminToken),
        body: JSON.stringify({ p_user_id: playerId, p_gruten: 1000 }),
      })
      expect(res.ok).toBe(true)

      const txns = await getTransactions(playerId)
      expect(txns).toHaveLength(1)
      expect(txns[0].amount).toBe(-4000)
      expect(txns[0].balance_after).toBe(1000)
    })

    it('logs zero diff when set to same value', async () => {
      await fetch(`${LOCAL_URL}/rest/v1/rpc/admin_set_gruten`, {
        method: 'POST',
        headers: authedHeaders(adminToken),
        body: JSON.stringify({ p_user_id: playerId, p_gruten: 5000 }),
      })

      const txns = await getTransactions(playerId)
      expect(txns).toHaveLength(1)
      expect(txns[0].amount).toBe(0)
      expect(txns[0].balance_after).toBe(5000)
    })
  })

  describe('RLS', () => {
    it('player can read own transactions', async () => {
      // Create a transaction first
      await fetch(`${LOCAL_URL}/rest/v1/rpc/claim_daily_gruten`, {
        method: 'POST',
        headers: authedHeaders(playerToken),
        body: '{}',
      })

      const res = await fetch(
        `${LOCAL_URL}/rest/v1/gruten_transactions?user_id=eq.${playerId}`,
        { headers: authedHeaders(playerToken) },
      )
      const txns = await res.json()
      expect(txns).toHaveLength(1)
      expect(txns[0].type).toBe('daily_claim')
    })

    it('player cannot insert transactions directly', async () => {
      const res = await fetch(`${LOCAL_URL}/rest/v1/gruten_transactions`, {
        method: 'POST',
        headers: authedHeaders(playerToken),
        body: JSON.stringify({
          user_id: playerId,
          type: 'daily_claim',
          amount: 999999,
          balance_after: 999999,
        }),
      })
      expect(res.ok).toBe(false)
    })

    it('admin can read all transactions', async () => {
      await fetch(`${LOCAL_URL}/rest/v1/rpc/claim_daily_gruten`, {
        method: 'POST',
        headers: authedHeaders(playerToken),
        body: '{}',
      })

      const res = await fetch(
        `${LOCAL_URL}/rest/v1/gruten_transactions?user_id=eq.${playerId}`,
        { headers: authedHeaders(adminToken) },
      )
      const txns = await res.json()
      expect(txns).toHaveLength(1)
    })
  })

  describe('transaction chain integrity', () => {
    it('multiple operations create a valid chain', async () => {
      // 1. Daily claim: 5000 + 500 = 5500
      await fetch(`${LOCAL_URL}/rest/v1/rpc/claim_daily_gruten`, {
        method: 'POST',
        headers: authedHeaders(playerToken),
        body: '{}',
      })

      // 2. Buy 1 pack: 5500 - 100 = 5400
      const packRes = await fetch(`${LOCAL_URL}/rest/v1/packs?is_active=eq.true&limit=1`, { headers: serviceHeaders })
      const packs = await packRes.json()
      // Wait for rate limit
      await new Promise(r => setTimeout(r, 2100))
      await fetch(`${LOCAL_URL}/rest/v1/rpc/buy_pack`, {
        method: 'POST',
        headers: authedHeaders(playerToken),
        body: JSON.stringify({ p_pack_id: packs[0].id, p_quantity: 1 }),
      })

      // 3. Admin grant to 10000: diff = +4600
      await fetch(`${LOCAL_URL}/rest/v1/rpc/admin_set_gruten`, {
        method: 'POST',
        headers: authedHeaders(adminToken),
        body: JSON.stringify({ p_user_id: playerId, p_gruten: 10000 }),
      })

      const txns = await getTransactions(playerId)
      expect(txns).toHaveLength(3)

      expect(txns[0].type).toBe('daily_claim')
      expect(txns[0].amount).toBe(500)
      expect(txns[0].balance_after).toBe(5500)

      expect(txns[1].type).toBe('pack_purchase')
      expect(txns[1].amount).toBe(-100)
      expect(txns[1].balance_after).toBe(5400)

      expect(txns[2].type).toBe('admin_grant')
      expect(txns[2].amount).toBe(4600)
      expect(txns[2].balance_after).toBe(10000)

      // Verify chain: each balance_after = previous balance_after + amount
      for (let i = 1; i < txns.length; i++) {
        expect(txns[i].balance_after).toBe(txns[i - 1].balance_after + txns[i].amount)
      }
    })
  })
})
