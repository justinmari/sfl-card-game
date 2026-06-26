import { type Page, type Browser } from '@playwright/test'

const LOCAL_SUPABASE_URL = 'http://127.0.0.1:54321'
const LOCAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const LOCAL_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const serviceHeaders = {
  'apikey': LOCAL_SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

export const TEST_ADMIN = { email: 'admin@test.com', password: 'password123' }
export const TEST_PLAYER = { email: 'player@test.com', password: 'password123' }
export const TEST_PLAYER_TWO = { email: 'player2@test.com', password: 'password123' }

export async function login(page: Page, user: { email: string; password: string }) {
  await page.goto('/login')
  await page.fill('input[type="email"]', user.email)
  await page.fill('input[type="password"]', user.password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(dashboard|setup)/, { timeout: 10000 })
}

export async function loginNewContext(browser: Browser, user: { email: string; password: string }) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await login(page, user)
  return { context, page }
}

export async function joinLobbyFromList(page: Page) {
  await page.goto('/arena')
  await page.click('button:has-text("Join")', { timeout: 10000 })
  await page.waitForURL(/\/arena\/lobby\//, { timeout: 10000 })
}

// Arena helpers

export async function resetArenaEnabled() {
  await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/app_settings?key=eq.arena_enabled`, {
    method: 'PATCH',
    headers: { ...serviceHeaders, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ value: true }),
  })
}

export async function setArenaDisabled() {
  await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/app_settings?key=eq.arena_enabled`, {
    method: 'PATCH',
    headers: { ...serviceHeaders, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ value: false }),
  })
}

// Holo rate helpers

export async function setHoloRates(golden: number, diamond: number, galaxy: number) {
  const patch = (edition: string, rate: number) =>
    fetch(`${LOCAL_SUPABASE_URL}/rest/v1/holo_rates?edition=eq.${edition}`, {
      method: 'PATCH',
      headers: { ...serviceHeaders, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ rate }),
    })
  await Promise.all([patch('golden', golden), patch('diamond', diamond), patch('galaxy', galaxy)])
}

export async function resetHoloRates() {
  await setHoloRates(0.1, 0.05, 0.01)
}

export async function cleanupArena() {
  const del = (table: string) =>
    fetch(`${LOCAL_SUPABASE_URL}/rest/v1/${table}?id=not.is.null`, {
      method: 'DELETE',
      headers: serviceHeaders,
    })
  await del('arena_rounds')
  await del('arena_ready')
  await del('arena_sessions')
  await del('arena_lobby_players')
  await del('arena_lobbies')
}

/** @deprecated Use cleanupArena instead */
export const cleanupLobbies = cleanupArena
