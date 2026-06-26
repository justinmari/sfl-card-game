import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import {
  getOrCreateUser, upsertProfile, signIn, rpc,
  serviceSelect, serviceDelete, serviceInsert, serviceUpdate,
  authedHeaders, LOCAL_URL,
} from './rpc-helpers'

// Integration tests for the live trading-session RPCs against local Supabase.
// Two users drive the session like two clients: stage → lock → confirm → swap.

let A = '', B = '', C = ''
let aTok = '', bTok = '', cTok = ''
let cardX = '', cardY = ''

async function cardCount(userId: string, cardId: string, edition = 'regular'): Promise<number> {
  const rows = await serviceSelect('user_cards', `user_id=eq.${userId}&card_id=eq.${cardId}&edition=eq.${edition}&select=count`)
  return rows[0]?.count ?? 0
}
async function sessionStatus(id: string): Promise<string | null> {
  const rows = await serviceSelect('trade_sessions', `id=eq.${id}&select=status`)
  return rows[0]?.status ?? null
}
async function newSession(): Promise<string> {
  const r = await rpc(aTok, 'create_trade_session', { p_partner_id: B })
  return r.data as string
}

async function reset() {
  for (const u of [A, B, C]) {
    await serviceDelete('trade_sessions', `or=(initiator_id.eq.${u},partner_id.eq.${u})`)
    await serviceDelete('user_cards', `user_id=eq.${u}`)
  }
  await serviceInsert('user_cards', [
    { user_id: A, card_id: cardX, edition: 'regular', count: 3 },
    { user_id: A, card_id: cardX, edition: 'golden', count: 1 },
    { user_id: B, card_id: cardY, edition: 'regular', count: 2 },
  ])
  await upsertProfile(B, { full_name: 'Trade B', role: 'user', hidden: false })
  await upsertProfile(C, { full_name: 'Trade C', role: 'user', hidden: false })
}

beforeAll(async () => {
  A = await getOrCreateUser('ts-a@test.com', 'password123')
  B = await getOrCreateUser('ts-b@test.com', 'password123')
  C = await getOrCreateUser('ts-c@test.com', 'password123')
  await upsertProfile(A, { full_name: 'Trade A', role: 'user', hidden: false })
  await upsertProfile(B, { full_name: 'Trade B', role: 'user', hidden: false })
  await upsertProfile(C, { full_name: 'Trade C', role: 'user', hidden: false })
  aTok = await signIn('ts-a@test.com', 'password123')
  bTok = await signIn('ts-b@test.com', 'password123')
  cTok = await signIn('ts-c@test.com', 'password123')
  const cards = await serviceSelect('cards', 'select=id&order=name&limit=2')
  cardX = cards[0].id
  cardY = cards[1].id
})

beforeEach(reset)

const offerX = () => [{ card_id: cardX, edition: 'golden', quantity: 1 }]
const offerY = () => [{ card_id: cardY, edition: 'regular', quantity: 1 }]

describe('confirm_trade_session — atomic swap', () => {
  it('swaps staged cards on mutual confirm and conserves totals', async () => {
    const id = await newSession()
    await rpc(aTok, 'set_trade_stage', { p_session_id: id, p_cards: offerX() })
    await rpc(bTok, 'set_trade_stage', { p_session_id: id, p_cards: offerY() })
    await rpc(aTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(bTok, 'set_trade_lock', { p_session_id: id, p_locked: true })

    const first = await rpc(aTok, 'confirm_trade_session', { p_session_id: id })
    expect(first.data.completed).toBe(false)
    const second = await rpc(bTok, 'confirm_trade_session', { p_session_id: id })
    expect(second.data.completed).toBe(true)
    expect(await sessionStatus(id)).toBe('completed')

    expect(await cardCount(A, cardX, 'golden')).toBe(0)
    expect(await cardCount(A, cardX, 'regular')).toBe(3) // untouched
    expect(await cardCount(A, cardY, 'regular')).toBe(1)
    expect(await cardCount(B, cardX, 'golden')).toBe(1)
    expect(await cardCount(B, cardY, 'regular')).toBe(1)
  })

  it('cannot confirm before both have locked', async () => {
    const id = await newSession()
    await rpc(aTok, 'set_trade_stage', { p_session_id: id, p_cards: offerX() })
    await rpc(bTok, 'set_trade_stage', { p_session_id: id, p_cards: offerY() })
    await rpc(aTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    expect((await rpc(aTok, 'confirm_trade_session', { p_session_id: id })).status).toBeGreaterThanOrEqual(400)
  })

  it('a staged-card change resets both locks (no last-second swap)', async () => {
    const id = await newSession()
    await rpc(aTok, 'set_trade_stage', { p_session_id: id, p_cards: offerX() })
    await rpc(bTok, 'set_trade_stage', { p_session_id: id, p_cards: offerY() })
    await rpc(aTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(bTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    // A changes their offer → both locks drop.
    await rpc(aTok, 'set_trade_stage', { p_session_id: id, p_cards: [{ card_id: cardX, edition: 'regular', quantity: 1 }] })
    const s = await rpc(aTok, 'get_trade_session', { p_session_id: id })
    expect(s.data.initiator_locked).toBe(false)
    expect(s.data.partner_locked).toBe(false)
    expect((await rpc(bTok, 'confirm_trade_session', { p_session_id: id })).status).toBeGreaterThanOrEqual(400)
  })

  it('re-validates ownership at commit — a moved card aborts the swap cleanly', async () => {
    const id = await newSession()
    await rpc(aTok, 'set_trade_stage', { p_session_id: id, p_cards: offerX() })
    await rpc(bTok, 'set_trade_stage', { p_session_id: id, p_cards: offerY() })
    await rpc(aTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(bTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(aTok, 'confirm_trade_session', { p_session_id: id })
    // A's staged card vanishes before the final confirm.
    await serviceUpdate('user_cards', `user_id=eq.${A}&card_id=eq.${cardX}&edition=eq.golden`, { count: 0 })
    expect((await rpc(bTok, 'confirm_trade_session', { p_session_id: id })).status).toBeGreaterThanOrEqual(400)
    expect(await sessionStatus(id)).toBe('open')
    expect(await cardCount(B, cardY, 'regular')).toBe(2) // no partial swap
    expect(await cardCount(B, cardX, 'golden')).toBe(0)
  })

  it('unlocking clears BOTH players’ confirmations', async () => {
    const id = await newSession()
    await rpc(aTok, 'set_trade_stage', { p_session_id: id, p_cards: offerX() })
    await rpc(bTok, 'set_trade_stage', { p_session_id: id, p_cards: offerY() })
    await rpc(aTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(bTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(aTok, 'confirm_trade_session', { p_session_id: id }) // A has confirmed

    // B unlocks → A's confirmation is voided too; both must re-confirm.
    await rpc(bTok, 'set_trade_lock', { p_session_id: id, p_locked: false })
    const s = await rpc(aTok, 'get_trade_session', { p_session_id: id })
    expect(s.data.initiator_confirmed).toBe(false)
    expect(s.data.partner_confirmed).toBe(false)
    expect(s.data.partner_locked).toBe(false)
  })

  it('conserves totals when both players stage the same card', async () => {
    await serviceInsert('user_cards', [{ user_id: B, card_id: cardX, edition: 'regular', count: 1 }])
    const aBefore = await cardCount(A, cardX, 'regular')
    const bBefore = await cardCount(B, cardX, 'regular')
    const id = await newSession()
    const same = [{ card_id: cardX, edition: 'regular', quantity: 1 }]
    await rpc(aTok, 'set_trade_stage', { p_session_id: id, p_cards: same })
    await rpc(bTok, 'set_trade_stage', { p_session_id: id, p_cards: same })
    await rpc(aTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(bTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(aTok, 'confirm_trade_session', { p_session_id: id })
    await rpc(bTok, 'confirm_trade_session', { p_session_id: id })
    // Each gave 1 and received 1 → balances unchanged, total conserved.
    expect(await cardCount(A, cardX, 'regular')).toBe(aBefore)
    expect(await cardCount(B, cardX, 'regular')).toBe(bBefore)
  })

  it('writes a trade_audit row on a completed trade (accepted only)', async () => {
    const id = await newSession()
    await rpc(aTok, 'set_trade_stage', { p_session_id: id, p_cards: offerX() })
    await rpc(bTok, 'set_trade_stage', { p_session_id: id, p_cards: offerY() })
    await rpc(aTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(bTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(aTok, 'confirm_trade_session', { p_session_id: id })
    await rpc(bTok, 'confirm_trade_session', { p_session_id: id })
    const rows = await serviceSelect('trade_audit', `session_id=eq.${id}&select=*`)
    expect(rows.length).toBe(1)
    expect(rows[0].initiator_id).toBe(A)
    expect(rows[0].partner_id).toBe(B)
    expect(JSON.stringify(rows[0].initiator_cards)).toContain('golden')
  })

  it('does NOT audit a cancelled trade', async () => {
    const id = await newSession()
    await rpc(bTok, 'cancel_trade_session', { p_session_id: id })
    expect((await serviceSelect('trade_audit', `session_id=eq.${id}&select=id`)).length).toBe(0)
  })

  it('cannot trade the same card in two rooms (double-spend across sessions)', async () => {
    // B holds exactly ONE copy of cardY and is the partner in two rooms.
    await serviceUpdate('user_cards', `user_id=eq.${B}&card_id=eq.${cardY}&edition=eq.regular`, { count: 1 })
    const s1 = (await rpc(aTok, 'create_trade_session', { p_partner_id: B })).data as string
    const s2 = (await rpc(cTok, 'create_trade_session', { p_partner_id: B })).data as string

    // B stages their single cardY in BOTH rooms (one-sided gifts to A and C).
    const giveY = [{ card_id: cardY, edition: 'regular', quantity: 1 }]
    await rpc(bTok, 'set_trade_stage', { p_session_id: s1, p_cards: giveY })
    await rpc(bTok, 'set_trade_stage', { p_session_id: s2, p_cards: giveY })

    // Room 1 completes — B gives cardY to A.
    await rpc(aTok, 'set_trade_lock', { p_session_id: s1, p_locked: true })
    await rpc(bTok, 'set_trade_lock', { p_session_id: s1, p_locked: true })
    await rpc(aTok, 'confirm_trade_session', { p_session_id: s1 })
    expect((await rpc(bTok, 'confirm_trade_session', { p_session_id: s1 })).data.completed).toBe(true)

    // Room 2 tries to commit the SAME card — re-validation under lock aborts it.
    await rpc(cTok, 'set_trade_lock', { p_session_id: s2, p_locked: true })
    await rpc(bTok, 'set_trade_lock', { p_session_id: s2, p_locked: true })
    await rpc(cTok, 'confirm_trade_session', { p_session_id: s2 })
    expect((await rpc(bTok, 'confirm_trade_session', { p_session_id: s2 })).status).toBeGreaterThanOrEqual(400)

    // Conserved: A got the one copy, C got nothing, B has zero — never duplicated.
    expect(await cardCount(A, cardY, 'regular')).toBe(1)
    expect(await cardCount(C, cardY, 'regular')).toBe(0)
    expect(await cardCount(B, cardY, 'regular')).toBe(0)
    expect(await sessionStatus(s2)).toBe('open')
  })

  it('cannot confirm a completed session again', async () => {
    const id = await newSession()
    await rpc(aTok, 'set_trade_stage', { p_session_id: id, p_cards: offerX() })
    await rpc(bTok, 'set_trade_stage', { p_session_id: id, p_cards: offerY() })
    await rpc(aTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(bTok, 'set_trade_lock', { p_session_id: id, p_locked: true })
    await rpc(aTok, 'confirm_trade_session', { p_session_id: id })
    await rpc(bTok, 'confirm_trade_session', { p_session_id: id })
    expect((await rpc(bTok, 'confirm_trade_session', { p_session_id: id })).status).toBeGreaterThanOrEqual(400)
  })
})

describe('create_trade_session — validation', () => {
  it('rejects trading with yourself', async () => {
    expect((await rpc(aTok, 'create_trade_session', { p_partner_id: A })).status).toBeGreaterThanOrEqual(400)
  })
  it('rejects a hidden partner', async () => {
    await upsertProfile(B, { hidden: true })
    expect((await rpc(aTok, 'create_trade_session', { p_partner_id: B })).status).toBeGreaterThanOrEqual(400)
  })
  it('rejects an admin partner', async () => {
    await upsertProfile(C, { full_name: 'Trade C', role: 'admin', hidden: false })
    expect((await rpc(aTok, 'create_trade_session', { p_partner_id: C })).status).toBeGreaterThanOrEqual(400)
  })
  it('rejects a second concurrent active session', async () => {
    await newSession()
    expect((await rpc(aTok, 'create_trade_session', { p_partner_id: C })).status).toBeGreaterThanOrEqual(400)
  })
})

describe('access control + lifecycle', () => {
  it('a non-participant cannot read or act on the session', async () => {
    const id = await newSession()
    expect((await rpc(cTok, 'get_trade_session', { p_session_id: id })).status).toBeGreaterThanOrEqual(400)
    expect((await rpc(cTok, 'set_trade_stage', { p_session_id: id, p_cards: offerY() })).status).toBeGreaterThanOrEqual(400)
    expect((await rpc(cTok, 'cancel_trade_session', { p_session_id: id })).status).toBeGreaterThanOrEqual(400)
  })
  it('clients cannot write the tables directly — RLS forces RPC-only mutations', async () => {
    // Forge cards into your own collection via direct INSERT → denied by RLS.
    const mint = await fetch(`${LOCAL_URL}/rest/v1/user_cards`, {
      method: 'POST', headers: authedHeaders(aTok),
      body: JSON.stringify({ user_id: A, card_id: cardX, edition: 'galaxy', count: 999 }),
    })
    expect(mint.status).toBeGreaterThanOrEqual(400)
    expect(await cardCount(A, cardX, 'galaxy')).toBe(0)

    // Forge a pre-completed trade row directly → denied by RLS.
    const forgeSession = await fetch(`${LOCAL_URL}/rest/v1/trade_sessions`, {
      method: 'POST', headers: authedHeaders(aTok),
      body: JSON.stringify({ initiator_id: A, partner_id: B, status: 'completed' }),
    })
    expect(forgeSession.status).toBeGreaterThanOrEqual(400)

    // Tamper an existing session's status by direct UPDATE → no row is changed.
    const id = await newSession()
    await fetch(`${LOCAL_URL}/rest/v1/trade_sessions?id=eq.${id}`, {
      method: 'PATCH', headers: { ...authedHeaders(aTok), Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'completed' }),
    })
    expect(await sessionStatus(id)).toBe('open')
  })

  it('either participant can cancel an open session', async () => {
    const id = await newSession()
    expect((await rpc(bTok, 'cancel_trade_session', { p_session_id: id })).status).toBeLessThan(300)
    expect(await sessionStatus(id)).toBe('cancelled')
  })

  it('cleanup deletes an open session both players have abandoned', async () => {
    const id = await newSession()
    // Simulate "nobody viewing for a while" by ageing updated_at past the window.
    await serviceUpdate('trade_sessions', `id=eq.${id}`, { updated_at: '2000-01-01T00:00:00Z' })
    await rpc(aTok, 'cleanup_stale_trade_sessions', {})
    expect((await serviceSelect('trade_sessions', `id=eq.${id}&select=id`)).length).toBe(0)
  })

  it('get_trade_session keeps an open session fresh (touch-on-read)', async () => {
    const id = await newSession()
    await serviceUpdate('trade_sessions', `id=eq.${id}`, { updated_at: '2000-01-01T00:00:00Z' })
    await rpc(aTok, 'get_trade_session', { p_session_id: id }) // a view bumps updated_at
    await rpc(aTok, 'cleanup_stale_trade_sessions', {})
    expect((await serviceSelect('trade_sessions', `id=eq.${id}&select=id`)).length).toBe(1) // survived
  })
  it('get_my_cards returns only the caller’s own cards', async () => {
    const res = await rpc(aTok, 'get_my_cards', {})
    expect(res.status).toBeLessThan(300)
    const ids = (res.data as { card_id: string }[]).map((c) => c.card_id)
    expect(ids).toContain(cardX)
    expect(ids).not.toContain(cardY) // cardY belongs to B
  })
  it('pending_trade_invite_count counts incoming open invites', async () => {
    await newSession()
    expect((await rpc(bTok, 'pending_trade_invite_count', {})).data).toBe(1)
    expect((await rpc(aTok, 'pending_trade_invite_count', {})).data).toBe(0)
  })
})
