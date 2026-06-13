const LOCAL_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const headers = {
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

async function getOrCreateUser(email: string, password: string): Promise<string> {
  // Try to create
  const res = await fetch(`${LOCAL_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const data = await res.json()
  if (data.id) return data.id

  // Already exists — look up by email
  const listRes = await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=50`, {
    headers,
  })
  const listData = await listRes.json()
  const user = listData.users?.find((u: any) => u.email === email)
  if (user?.id) return user.id

  throw new Error(`Failed to get or create user ${email}: ${JSON.stringify(data)}`)
}

async function upsertProfile(userId: string, fullName: string, role: string, gruten: number) {
  await fetch(`${LOCAL_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: userId, full_name: fullName, role, gruten }),
  })
}

async function seedUserCards(userId: string) {
  const res = await fetch(`${LOCAL_URL}/rest/v1/cards?select=id`, {
    headers: { ...headers, 'Accept': 'application/json' },
  })
  const cards = await res.json()
  if (!Array.isArray(cards) || cards.length === 0) return

  // Delete existing to avoid duplicates
  await fetch(`${LOCAL_URL}/rest/v1/user_cards?user_id=eq.${userId}`, {
    method: 'DELETE',
    headers,
  })

  await fetch(`${LOCAL_URL}/rest/v1/user_cards`, {
    method: 'POST',
    headers,
    body: JSON.stringify(cards.map((c: { id: string }) => ({
      user_id: userId,
      card_id: c.id,
      count: 1,
      obtained_at: new Date().toISOString(),
    }))),
  })
}

async function upsertDeck(userId: string, slot: number, name: string, cardIds: string[]) {
  // Delete existing deck at this slot
  await fetch(`${LOCAL_URL}/rest/v1/decks?user_id=eq.${userId}&slot=eq.${slot}`, {
    method: 'DELETE',
    headers,
  })

  await fetch(`${LOCAL_URL}/rest/v1/decks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId, slot, name, card_ids: cardIds }),
  })
}

export default async function globalSetup() {
  const adminId = await getOrCreateUser('admin@test.com', 'password123')
  const playerId = await getOrCreateUser('player@test.com', 'password123')

  console.log(`Test users: admin=${adminId}, player=${playerId}`)

  await upsertProfile(adminId, 'Test Admin', 'admin', 10000)
  await upsertProfile(playerId, 'Test Player', 'player', 5000)

  await seedUserCards(adminId)
  await seedUserCards(playerId)

  await upsertDeck(adminId, 1, 'Admin Deck', [
    'dddddddd-0001-0000-0000-000000000000',
    'dddddddd-0002-0000-0000-000000000000',
    'dddddddd-0003-0000-0000-000000000000',
    'dddddddd-0004-0000-0000-000000000000',
    'dddddddd-0005-0000-0000-000000000000',
  ])
  await upsertDeck(playerId, 1, 'Player Deck', [
    'dddddddd-0006-0000-0000-000000000000',
    'dddddddd-0007-0000-0000-000000000000',
    'dddddddd-0008-0000-0000-000000000000',
    'dddddddd-0009-0000-0000-000000000000',
    'dddddddd-0010-0000-0000-000000000000',
  ])
}
