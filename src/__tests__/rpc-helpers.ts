// Shared helpers for REST/RPC integration tests that hit the local Supabase
// stack directly (GoTrue admin API + PostgREST). Not a test suite itself.

export const LOCAL_URL = 'http://127.0.0.1:54321'
export const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
export const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export const serviceHeaders = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}
export const authedHeaders = (token: string) => ({
  apikey: ANON_KEY,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
})

export async function getOrCreateUser(email: string, password: string): Promise<string> {
  const res = await fetch(`${LOCAL_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: serviceHeaders,
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const data = await res.json()
  if (data.id) return data.id
  const list = await (
    await fetch(`${LOCAL_URL}/auth/v1/admin/users?page=1&per_page=200`, { headers: serviceHeaders })
  ).json()
  const u = list.users?.find((x: { email: string }) => x.email === email)
  if (u?.id) return u.id
  throw new Error(`get/create user failed: ${email}`)
}

export async function upsertProfile(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await fetch(`${LOCAL_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id, ...fields }),
  })
}

export async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${LOCAL_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`sign in failed: ${email}`)
  return data.access_token
}

export async function rpc(token: string, fn: string, body: object) {
  const res = await fetch(`${LOCAL_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: authedHeaders(token),
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

// Anonymous RPC call (no user JWT) — uses the anon key as both apikey and bearer.
export async function anonRpc(fn: string, body: object) {
  const res = await fetch(`${LOCAL_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

export async function getGruten(id: string): Promise<number> {
  const d = await (
    await fetch(`${LOCAL_URL}/rest/v1/profiles?id=eq.${id}&select=gruten`, { headers: serviceHeaders })
  ).json()
  return d[0].gruten
}

export async function serviceSelect(table: string, query: string) {
  const res = await fetch(`${LOCAL_URL}/rest/v1/${table}?${query}`, { headers: serviceHeaders })
  return res.json()
}

export async function serviceUpdate(table: string, query: string, patch: object) {
  await fetch(`${LOCAL_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: { ...serviceHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  })
}

export async function serviceDelete(table: string, query: string) {
  await fetch(`${LOCAL_URL}/rest/v1/${table}?${query}`, { method: 'DELETE', headers: serviceHeaders })
}

export async function serviceInsert(table: string, row: object) {
  await fetch(`${LOCAL_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...serviceHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
}
